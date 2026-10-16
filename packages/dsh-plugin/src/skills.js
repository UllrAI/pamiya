import { createHash, randomUUID } from "node:crypto";
import {
  readFile,
  writeFile,
  readdir,
  realpath,
  mkdir,
  rename,
  stat,
  rm,
  cp,
} from "node:fs/promises";
import { dirname, resolve, relative, isAbsolute, delimiter } from "node:path";
import { parse as parseYaml } from "yaml";
import { satisfies, validRange } from "semver";
import { z } from "zod";
import { executable, runProcess, agentIds } from "./capabilities.js";
import { sampleFiles } from "./sample-skill.js";

const MAX_BYTES = 64 * 1024 * 1024;
const digest = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const packageName = /^(?:@[a-z0-9_.-]+\/)?[a-z0-9][a-z0-9_.-]*$/i;
const pythonSpec =
  /^[a-z0-9][a-z0-9_.-]*(?:\[[a-z0-9_,.-]+\])?(?:[<>=!~][a-z0-9.*+,<>=!~ -]+)?$/i;
const manifestSchema = z
  .object({
    version: z.literal(1),
    agents: z.array(z.enum(agentIds)).optional(),
    platforms: z.array(z.enum(["darwin", "linux", "win32"])).optional(),
    requires: z
      .object({
        commands: z
          .array(z.string().regex(/^[a-zA-Z0-9_.+-]+$/))
          .max(24)
          .default([]),
        env: z
          .array(z.string().regex(/^[A-Z_][A-Z0-9_]*$/i))
          .max(24)
          .default([]),
        python: z.array(z.string().regex(pythonSpec)).max(40).default([]),
        node: z
          .array(
            z
              .object({
                name: z.string().regex(packageName),
                version: z
                  .string()
                  .regex(/^[a-zA-Z0-9.*^~<>=|+ -]+$/)
                  .optional(),
                source: z.string().min(1).max(300).optional(),
              })
              .strict(),
          )
          .max(40)
          .default([]),
      })
      .strict()
      .prefault({}),
  })
  .strict();
export const skillRefSchema = z
  .object({
    id: z.string().min(1).max(180),
    name: z.string().min(1).max(100),
    description: z.string().max(1200),
    hash: z.string().regex(/^[a-f0-9]{64}$/),
    bytes: z.number().int().nonnegative(),
    synthetic: z.boolean(),
    compatibility: z.string().max(2000).default(""),
    requirements: manifestSchema,
  })
  .strict();
const contained = (base, path) => {
  const rel = relative(base, path);
  return (
    !isAbsolute(rel) &&
    rel !== ".." &&
    !rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)
  );
};
const fileName = (value) =>
  typeof value === "string" &&
  value.length < 500 &&
  !value.includes("\\") &&
  !value.includes("\0") &&
  !value.startsWith("/") &&
  value.split("/").every((x) => x && x !== "." && x !== "..");
const ignored = new Set([
  ".git",
  "node_modules",
  ".venv",
  "__pycache__",
  ".DS_Store",
  ".env",
]);
function metadata(files) {
  const body = Buffer.from(files["SKILL.md"] ?? "", "base64").toString("utf8");
  const front = body.match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!front) throw new Error("Skill 缺少 YAML frontmatter");
  const meta = parseYaml(front[1]);
  if (
    typeof meta?.name !== "string" ||
    !/^[a-z0-9][a-z0-9-]{0,99}$/.test(meta.name) ||
    typeof meta.description !== "string" ||
    !meta.description.trim()
  )
    throw new Error("Skill 需要有效的 name 与 description");
  const requirements = manifestSchema.parse(
    files["pamiya.json"]
      ? JSON.parse(Buffer.from(files["pamiya.json"], "base64").toString())
      : { version: 1 },
  );
  for (const dep of requirements.requires.node)
    if (dep.source && !fileName(dep.source))
      throw new Error("依赖来源必须是 Skill 内的相对目录");
  return {
    name: meta.name,
    description: meta.description.slice(0, 1200),
    compatibility: String(meta.compatibility ?? "").slice(0, 2000),
    requirements,
  };
}
export function makeBundle(input, id, synthetic = false, executables = []) {
  executables = [...new Set(executables)].sort();
  if (executables.some((path) => !fileName(path) || !(path in input)))
    throw new Error("Skill 可执行文件声明无效");
  const files = Object.fromEntries(
    Object.entries(input).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
  let bytes = 0;
  for (const [path, data] of Object.entries(files)) {
    if (
      !fileName(path) ||
      typeof data !== "string" ||
      data.length > MAX_BYTES * 1.4
    )
      throw new Error("Skill 文件路径或内容不正确");
    bytes += Buffer.byteLength(data, "base64");
  }
  if (Object.keys(files).length > 5000 || bytes > MAX_BYTES)
    throw new Error(
      "Skill 超过 5000 个文件或 64 MB，请将大型运行依赖放到依赖声明中",
    );
  const meta = metadata(files),
    hash = digest({ files, executables });
  return {
    ref: skillRefSchema.parse({
      id,
      name: meta.name,
      description: meta.description,
      hash,
      bytes,
      synthetic,
      ...meta,
    }),
    files,
    executables,
  };
}
export const sampleBundle = () =>
  makeBundle(
    Object.fromEntries(
      Object.entries(sampleFiles).map(([name, value]) => [
        name,
        Buffer.from(value).toString("base64"),
      ]),
    ),
    "sample:pamiya-skill-check",
    true,
  );
export async function readSkillDirectory(input, id) {
  const path = await realpath(input),
    info = await stat(path);
  const root = info.isDirectory() ? path : dirname(path),
    files = {},
    executables = [];
  let bytes = 0;
  async function visit(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (ignored.has(entry.name) || entry.name.startsWith(".env.")) continue;
      const file = resolve(dir, entry.name),
        actual = await realpath(file);
      if (!contained(root, actual))
        throw new Error(`Skill 包含目录之外的链接：${relative(root, file)}`);
      const st = await stat(actual);
      if (st.isDirectory()) {
        if (entry.isSymbolicLink())
          throw new Error("Skill 资源目录不能使用符号链接");
        await visit(file);
      } else if (st.isFile()) {
        bytes += st.size;
        if (bytes > MAX_BYTES || Object.keys(files).length >= 5000)
          throw new Error("Skill 超过 5000 个文件或 64 MB");
        const name = relative(root, file)
          .split(process.platform === "win32" ? "\\" : "/")
          .join("/");
        files[name] = (await readFile(file)).toString("base64");
        if (st.mode & 0o111) executables.push(name);
      }
    }
  }
  await visit(root);
  return makeBundle(files, id, false, executables);
}
async function atomic(path, value) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temp = `${path}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(value), { mode: 0o600 });
  await rename(temp, path);
}
async function load(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

export class SkillCatalog {
  constructor({ home, registry }) {
    this.root = resolve(home, "pamiya", "skill-library");
    this.registry = registry;
  }
  async list(context = {}) {
    const sources = new Map(),
      issues = [];
    for (const item of (await this.registry?.(context)) ?? [])
      if (item.path)
        sources.set(`dsh:${digest([item.path, item.name]).slice(0, 24)}`, {
          path: item.path,
          source: "DSH",
        });
    const imports = await load(resolve(this.root, "imports.json"), []);
    for (const item of imports) sources.set(item.id, item);
    const rows = [sampleBundle().ref];
    for (const [id, item] of sources)
      try {
        const bundle = await readSkillDirectory(item.path, id);
        rows.push({ ...bundle.ref, source: item.source ?? "imported" });
      } catch (error) {
        issues.push({ id, message: error.message });
      }
    return { skills: rows, issues };
  }
  async import(path) {
    const actual = await realpath(path),
      id = `import:${digest(actual).slice(0, 24)}`;
    const bundle = await readSkillDirectory(actual, id);
    const imports = await load(resolve(this.root, "imports.json"), []);
    if (!imports.some((item) => item.id === id)) {
      imports.push({ id, path: actual, source: "imported" });
      await atomic(resolve(this.root, "imports.json"), imports);
    }
    return bundle.ref;
  }
  async snapshot(ids, context = {}) {
    const refs = [];
    const sources = new Map(
      ((await this.registry?.(context)) ?? [])
        .filter((item) => item.path)
        .map((item) => [
          `dsh:${digest([item.path, item.name]).slice(0, 24)}`,
          item.path,
        ]),
    );
    for (const item of await load(resolve(this.root, "imports.json"), []))
      sources.set(item.id, item.path);
    for (const id of [...new Set(ids)]) {
      const bundle =
        id === "sample:pamiya-skill-check"
          ? sampleBundle()
          : sources.has(id)
            ? await readSkillDirectory(sources.get(id), id)
            : null;
      if (!bundle)
        throw new Error("Skill 已移除或当前对话不可见，请刷新能力列表");
      await atomic(
        resolve(this.root, "snapshots", `${bundle.ref.hash}.json`),
        bundle,
      );
      refs.push(bundle.ref);
    }
    if (new Set(refs.map((ref) => ref.name)).size !== refs.length)
      throw new Error("所选 Skills 存在同名项，请保留其中一个来源");
    return refs;
  }
  async bundle(hash) {
    return load(resolve(this.root, "snapshots", `${hash}.json`), null);
  }
}

export async function cacheSkill(
  directory,
  ref,
  fetchBundle,
  publicTest,
  signal,
) {
  ref = skillRefSchema.parse(ref);
  if (publicTest && ref.hash !== sampleBundle().ref.hash)
    throw new Error("公共连接只同步内置合成 Skill");
  const target = resolve(directory, "skill-cache", ref.hash);
  try {
    const cached = await load(resolve(target, "bundle.json"), null);
    if (
      cached &&
      makeBundle(cached.files, ref.id, ref.synthetic, cached.executables).ref
        .hash === ref.hash
    ) {
      for (const [path, data] of Object.entries(cached.files))
        if (
          !(await readFile(resolve(target, "files", path))).equals(
            Buffer.from(data, "base64"),
          )
        )
          throw new Error("Skill 缓存内容已修改，请重新准备这个版本");
      return { path: resolve(target, "files"), cached: true };
    }
  } catch (error) {
    if (
      error.code !== "ENOENT" &&
      error.message !== "Skill 缓存内容已修改，请重新准备这个版本"
    )
      throw error;
  }
  await rm(target, { recursive: true, force: true });
  signal?.throwIfAborted();
  const value = await fetchBundle(ref.hash, signal),
    bundle = makeBundle(value.files, ref.id, ref.synthetic, value.executables);
  if (
    bundle.ref.hash !== ref.hash ||
    JSON.stringify(bundle.ref.requirements) !== JSON.stringify(ref.requirements)
  )
    throw new Error("Skill 内容版本校验失败");
  const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    for (const [path, data] of Object.entries(bundle.files)) {
      const file = resolve(temporary, "files", path);
      await mkdir(dirname(file), { recursive: true, mode: 0o700 });
      await writeFile(file, Buffer.from(data, "base64"), {
        mode: bundle.executables.includes(path) ? 0o700 : 0o600,
      });
    }
    await atomic(resolve(temporary, "bundle.json"), bundle);
    await mkdir(dirname(target), { recursive: true, mode: 0o700 });
    try {
      await rename(temporary, target);
    } catch (error) {
      if (!["EEXIST", "ENOTEMPTY"].includes(error.code)) throw error;
      await rm(temporary, { recursive: true, force: true });
    }
  } catch (error) {
    await rm(temporary, { recursive: true, force: true });
    throw error;
  }
  return { path: resolve(target, "files"), cached: false };
}
export async function prepareSkills({
  directory,
  refs,
  agent,
  install = false,
  publicTest = false,
  fetchBundle,
  signal,
  progress = () => {},
}) {
  if (install) {
    const check = await prepareSkills({
      directory,
      refs,
      agent,
      install: false,
      publicTest,
      fetchBundle,
      signal,
      progress,
    });
    if (
      check.report.ready ||
      check.report.missing.some((item) => !item.installable)
    )
      return check;
  }
  const selected = refs.map((ref) => skillRefSchema.parse(ref));
  const key = digest(selected.map((ref) => ref.hash).sort()),
    root = resolve(directory, "skill-environments", key),
    nodeRoot = root,
    pythonRoot = resolve(root, "python");
  const paths = [],
    checks = [],
    missing = [],
    notes = [];
  const env = { PATH: process.env.PATH ?? "" };
  const nodePath = resolve(nodeRoot, "node_modules");
  env.NODE_PATH = [nodePath, process.env.NODE_PATH]
    .filter(Boolean)
    .join(delimiter);
  const python = resolve(
    pythonRoot,
    process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
  );
  const node = await executable("node", directory),
    npm = await executable("npm", directory);
  const envPath = [
    resolve(nodeRoot, "node_modules", ".bin"),
    resolve(pythonRoot, process.platform === "win32" ? "Scripts" : "bin"),
    dirname(process.execPath),
    process.env.PATH ?? "",
  ].join(delimiter);
  env.PATH = envPath;
  const commands = new Set(),
    variables = new Set(),
    pythonPackages = new Set(),
    nodePackages = [];
  for (const ref of selected) {
    progress({ phase: "skills_transfer", text: ref.name });
    const cached = await cacheSkill(
      directory,
      ref,
      fetchBundle,
      publicTest,
      signal,
    );
    const preparedPath = resolve(root, "skills", ref.hash);
    await mkdir(dirname(preparedPath), { recursive: true, mode: 0o700 });
    await cp(cached.path, preparedPath, { recursive: true, force: true });
    paths.push({ ...ref, path: preparedPath, cached: cached.cached });
    if (
      ref.requirements.platforms &&
      !ref.requirements.platforms.includes(process.platform)
    )
      missing.push({
        kind: "platform",
        name: ref.name,
        installable: false,
        message: `不支持 ${process.platform}`,
      });
    if (ref.requirements.agents && !ref.requirements.agents.includes(agent))
      missing.push({
        kind: "agent",
        name: ref.name,
        installable: false,
        message: `不支持 ${agent}`,
      });
    if (ref.compatibility)
      notes.push({ name: ref.name, text: ref.compatibility });
    for (const command of ref.requirements.requires.commands)
      commands.add(command);
    for (const variable of ref.requirements.requires.env)
      variables.add(variable);
    for (const pkg of ref.requirements.requires.python) pythonPackages.add(pkg);
    for (const pkg of ref.requirements.requires.node)
      nodePackages.push({ ...pkg, skillRoot: await realpath(preparedPath) });
  }
  for (const variable of variables) {
    const ready = Boolean(process.env[variable]);
    checks.push({ kind: "environment", name: variable, ready });
    if (!ready)
      missing.push({
        kind: "environment",
        name: variable,
        installable: false,
        message: `请在此节点配置 ${variable}，不要把值放进 Skill`,
      });
  }
  if (
    install &&
    missing.length === 0 &&
    (nodePackages.length || pythonPackages.size)
  ) {
    progress({
      phase: "skills_dependencies",
      text: "正在准备所选 Skills 的独立依赖环境",
    });
    await mkdir(root, { recursive: true, mode: 0o700 });
    if (nodePackages.length) {
      if (!npm) throw new Error("请先在节点安装 npm");
      const specs = [];
      for (const pkg of nodePackages) {
        if (pkg.source) {
          const source = await realpath(resolve(pkg.skillRoot, pkg.source));
          if (!contained(pkg.skillRoot, source))
            throw new Error("依赖来源越界");
          specs.push(source);
        } else specs.push(`${pkg.name}${pkg.version ? `@${pkg.version}` : ""}`);
      }
      await atomic(resolve(nodeRoot, "package.json"), { private: true });
      const result = await runProcess(
        npm,
        ["install", "--prefix", nodeRoot, "--no-fund", "--no-audit", ...specs],
        { signal, timeoutSeconds: 600, env },
      );
      if (result.exitCode !== 0)
        throw new Error(result.stderr || "Node 依赖安装失败");
    }
    if (pythonPackages.size) {
      const base =
        (await executable("python3", directory)) ??
        (await executable("python", directory));
      if (!base) throw new Error("请先在节点安装 Python 3");
      try {
        await stat(python);
      } catch {
        const result = await runProcess(base, ["-m", "venv", pythonRoot], {
          signal,
          timeoutSeconds: 120,
        });
        if (result.exitCode !== 0)
          throw new Error(
            result.stderr || "无法创建 Python venv，请安装 venv 支持",
          );
      }
      const result = await runProcess(
        python,
        [
          "-m",
          "pip",
          "install",
          "--disable-pip-version-check",
          "--no-input",
          ...pythonPackages,
        ],
        { signal, timeoutSeconds: 600 },
      );
      if (result.exitCode !== 0)
        throw new Error(result.stderr || "Python 依赖安装失败");
    }
  }
  if (nodePackages.length) {
    for (const pkg of nodePackages) {
      const check = node
        ? await runProcess(
            node,
            [
              "-e",
              'const fs=require("node:fs"),p=require("node:path");const root=process.argv[1],name=process.argv[2],file=p.join(root,...name.split("/"),"package.json");const value=JSON.parse(fs.readFileSync(file,"utf8"));process.stdout.write(JSON.stringify({version:value.version}));',
              nodePath,
              pkg.name,
            ],
            { signal, timeoutSeconds: 15, env },
          ).catch(() => ({ exitCode: 1 }))
        : { exitCode: 1 };
      let ready = check.exitCode === 0;
      if (ready && pkg.version) {
        const version = JSON.parse(check.output).version;
        ready = Boolean(
          validRange(pkg.version) && satisfies(version, pkg.version),
        );
      }
      checks.push({ kind: "node", name: pkg.name, ready });
      if (!ready)
        missing.push({
          kind: "node",
          name: pkg.name,
          installable: Boolean(npm),
          message: `需要 Node 包 ${pkg.name}${pkg.version ? ` (${pkg.version})` : ""}`,
        });
    }
  }
  if (pythonPackages.size) {
    for (const pkg of pythonPackages) {
      let ready = false;
      try {
        const result = await runProcess(
          python,
          [
            "-c",
            "import sys; from importlib.metadata import version; from pip._vendor.packaging.requirements import Requirement; r=Requirement(sys.argv[1]); sys.exit(0 if r.specifier.contains(version(r.name), prereleases=True) else 1)",
            pkg,
          ],
          { signal, timeoutSeconds: 20 },
        );
        ready = result.exitCode === 0;
      } catch {}
      checks.push({ kind: "python", name: pkg, ready });
      if (!ready)
        missing.push({
          kind: "python",
          name: pkg,
          installable: true,
          message: `需要 Python 包 ${pkg}`,
        });
    }
  }
  for (const command of commands) {
    const found = await executable(command, directory, env.PATH);
    const installable = missing.some(
      (item) => ["node", "python"].includes(item.kind) && item.installable,
    );
    checks.push({ kind: "command", name: command, ready: Boolean(found) });
    if (!found)
      missing.push({
        kind: "command",
        name: command,
        installable,
        message: installable
          ? `准备依赖后检查命令 ${command}`
          : `请在此节点安装 ${command}`,
      });
  }
  const report = {
    ready: missing.length === 0,
    agent,
    skills: paths.map(({ path, ...ref }) => ref),
    checks,
    missing,
    notes,
    environmentKey: key,
  };
  return { report, paths, env, root };
}

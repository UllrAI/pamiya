import Ajv from "ajv";
import { z } from "zod";
import { spawn } from "node:child_process";
import { access, readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { delimiter, resolve } from "node:path";
import { homedir } from "node:os";

const ajv = new Ajv({ allErrors: true, strict: false });
const validators = new Map();
export const agentIds = ["dsh", "codex", "claude", "pi"];
const agentConfig = z
  .object({
    enabled: z.boolean().default(true),
    command: z.string().min(1).max(2000).optional(),
    modelSource: z.enum(["inherit", "independent"]).default("inherit"),
    model: z.string().max(200).optional(),
    provider: z.string().max(200).optional(),
  })
  .strict();
export const capabilitiesSchema = z
  .object({
    version: z.literal(1).default(1),
    actions: z
      .array(
        z
          .object({
            name: z.string().regex(/^custom\.[a-z][a-z0-9_.-]{0,63}$/),
            description: z.string().trim().min(1).max(500),
            inputSchema: z.record(z.string(), z.unknown()),
            command: z.string().min(1).max(2000),
            args: z.array(z.string().max(2000)).max(40).default([]),
            timeoutSeconds: z.number().int().min(1).max(3600).default(120),
          })
          .strict(),
      )
      .max(24)
      .default([]),
    agents: z
      .object(
        Object.fromEntries(agentIds.map((id) => [id, agentConfig.optional()])),
      )
      .strict()
      .default({}),
  })
  .strict();

export function parseCapabilities(value) {
  const config = capabilitiesSchema.parse(value);
  const names = new Set();
  for (const action of config.actions) {
    if (names.has(action.name)) throw new Error(`能力名称重复：${action.name}`);
    names.add(action.name);
    validateSchema(action.inputSchema);
  }
  if (Buffer.byteLength(JSON.stringify(config)) > 24000)
    throw new Error("能力配置超过 24 KB，请精简说明或参数定义");
  return config;
}
function validateSchema(schema) {
  const key = JSON.stringify(schema);
  let validate = validators.get(key);
  if (!validate) {
    validate = ajv.compile(schema);
    if (validators.size >= 64) validators.clear();
    validators.set(key, validate);
  }
  return validate;
}
export function validateCustom(schema, input) {
  const validate = validateSchema(schema);
  if (!validate(input))
    throw new Error(`参数不符合能力定义：${ajv.errorsText(validate.errors)}`);
  return input;
}
export async function readCapabilities(directory) {
  try {
    return parseCapabilities(
      JSON.parse(
        await readFile(resolve(directory, "capabilities.json"), "utf8"),
      ),
    );
  } catch (error) {
    if (error.code === "ENOENT") return parseCapabilities({});
    throw error;
  }
}
export async function executable(name, directory) {
  const folders = [
    resolve(directory, "agents", "node_modules", ".bin"),
    resolve(homedir(), ".pamiya", "agents", "node_modules", ".bin"),
    resolve(
      process.env.DSH_HOME || resolve(homedir(), ".dsh"),
      "pamiya",
      "agents",
      "node_modules",
      ".bin",
    ),
    ...(process.env.PATH ?? "").split(delimiter),
    resolve(homedir(), ".local", "bin"),
  ];
  if (name === "dsh" && process.platform === "darwin")
    folders.unshift(
      "/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin",
    );
  try {
    const root = resolve(homedir(), ".nvm", "versions", "node");
    for (const entry of (await readdir(root)).reverse())
      folders.push(resolve(root, entry, "bin"));
  } catch {}
  if (name.includes("/") || name.includes("\\"))
    folders.splice(0, folders.length, "");
  for (const folder of folders) {
    const file = folder
      ? resolve(folder, process.platform === "win32" ? `${name}.cmd` : name)
      : name;
    try {
      await access(file);
      return file;
    } catch {}
  }
  return null;
}
export async function discoverAgents(config, directory) {
  return Promise.all(
    agentIds.map(async (id) => {
      const settings = config.agents[id] ?? {
        enabled: true,
        modelSource: "inherit",
      };
      const command = await executable(settings.command ?? id, directory);
      return {
        id,
        name: { dsh: "DSH", codex: "Codex", claude: "Claude Code", pi: "Pi" }[
          id
        ],
        ...settings,
        installed: Boolean(command),
        command,
        status: !settings.enabled
          ? "disabled"
          : command
            ? "ready"
            : "not_installed",
      };
    }),
  );
}

export async function runProcess(
  command,
  args,
  {
    cwd,
    env,
    input = "",
    signal,
    timeoutSeconds = 120,
    onLine = () => {},
    logFile,
  } = {},
) {
  signal?.throwIfAborted();
  if (logFile) {
    await mkdir(resolve(logFile, ".."), { recursive: true, mode: 0o700 });
    await writeFile(logFile, "", { mode: 0o600 });
  }
  const { createWriteStream } = await import("node:fs");
  const log = logFile
    ? createWriteStream(logFile, { flags: "a", mode: 0o600 })
    : null;
  return new Promise((done, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      detached: process.platform !== "win32",
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    let output = "",
      stderr = "",
      buffer = "",
      stopped = false,
      timedOut = false,
      killTimer;
    const kill = () => {
      stopped = true;
      const stop = (force) => {
        try {
          if (process.platform === "win32")
            spawn(
              "taskkill",
              ["/PID", String(child.pid), "/T", ...(force ? ["/F"] : [])],
              { windowsHide: true, stdio: "ignore" },
            ).on("error", () => child.kill());
          else process.kill(-child.pid, force ? "SIGKILL" : "SIGTERM");
        } catch {}
      };
      stop(false);
      killTimer ??= setTimeout(() => stop(true), 3000);
    };
    const timer = setTimeout(() => {
      timedOut = true;
      kill();
    }, timeoutSeconds * 1000);
    signal?.addEventListener("abort", kill, { once: true });
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (bytes) => {
      log?.write(bytes);
      output = (output + bytes.toString()).slice(-24000);
      buffer += bytes.toString();
      let end;
      while ((end = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 1);
        try {
          onLine(line);
        } catch (error) {
          stderr = error.message;
          kill();
        }
      }
      if (buffer.length > 2 * 1024 * 1024) {
        stderr = "Agent 输出单行过大";
        kill();
      }
    });
    child.stderr.on("data", (bytes) => {
      stderr = (stderr + bytes.toString()).slice(-8000);
    });
    child.stdin.on("error", () => {});
    child.stdin.end(input);
    const cleanup = () => {
      clearTimeout(timer);
      clearTimeout(killTimer);
      signal?.removeEventListener("abort", kill);
    };
    child.once("error", (error) => {
      log?.end();
      cleanup();
      reject(error);
    });
    child.once("close", async (exitCode) => {
      if (log) await new Promise((done) => log.end(done));
      cleanup();
      if (buffer.trim()) onLine(buffer);
      if (stopped)
        reject(
          new Error(
            timedOut
              ? "执行超时；此前产生的修改不会自动撤销"
              : "执行已停止；此前产生的修改不会自动撤销",
          ),
        );
      else done({ exitCode, output, stderr });
    });
  });
}

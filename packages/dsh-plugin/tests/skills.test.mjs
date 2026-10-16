import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  rm,
  writeFile,
  mkdir,
  readFile,
  chmod,
  stat,
  symlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  SkillCatalog,
  sampleBundle,
  prepareSkills,
  readSkillDirectory,
  makeBundle,
  cacheSkill,
} from "../src/skills.js";
import { sampleFiles } from "../src/sample-skill.js";
import { runProcess } from "../src/capabilities.js";
import { Controller } from "../src/controller.js";
import { seal, packet, topic } from "../src/protocol.js";
const proof = "PAMIYA_SKILL_OK:48656c6c6f2050616d697961";
async function temporary(t) {
  const root = await mkdtemp(resolve(tmpdir(), "pamiya-skills-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
async function fixture(root) {
  for (const [path, body] of Object.entries(sampleFiles)) {
    await mkdir(resolve(root, path, ".."), { recursive: true });
    await writeFile(resolve(root, path), body);
  }
}
async function until(check, timeout = 12000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const value = await check();
    if (value) return value;
    await new Promise((done) => setTimeout(done, 25));
  }
  throw new Error("Skill flow did not settle");
}
test("catalog snapshots pin complete resources and executable modes, updates are explicit", async (t) => {
  const root = await temporary(t),
    skill = resolve(root, "source");
  await fixture(skill);
  await chmod(resolve(skill, "scripts/check.cjs"), 0o700);
  const catalog = new SkillCatalog({
    home: root,
    registry: () => [{ path: skill, name: "fixture" }],
  });
  const listed = await catalog.list(),
    id = listed.skills.find((x) => x.source === "DSH").id;
  const [first] = await catalog.snapshot([id]);
  const bundle = await catalog.bundle(first.hash);
  assert.ok(bundle.files["assets/sample.json"]);
  assert.ok(bundle.executables.includes("scripts/check.cjs"));
  await writeFile(
    resolve(skill, "assets/sample.json"),
    '{"message":"changed"}',
  );
  const [second] = await catalog.snapshot([id]);
  assert.notEqual(first.hash, second.hash);
  assert.match(
    Buffer.from(
      (await catalog.bundle(first.hash)).files["assets/sample.json"],
      "base64",
    ).toString(),
    /Hello Pamiya/,
  );
  const cached = await cacheSkill(
    resolve(root, "worker"),
    first,
    () => bundle,
    false,
  );
  assert.ok(
    (await stat(resolve(cached.path, "scripts/check.cjs"))).mode & 0o100,
  );
  await writeFile(resolve(cached.path, "SKILL.md"), "modified");
  await cacheSkill(resolve(root, "worker"), first, () => bundle, false);
  assert.match(
    await readFile(resolve(cached.path, "SKILL.md"), "utf8"),
    /pamiya-skill-check/,
  );
  await assert.rejects(
    cacheSkill(root, first, () => bundle, true),
    /公共连接/,
  );
  await writeFile(resolve(root, "outside.txt"), "private");
  await symlink(resolve(root, "outside.txt"), resolve(skill, "outside.txt"));
  await assert.rejects(readSkillDirectory(skill, id), /目录之外/);
});
test("dependency preparation installs bundled packages, supports CJS and ESM, reuses cache", async (t) => {
  const directory = await temporary(t),
    bundle = sampleBundle();
  let transfers = 0;
  const options = {
    directory,
    refs: [bundle.ref],
    agent: "dsh",
    publicTest: true,
    fetchBundle: async () => {
      transfers++;
      return bundle;
    },
  };
  const first = await prepareSkills(options);
  assert.equal(first.report.ready, false);
  assert.ok(
    first.report.missing.some((x) => x.kind === "node" && x.installable),
  );
  const prepared = await prepareSkills({ ...options, install: true });
  assert.equal(prepared.report.ready, true);
  const result = await runProcess(
    process.execPath,
    [resolve(prepared.paths[0].path, "scripts/check.cjs")],
    { env: prepared.env },
  );
  assert.equal(JSON.parse(result.output).proof, proof);
  const esm = resolve(prepared.paths[0].path, "scripts/check.mjs");
  await writeFile(
    esm,
    'import helper from "pamiya-synthetic-helper"; console.log(helper.proof("Hello Pamiya"));',
  );
  const esmResult = await runProcess(process.execPath, [esm], {
    env: prepared.env,
  });
  assert.match(esmResult.output, new RegExp(proof));
  assert.equal(
    (await prepareSkills({ ...options, install: true })).report.ready,
    true,
  );
  assert.equal(transfers, 1);
  const bad = structuredClone(bundle.files);
  const manifest = JSON.parse(Buffer.from(bad["pamiya.json"], "base64"));
  manifest.requires.env = ["PAMIYA_MISSING_TEST_TOKEN"];
  bad["pamiya.json"] = Buffer.from(JSON.stringify(manifest)).toString("base64");
  const manual = makeBundle(bad, "fixture");
  const checked = await prepareSkills({
    ...options,
    publicTest: false,
    refs: [manual.ref],
    install: true,
    fetchBundle: () => manual,
  });
  assert.equal(checked.report.ready, false);
  assert.equal(
    checked.report.missing.find((x) => x.kind === "environment").installable,
    false,
  );
});
test("same durable task prepares and continues after Host restart, callbacks and stale results are isolated", async (t) => {
  const directory = await temporary(t),
    catalog = new SkillCatalog({ home: directory });
  let saved;
  const secrets = new Map(),
    callbacks = [];
  const settings = {
    home: directory,
    autoLocal: true,
    skillCatalog: catalog,
    store: {
      load: () => saved,
      save: async (value) => {
        saved = structuredClone(value);
      },
    },
    secrets: {
      get: async (id) => secrets.get(id),
      set: async (id, value) => secrets.set(id, value),
    },
    onComplete: async (task) => {
      callbacks.push([task.id, task.status, task.callbackRevision ?? 0]);
      return true;
    },
  };
  let controller = await new Controller(settings).init();
  t.after(() => controller.close());
  await until(() =>
    controller.snapshot().workers.some((w) => w.status === "ready"),
  );
  const created = await controller.toolRun(
    {
      action: "skills.prepare",
      input: { agent: "dsh", skills: [sampleBundle().ref.id] },
    },
    { callId: "prepare", agent: { session: { id: "synthetic-session" } } },
  );
  const id = created.taskId,
    lookup = () => controller.state.tasks.find((x) => x.id === id);
  await until(() => lookup().status === "needs_preparation");
  const pinned = lookup().input.skills[0].hash;
  await controller.tick();
  await controller.close();
  controller = await new Controller(settings).init();
  await until(() =>
    controller.snapshot().workers.some((w) => w.status === "ready"),
  );
  const originalSend = controller.send.bind(controller);
  let continuation;
  controller.send = async (...args) => {
    if (args[1] === "continue") continuation = args;
    else return originalSend(...args);
  };
  await controller.continueTask(id);
  const workerId = lookup().workerId,
    bootId = lookup().bootId;
  await controller.receive(
    controller.state.broker,
    topic(controller.state.broker, workerId, "up"),
    seal(
      controller.state.broker,
      workerId,
      secrets.get(`worker-${workerId}`).key,
      "up",
      packet(
        workerId,
        bootId,
        "result",
        { status: "needs_preparation", preparationRevision: 0 },
        id,
      ),
    ),
  );
  assert.equal(
    lookup().status,
    "sent",
    "a stale preparation result must not roll back continuation",
  );
  controller.send = originalSend;
  await originalSend(...continuation);
  await until(() => lookup().status === "succeeded");
  assert.equal(lookup().id, id);
  assert.equal(lookup().input.skills[0].hash, pinned);
  assert.equal(lookup().result.preparation.ready, true);
  await controller.tick();
  assert.deepEqual(
    callbacks.map((x) => x[1]),
    ["needs_preparation", "succeeded"],
  );
  assert.equal(callbacks[1][2], 1);
  await assert.rejects(controller.continueTask(id), /只有等待/);
  const worker = controller.snapshot().workers[0];
  await until(
    () =>
      worker.id && controller.live.get(worker.id)?.skillSelections?.dsh?.length,
  );
  assert.equal(
    controller.live.get(worker.id).skillSelections.dsh[0].hash,
    pinned,
  );
  const journal = JSON.parse(
    await readFile(
      resolve(directory, "pamiya/workers", worker.id, "journal.json"),
      "utf8",
    ),
  );
  await until(
    async () =>
      JSON.parse(
        await readFile(
          resolve(directory, "pamiya/workers", worker.id, "journal.json"),
          "utf8",
        ),
      )[id].acknowledged,
  );
  assert.equal(journal[id].preparationRevision, 1);
});

test(
  "all four real Agent CLIs load the selected Skill, read its asset and execute its prepared script",
  { skip: process.env.PAMIYA_REAL_AGENT_TESTS !== "1", timeout: 240000 },
  async (t) => {
    const directory = await temporary(t),
      bundle = sampleBundle();
    const { discoverAgents, parseCapabilities } =
      await import("../src/capabilities.js");
    const { runAgent } = await import("../src/agent-runtime.js");
    const agents = await discoverAgents(parseCapabilities({}), directory);
    assert.equal(agents.filter((x) => x.installed).length, 4);
    for (const agent of agents) {
      const preparation = await prepareSkills({
        directory,
        refs: [bundle.ref],
        agent: agent.id,
        install: true,
        publicTest: true,
        fetchBundle: () => bundle,
      });
      assert.equal(preparation.report.ready, true, agent.id);
      let stage = 0;
      const observed = [];
      const base = preparation.paths[0].path;
      const result = await runAgent({
        agent,
        input: {
          synthetic: true,
          modelRoute: { provider: "test", model: "pamiya-test" },
          timeoutSeconds: 45,
        },
        preparation,
        taskId: crypto.randomUUID(),
        directory,
        workspace: directory,
        publicTest: true,
        signal: new AbortController().signal,
        modelCall: async (request) => {
          const returned = JSON.stringify(
            request.messages.filter((x) => x.role === "tool"),
          );
          if (stage > 0) observed[stage - 1] = returned;
          if (stage >= 3)
            return {
              blocks: [{ type: "text", text: proof }],
              finishReason: "stop",
            };
          const read = stage < 2;
          const tool = request.tools?.find((tool) =>
            read
              ? /^(read|Read|exec_command)$/.test(tool.name)
              : /^(bash|Bash|exec_command)$/.test(tool.name),
          );
          assert.ok(
            tool,
            `${agent.id} missing ${read ? "read" : "shell"} tool: ${request.tools?.map((t) => t.name)}`,
          );
          const file = resolve(
            base,
            stage === 0
              ? "SKILL.md"
              : stage === 1
                ? "assets/sample.json"
                : "scripts/check.cjs",
          );
          const command = read ? `cat '${file}'` : `node ${file}`;
          const args =
            tool.name === "exec_command"
              ? { cmd: command, max_output_tokens: 1500 }
              : read
                ? agent.id === "pi"
                  ? { path: file }
                  : { file_path: file }
                : {
                    command,
                    ...(agent.id === "dsh"
                      ? { description: "Run synthetic Skill script" }
                      : {}),
                  };
          return {
            blocks: [
              {
                type: "tool-call",
                id: `skill_step_${stage++}`,
                name: tool.name,
                arguments: JSON.stringify(args),
              },
            ],
            finishReason: "tool-calls",
          };
        },
      });
      assert.equal(result.answer, proof, agent.id);
      assert.match(
        observed[0],
        /scripts\/check.cjs/,
        `${agent.id} loaded Skill instructions`,
      );
      assert.match(observed[1], /Hello Pamiya/, `${agent.id} read Skill asset`);
      assert.match(
        observed[2],
        new RegExp(proof),
        `${agent.id} executed actual script`,
      );
    }
  },
);

test("standard Skills work without a Pamiya dependency manifest", async (t) => {
  const directory = await temporary(t);
  const bundle = makeBundle(
    {
      "SKILL.md": Buffer.from(
        "---\nname: standard-skill\ndescription: A portable standard skill.\n---\nRead the provided text.",
      ).toString("base64"),
    },
    "standard",
  );
  assert.deepEqual(bundle.ref.requirements.requires.node, []);
  const result = await prepareSkills({
    directory,
    refs: [bundle.ref],
    agent: "codex",
    fetchBundle: () => bundle,
  });
  assert.equal(result.report.ready, true);
  assert.deepEqual(result.report.checks, []);
});

test("commands provided by Skill dependencies become available after preparation", async (t) => {
  const directory = await temporary(t),
    files = structuredClone(sampleBundle().files);
  const metadata = JSON.parse(
    Buffer.from(files["dependencies/helper/package.json"], "base64"),
  );
  metadata.bin = { "pamiya-skill-command": "bin.cjs" };
  files["dependencies/helper/package.json"] = Buffer.from(
    JSON.stringify(metadata),
  ).toString("base64");
  files["dependencies/helper/bin.cjs"] = Buffer.from(
    '#!/usr/bin/env node\nconsole.log("PAMIYA_COMMAND_OK");\n',
  ).toString("base64");
  const manifest = JSON.parse(Buffer.from(files["pamiya.json"], "base64"));
  manifest.requires.commands.push("pamiya-skill-command");
  files["pamiya.json"] = Buffer.from(JSON.stringify(manifest)).toString(
    "base64",
  );
  const bundle = makeBundle(files, "command-skill"),
    options = {
      directory,
      refs: [bundle.ref],
      agent: "dsh",
      fetchBundle: () => bundle,
    };
  const checked = await prepareSkills(options);
  assert.ok(
    checked.report.missing.find((x) => x.kind === "command").installable,
  );
  const prepared = await prepareSkills({ ...options, install: true });
  assert.equal(prepared.report.ready, true);
  const result = await runProcess("pamiya-skill-command", [], {
    env: prepared.env,
  });
  assert.match(result.output, /PAMIYA_COMMAND_OK/);
});
test("Python requirements are installed and checked inside a real isolated venv", async (t) => {
  const { executable } = await import("../src/capabilities.js");
  const directory = await temporary(t);
  if (!(await executable("python3", directory))) {
    t.skip("Python 3 is not installed");
    return;
  }
  const files = {
    "SKILL.md": Buffer.from(
      "---\nname: python-skill\ndescription: Check isolated Python dependencies.\n---\nUse Python.",
    ).toString("base64"),
    "pamiya.json": Buffer.from(
      JSON.stringify({ version: 1, requires: { python: ["pip>=20"] } }),
    ).toString("base64"),
  };
  const bundle = makeBundle(files, "python-skill"),
    options = {
      directory,
      refs: [bundle.ref],
      agent: "pi",
      fetchBundle: () => bundle,
    };
  assert.equal((await prepareSkills(options)).report.ready, false);
  const prepared = await prepareSkills({ ...options, install: true });
  assert.equal(prepared.report.ready, true);
  const result = await runProcess(
    "python",
    ["-c", "import sys; print(sys.prefix)"],
    { env: prepared.env },
  );
  assert.match(result.output, /skill-environments/);
});

test("resuming a known Agent session pins its old Skill snapshot while new sessions use updates", async (t) => {
  const directory = await temporary(t),
    source = resolve(directory, "source");
  await fixture(source);
  const catalog = new SkillCatalog({ home: directory }),
    ref = await catalog.import(source),
    [old] = await catalog.snapshot([ref.id]);
  await writeFile(
    resolve(source, "assets/sample.json"),
    '{"message":"updated"}',
  );
  const [updated] = await catalog.snapshot([ref.id]);
  assert.notEqual(updated.hash, old.hash);
  let saved;
  const controller = await new Controller({
    home: directory,
    skillCatalog: catalog,
    secrets: { get: async () => undefined },
    store: {
      load: async () => saved,
      save: async (value) => {
        saved = structuredClone(value);
      },
    },
  }).init();
  t.after(() => controller.close());
  const workerId = crypto.randomUUID();
  controller.state.broker.publicTest = false;
  controller.state.workers.push({
    id: workerId,
    label: "Remote",
    paired: true,
  });
  controller.state.tasks.push({
    id: crypto.randomUUID(),
    workerId,
    status: "succeeded",
    input: { agent: "dsh", skills: [old] },
    result: { sessionRef: "1b90d8bf-0608-421d-a0e8-875020d7b2ef" },
  });
  controller.connection.status = "connected";
  controller.live.set(workerId, {
    at: Date.now(),
    bootId: crypto.randomUUID(),
    actions: ["agent.run"],
    skillSyncVersion: 2,
    agents: [
      { id: "dsh", installed: true, enabled: true, modelSource: "inherit" },
    ],
  });
  controller.send = async () => {};
  const resumed = await controller.dispatch({
    workerId,
    action: "agent.run",
    input: { agent: "dsh", prompt: "Continue", sessionRef: "1b90d8bf-0608-421d-a0e8-875020d7b2ef" },
    modelRoute: { provider: "test", model: "test" },
  });
  assert.equal(resumed.input.skills[0].hash, old.hash);
  controller.state.tasks.find((task) => task.id === resumed.id).status =
    "failed";
  const fresh = await controller.dispatch({
    workerId,
    action: "agent.run",
    input: { agent: "dsh", prompt: "New task", skills: [ref.id] },
    modelRoute: { provider: "test", model: "test" },
  });
  assert.equal(fresh.input.skills[0].hash, updated.hash);
});

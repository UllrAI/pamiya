import test from "node:test";
import assert from "node:assert/strict";
import { Aedes } from "aedes";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import {
  mkdtemp,
  rm,
  readFile,
  mkdir,
  symlink,
  realpath,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { Controller } from "../src/controller.js";
import {
  startWorker,
  safePath,
  atomicJson,
  loadJson,
  executeAction,
} from "../src/worker.js";
import {
  seal,
  open,
  packet,
  topic,
  validateInput,
  brokerSchema,
} from "../src/protocol.js";

async function until(check, timeout = 9000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const value = await check();
    if (value) return value;
    await delay(30);
  }
  throw new Error("Condition did not settle");
}
async function fixture(t, { autoLocal = false } = {}) {
  const directory = await mkdtemp(resolve(tmpdir(), "pamiya-test-"));
  const broker = await Aedes.createBroker({ maxClientsIdLength: 200 });
  const server = createServer(broker.handle);
  await new Promise((resolveDone) =>
    server.listen(0, "127.0.0.1", resolveDone),
  );
  let saved;
  const secretRecords = new Map();
  let writes = 0;
  const config = {
    url: `mqtt://127.0.0.1:${server.address().port}`,
    username: "",
    password: "",
    namespace: `sandbox/pamiya/${randomUUID()}`,
    publicTest: true,
  };
  const settings = {
    autoLocal,
    store: {
      load: async () => saved,
      save: async (value) => {
        saved = structuredClone(value);
        writes++;
      },
    },
    secrets: {
      get: async (key) => secretRecords.get(key),
      set: async (key, value) => secretRecords.set(key, value),
    },
    home: directory,
  };
  let controller = await new Controller(settings).init();
  await controller.saveBroker(config);
  await until(() => controller.connection.status === "connected");
  const workers = [];
  t.after(async () => {
    for (const worker of workers) await worker.stop();
    await controller.close();
    await new Promise((resolveDone) => broker.close(resolveDone));
    await new Promise((resolveDone) => server.close(resolveDone));
    await rm(directory, { recursive: true, force: true });
  });
  const add = async (label) => {
    const invite = await controller.invite(label);
    const data = JSON.parse(Buffer.from(invite.code, "base64url"));
    const worker = await startWorker(
      { ...data, workspace: directory, allowShell: false },
      { directory: resolve(directory, invite.worker.id) },
    );
    workers.push(worker);
    await until(
      () =>
        controller.snapshot().workers.find((w) => w.id === invite.worker.id)
          ?.status === "ready",
    );
    return {
      data,
      worker,
      id: invite.worker.id,
      directory: resolve(directory, invite.worker.id),
    };
  };
  return {
    directory,
    config,
    add,
    workers,
    get controller() {
      return controller;
    },
    get saved() {
      return saved;
    },
    get writes() {
      return writes;
    },
    async restart() {
      await controller.close();
      controller = await new Controller(settings).init();
      await until(() => controller.connection.status === "connected");
      return controller;
    },
  };
}

test("encrypted messages reject tampering, wrong direction and expired input", () => {
  const config = { namespace: `sandbox/pamiya/${randomUUID()}` },
    workerId = randomUUID(),
    key = randomBytes(32).toString("base64url");
  const value = packet(workerId, randomUUID(), "status", {
    actions: ["demo.echo"],
  });
  const sealed = seal(config, workerId, key, "up", value);
  assert.deepEqual(open(config, workerId, key, "up", sealed), value);
  assert.throws(() => open(config, workerId, key, "down", sealed));
  const altered = JSON.parse(sealed);
  altered.data = "A" + altered.data.slice(1);
  assert.throws(() =>
    open(config, workerId, key, "up", Buffer.from(JSON.stringify(altered))),
  );
  assert.throws(() =>
    open(
      config,
      workerId,
      key,
      "up",
      seal(config, workerId, key, "up", { ...value, at: Date.now() - 300000 }),
    ),
  );
  assert.throws(() => validateInput("shell.run", { command: "echo no" }, true));
  assert.throws(() =>
    brokerSchema.parse({
      url: "mqtt://public.runmqtt.com:1883",
      namespace: "sandbox/pamiya/abcdefghijkl",
      publicTest: false,
    }),
  );
});

test("two real MQTT workers run independently and persist acknowledged business results", async (t) => {
  const f = await fixture(t);
  const one = await f.add("One"),
    two = await f.add("Two");
  const tasks = await Promise.all([
    f.controller.dispatch({
      workerId: one.id,
      action: "text.stats",
      input: { text: "hello world" },
    }),
    f.controller.dispatch({
      workerId: two.id,
      action: "demo.echo",
      input: { text: "synthetic" },
    }),
  ]);
  await until(() =>
    tasks.every(
      (task) =>
        f.controller.state.tasks.find((item) => item.id === task.id)?.status ===
        "succeeded",
    ),
  );
  assert.equal(f.saved.tasks[0].result.words, 2);
  assert.equal(f.saved.tasks[1].result.text, "synthetic");
  await until(async () =>
    Object.values(
      await loadJson(resolve(one.directory, "journal.json"), {}),
    ).every((task) => task.acknowledged),
  );
  assert.equal(
    f.controller.snapshot().workers.filter((w) => w.status === "ready").length,
    2,
  );
});

test("stable tool intent and duplicate MQTT delivery do not execute an action twice", async (t) => {
  const f = await fixture(t),
    one = await f.add("One");
  const args = {
    workerId: one.id,
    action: "demo.echo",
    input: { text: "once" },
    intentKey: "stable-call",
  };
  const first = await f.controller.dispatch(args);
  await until(() => f.controller.state.tasks[0].status === "succeeded");
  const before = await loadJson(resolve(one.directory, "journal.json"), {});
  await f.controller.send(
    one.id,
    "dispatch",
    {
      action: "demo.echo",
      input: { text: "twice" },
      deadline: Date.now() + 30000,
    },
    first.id,
  );
  const again = await f.controller.dispatch(args);
  assert.equal(again.id, first.id);
  await delay(150);
  const after = await loadJson(resolve(one.directory, "journal.json"), {});
  assert.equal(after[first.id].finishedAt, before[first.id].finishedAt);
  assert.equal(after[first.id].result.text, "once");
  assert.equal(f.saved.tasks.length, 1);
});

test("cancel needs worker confirmation, pause blocks dispatch and unknown is not reassigned", async (t) => {
  const f = await fixture(t),
    one = await f.add("One");
  await f.add("Two");
  const task = await f.controller.dispatch({
    workerId: one.id,
    action: "demo.wait",
    input: { seconds: 30 },
  });
  await until(() => f.controller.state.tasks[0].status === "running");
  await f.controller.cancel(task.id);
  assert.equal(f.controller.state.tasks[0].status, "stop_requested");
  await until(() => f.controller.state.tasks[0].status === "cancelled");
  await f.controller.manage(one.id, "pause");
  await assert.rejects(
    f.controller.dispatch({
      workerId: one.id,
      action: "demo.echo",
      input: { text: "no" },
    }),
  );
  await f.controller.manage(one.id, "resume");
  await f.controller.mutate((state) =>
    state.tasks.push({
      id: randomUUID(),
      workerId: one.id,
      status: "unknown",
      deadline: Date.now() - 1,
    }),
  );
  assert.equal(
    f.controller.snapshot().workers.find((w) => w.id === one.id).status,
    "busy",
  );
  await assert.rejects(
    f.controller.dispatch({
      workerId: one.id,
      action: "demo.echo",
      input: { text: "no" },
    }),
  );
});

test("Host restart recovers completed intent without publishing a second task", async (t) => {
  const f = await fixture(t),
    one = await f.add("One");
  const args = {
    workerId: one.id,
    action: "demo.echo",
    input: { text: "durable" },
    intentKey: "persisted",
  };
  const task = await f.controller.dispatch(args);
  await until(() => f.saved.tasks[0].status === "succeeded");
  await f.restart();
  const same = await f.controller.dispatch(args);
  assert.equal(same.id, task.id);
  assert.equal(f.saved.tasks.length, 1);
});

test("Worker process crash settles in-flight actions as unknown without replay", async (t) => {
  const f = await fixture(t),
    invite = await f.controller.invite("Crash test");
  const data = JSON.parse(Buffer.from(invite.code, "base64url"));
  const directory = resolve(f.directory, invite.worker.id);
  const child = spawn(
    process.execPath,
    [
      resolve("dist/worker.js"),
      "join",
      "--code",
      invite.code,
      "--directory",
      directory,
    ],
    { stdio: "ignore" },
  );
  t.after(() => {
    if (child.exitCode === null && child.signalCode === null)
      child.kill("SIGKILL");
  });
  await until(
    () =>
      f.controller.snapshot().workers.find((w) => w.id === invite.worker.id)
        ?.status === "ready",
  );
  const task = await f.controller.dispatch({
    workerId: invite.worker.id,
    action: "demo.wait",
    input: { seconds: 50 },
  });
  await until(() => f.saved.tasks[0].status === "running");
  const exit = once(child, "exit");
  child.kill("SIGKILL");
  await exit;
  const replacement = await startWorker(
    { ...data, workspace: f.directory, allowShell: false },
    { directory },
  );
  f.workers.push(replacement);
  await until(() => f.saved.tasks[0].status === "unknown");
  assert.equal(f.saved.tasks.length, 1);
  assert.match(f.saved.tasks[0].error, /未重放/);
});

test("workspace paths reject traversal and symlink escape", async (t) => {
  const dir = await mkdtemp(resolve(tmpdir(), "pamiya-path-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(resolve(dir, "work"));
  await mkdir(resolve(dir, "outside"));
  await symlink(resolve(dir, "outside"), resolve(dir, "work", "link"));
  await assert.rejects(safePath(resolve(dir, "work"), "../outside"));
  await assert.rejects(safePath(resolve(dir, "work"), "link/file", true));
  assert.equal(
    await safePath(resolve(dir, "work"), "new.txt", true),
    resolve(await realpath(resolve(dir, "work")), "new.txt"),
  );
});

test("private worker file tools and explicitly allowed shell execute real work", async (t) => {
  const directory = await mkdtemp(resolve(tmpdir(), "pamiya-files-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const exec = {
    workspace: directory,
    allowShell: false,
    signal: new AbortController().signal,
  };
  await executeAction(
    "fs.write",
    { path: "result.txt", text: "Synthetic private file" },
    exec,
  );
  assert.equal(
    (await executeAction("fs.read", { path: "result.txt" }, exec)).text,
    "Synthetic private file",
  );
  assert.equal(
    (await executeAction("fs.list", { path: "." }, exec)).entries[0].name,
    "result.txt",
  );
  await assert.rejects(
    executeAction(
      "shell.run",
      { command: "echo synthetic", timeoutSeconds: 5 },
      exec,
    ),
  );
  const result = await executeAction(
    "shell.run",
    { command: "printf synthetic", timeoutSeconds: 5 },
    { ...exec, allowShell: true },
  );
  assert.equal(result.exitCode, 0);
  assert.equal(result.output, "synthetic");
});

test("DSH default local worker starts once, survives Host restart and respects stop", async (t) => {
  const f = await fixture(t, { autoLocal: true });
  await until(() =>
    f.controller
      .snapshot()
      .workers.some((worker) => worker.local && worker.status === "ready"),
  );
  const worker = f.controller.state.workers.find((item) => item.local);
  assert.equal(f.controller.state.workers.length, 1);
  await f.controller.ensureLocal();
  assert.equal(f.controller.state.workers.length, 1);
  await assert.rejects(f.controller.invite("duplicate", true), /已存在/);
  const task = await f.controller.dispatch({
    workerId: worker.id,
    action: "system.check",
    input: {},
  });
  await until(
    () =>
      f.controller.state.tasks.find((item) => item.id === task.id).status ===
      "succeeded",
  );
  await f.restart();
  await until(
    () =>
      f.controller.snapshot().workers.find((item) => item.id === worker.id)
        ?.status === "ready",
  );
  assert.equal(f.controller.state.workers.length, 1);
  await f.controller.manage(worker.id, "stop");
  await until(() => !f.controller.children.has(worker.id));
  await f.restart();
  await delay(100);
  assert.equal(f.controller.children.size, 0);
  assert.equal(f.controller.state.workers.length, 1);
});

test("already aborted Agent tool never creates a task", async (t) => {
  const f = await fixture(t);
  await f.add("local test");
  await assert.rejects(
    f.controller.toolRun(
      { action: "demo.echo", input: { text: "unused" } },
      { callId: "cancelled", signal: AbortSignal.abort() },
    ),
    { name: "AbortError" },
  );
  assert.equal(f.controller.state.tasks.length, 0);
});

test("local access settings require a private connection and take effect after restart", async (t) => {
  const f = await fixture(t);
  await f.controller.saveBroker({ ...f.config, publicTest: false });
  await until(() => f.controller.connection.status === "connected");
  const invite = await f.controller.invite("Private local", true);
  const id = invite.worker.id;
  await until(
    () =>
      f.controller.snapshot().workers.find((worker) => worker.id === id)
        ?.status === "ready",
  );
  await f.controller.configureLocal(id, {
    workspace: f.directory,
    allowShell: true,
  });
  await until(() =>
    f.controller
      .snapshot()
      .workers.find((worker) => worker.id === id)
      ?.actions?.includes("shell.run"),
  );
  const task = await f.controller.dispatch({
    workerId: id,
    action: "shell.run",
    input: { command: "printf configured", timeoutSeconds: 5 },
  });
  await until(
    () =>
      f.controller.state.tasks.find((item) => item.id === task.id)?.status ===
      "succeeded",
  );
  assert.equal(
    f.controller.state.tasks.find((item) => item.id === task.id).result.output,
    "configured",
  );
  await assert.rejects(
    f.controller.configureLocal(id, {
      workspace: resolve(f.directory, "missing"),
      allowShell: false,
    }),
    /ENOENT/,
  );
  assert.equal(f.controller.children.size, 1);
});

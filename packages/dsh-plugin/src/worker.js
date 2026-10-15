import mqtt from "mqtt";
import { randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  writeFile,
  rename,
  realpath,
  readdir,
  stat,
} from "node:fs/promises";
import { dirname, resolve, relative, isAbsolute } from "node:path";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import {
  brokerSchema,
  demoActions,
  privateActions,
  options,
  topic,
  seal,
  open,
  packet,
  validateInput,
  errorText,
} from "./protocol.js";

export async function atomicJson(path, value) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(value), { mode: 0o600 });
  await rename(temporary, path);
}
export async function loadJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}
export async function safePath(root, input, writing = false) {
  const base = await realpath(root);
  const target = resolve(base, input);
  const parent = writing
    ? await realpath(dirname(target))
    : await realpath(target);
  const contained = (value) => {
    const rel = relative(base, value);
    return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
  };
  if (!contained(target) || !contained(parent))
    throw new Error("文件必须位于该节点授权的工作目录内");
  if (writing) {
    try {
      if (!contained(await realpath(target)))
        throw new Error("不能通过符号链接写入工作目录之外");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return target;
}
export async function executeAction(
  action,
  input,
  { signal, workspace, allowShell },
) {
  signal.throwIfAborted();
  if (action === "system.check")
    return {
      ok: true,
      platform: process.platform,
      node: process.versions.node,
    };
  if (action === "demo.echo") return { text: input.text };
  if (action === "text.stats")
    return {
      characters: [...input.text].length,
      lines: input.text.split("\n").length,
      words: input.text.trim() ? input.text.trim().split(/\s+/u).length : 0,
    };
  if (action === "demo.wait") {
    await delay(input.seconds * 1000, undefined, { signal });
    return { waitedSeconds: input.seconds };
  }
  if (action === "fs.list") {
    const entries = await readdir(await safePath(workspace, input.path), {
      withFileTypes: true,
    });
    return {
      entries: entries.slice(0, 200).map((entry) => ({
        name: entry.name,
        type: entry.isDirectory()
          ? "directory"
          : entry.isSymbolicLink()
            ? "link"
            : "file",
      })),
      truncated: entries.length > 200,
    };
  }
  if (action === "fs.read") {
    const path = await safePath(workspace, input.path);
    if ((await stat(path)).size > 24000)
      throw new Error("文件超过 24 KB，请缩小内容");
    return { text: await readFile(path, { encoding: "utf8", signal }) };
  }
  if (action === "fs.write") {
    const path = await safePath(workspace, input.path, true);
    await writeFile(path, input.text, { encoding: "utf8", signal });
    return { written: Buffer.byteLength(input.text), path: input.path };
  }
  if (action === "shell.run") {
    if (!allowShell) throw new Error("该节点未允许执行命令");
    return new Promise((resolveResult, reject) => {
      const child = spawn(input.command, {
        cwd: workspace,
        shell: true,
        detached: process.platform !== "win32",
        stdio: ["ignore", "pipe", "pipe"],
      });
      let output = "",
        stopped = false,
        killTimer;
      const append = (chunk) => {
        output = (output + chunk.toString()).slice(-24000);
      };
      child.stdout.on("data", append);
      child.stderr.on("data", append);
      const kill = () => {
        stopped = true;
        try {
          if (process.platform !== "win32") process.kill(-child.pid, "SIGTERM");
          else child.kill("SIGTERM");
        } catch {}
        killTimer ??= setTimeout(() => {
          try {
            if (process.platform !== "win32")
              process.kill(-child.pid, "SIGKILL");
            else child.kill("SIGKILL");
          } catch {}
        }, 3000);
      };
      const timer = setTimeout(kill, input.timeoutSeconds * 1000);
      const hardStop = setTimeout(
        () => {
          if (stopped) {
            try {
              if (process.platform !== "win32")
                process.kill(-child.pid, "SIGKILL");
              else child.kill("SIGKILL");
            } catch {}
          }
        },
        (input.timeoutSeconds + 3) * 1000,
      );
      signal.addEventListener("abort", kill, { once: true });
      const cleanup = () => {
        clearTimeout(timer);
        clearTimeout(hardStop);
        clearTimeout(killTimer);
        signal.removeEventListener("abort", kill);
      };
      child.once("error", (error) => {
        cleanup();
        reject(error);
      });
      child.once("close", (code) => {
        cleanup();
        if (stopped)
          reject(new Error("命令进程已停止；此前产生的修改不会自动撤销"));
        else resolveResult({ exitCode: code, output });
      });
    });
  }
  throw new Error("未知能力");
}

export async function startWorker(
  configuration,
  { directory, onState = () => {} } = {},
) {
  const config = {
    ...configuration,
    broker: brokerSchema.parse(configuration.broker),
  };
  const bootId = randomUUID();
  const journalPath = resolve(directory, "journal.json");
  const journal = await loadJson(journalPath, {});
  for (const task of Object.values(journal))
    if (task.status === "running") {
      task.status = "unknown";
      task.error = "节点重启，执行结果待核对；未重放动作";
    }
  await atomicJson(journalPath, journal);
  let chain = Promise.resolve(),
    stopping = false;
  const save = () => {
    const snapshot = JSON.parse(JSON.stringify(journal));
    const next = chain.then(() => atomicJson(journalPath, snapshot));
    chain = next.catch(() => {});
    return next;
  };
  const active = new Map(),
    jobs = new Set();
  const client = mqtt.connect(
    options(
      config.broker,
      `pamiya-worker-${config.workerId}-${bootId.slice(0, 8)}`,
    ),
  );
  const actions = config.broker.publicTest
    ? demoActions
    : privateActions.filter(
        (action) => action !== "shell.run" || config.allowShell,
      );
  const publish = async (kind, payload, taskId) => {
    if (client.connected)
      await client.publishAsync(
        topic(config.broker, config.workerId, "up"),
        seal(
          config.broker,
          config.workerId,
          config.key,
          "up",
          packet(config.workerId, bootId, kind, payload, taskId),
        ),
        { qos: 1, retain: false },
      );
  };
  const status = () =>
    publish("status", {
      label: config.label,
      platform: process.platform,
      actions,
      capacity: 1,
      active: active.size,
    });
  async function sendResult(taskId) {
    const entry = journal[taskId];
    if (entry && entry.status !== "running") {
      const payload =
        Buffer.byteLength(JSON.stringify(entry)) > 48000
          ? {
              ...entry,
              result: {
                truncated: true,
                preview: JSON.stringify(entry.result).slice(0, 4000),
              },
            }
          : entry;
      await publish("result", payload, taskId);
    }
  }
  async function dispatch(message) {
    if (!message.taskId) return;
    const id = message.taskId;
    if (journal[id]) {
      if (journal[id].status === "running") await publish("accepted", {}, id);
      else await sendResult(id);
      return;
    }
    const { action, input, deadline } = message.payload ?? {};
    if (
      message.bootId !== bootId ||
      !Number.isFinite(deadline) ||
      Date.now() > deadline
    )
      return;
    let validated;
    try {
      if (!actions.includes(action)) throw new Error("节点未开放这项能力");
      validated = validateInput(action, input, config.broker.publicTest);
    } catch (error) {
      await publish(
        "result",
        { status: "failed", error: errorText(error) },
        id,
      );
      return;
    }
    if (active.size >= 1) {
      await publish(
        "result",
        { status: "failed", error: "节点正忙，请在完成后重试" },
        id,
      );
      return;
    }
    const abort = new AbortController();
    active.set(id, abort);
    journal[id] = { status: "running", action, bootId, startedAt: Date.now() };
    try {
      await save();
      await publish("accepted", {}, id);
      await status();
      const result = await executeAction(action, validated, {
        signal: abort.signal,
        workspace: config.workspace,
        allowShell: config.allowShell,
      });
      journal[id] = {
        ...journal[id],
        status:
          action === "shell.run" && result.exitCode !== 0
            ? "failed"
            : "succeeded",
        result,
        ...(action === "shell.run" && result.exitCode !== 0
          ? { error: `命令退出码：${result.exitCode}` }
          : {}),
        finishedAt: Date.now(),
      };
    } catch (error) {
      journal[id] = {
        ...journal[id],
        status: abort.signal.aborted
          ? action === "shell.run" || action === "fs.write"
            ? "unknown"
            : "cancelled"
          : "failed",
        error: errorText(error),
        finishedAt: Date.now(),
      };
    } finally {
      active.delete(id);
    }
    await save();
    await sendResult(id);
    await status();
  }
  let incoming = Promise.resolve();
  client.on("message", (_name, data) => {
    if (stopping) return;
    let message;
    try {
      message = open(config.broker, config.workerId, config.key, "down", data);
    } catch {
      return;
    }
    if (message.kind === "cancel") {
      active.get(message.taskId)?.abort();
      if (!active.has(message.taskId))
        void sendResult(message.taskId).catch(() => {});
      return;
    }
    if (message.kind === "dispatch") {
      incoming = incoming
        .then(() => {
          const job = dispatch(message).catch((error) =>
            onState({ status: "error", error: errorText(error) }),
          );
          jobs.add(job);
          void job.finally(() => jobs.delete(job));
        })
        .catch(() => {});
    }
    if (message.kind === "query") {
      void sendResult(message.taskId).catch(() => {});
    }
    if (message.kind === "resultAck" && journal[message.taskId]) {
      journal[message.taskId].acknowledged = true;
      void save().catch((error) =>
        onState({ status: "error", error: errorText(error) }),
      );
    }
  });
  client.on("connect", () => {
    void (async () => {
      await client.subscribeAsync(
        topic(config.broker, config.workerId, "down"),
        { qos: 1 },
      );
      await status();
      for (const [id, task] of Object.entries(journal))
        if (task.status !== "running" && !task.acknowledged)
          await sendResult(id);
      onState({ status: "connected" });
    })().catch((error) =>
      onState({ status: "error", error: errorText(error) }),
    );
  });
  client.on("error", () =>
    onState({
      status: "error",
      error: "无法连接消息服务，请检查地址、账号或网络",
    }),
  );
  client.on("offline", () => onState({ status: "reconnecting" }));
  const timer = setInterval(() => {
    if (!stopping)
      void (async () => {
        await status();
        for (const [id, task] of Object.entries(journal))
          if (task.status !== "running" && !task.acknowledged)
            await sendResult(id);
      })().catch(() => {});
  }, 5000);
  return {
    bootId,
    client,
    async stop() {
      stopping = true;
      clearInterval(timer);
      for (const abort of active.values()) abort.abort();
      await Promise.allSettled([...jobs]);
      await client.endAsync(true);
      await chain;
    },
  };
}

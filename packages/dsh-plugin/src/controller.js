import mqtt from "mqtt";
import { SkillFileStore } from "./file-store.js";
import { ModelChannel } from "./model-channel.js";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { resolve } from "node:path";
import { readFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import {
  brokerSchema,
  PUBLIC_BROKER,
  options,
  topic,
  open,
  seal,
  packet,
  validateInput,
  errorText,
  terminal,
} from "./protocol.js";
import { atomicJson } from "./worker.js";

export async function runmqttPreset() {
  const response = await fetch("https://runmqtt.com/public-broker", {
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok)
    throw new Error("暂时无法读取测试连接，请稍后重试或手动填写");
  const html = await response.text();
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
  const username = text.match(/Username\s+([\w/-]+)\s+Copy Username/i)?.[1];
  const password = text.match(/Password\s+([\w-]+)\s+Copy Password/i)?.[1];
  if (!username || !password)
    throw new Error("测试服务参数已变更，请打开 RunMQTT 页面填写当前账号");
  return { url: PUBLIC_BROKER, username, password, publicTest: true };
}
export class Controller {
  constructor({
    store,
    secrets,
    home,
    autoLocal = false,
    modelCall,
    skillCatalog,
    onComplete,
    workerFile = fileURLToPath(new URL("../dist/worker.js", import.meta.url)),
  }) {
    this.store = store;
    this.modelCall = modelCall;
    this.skillCatalog = skillCatalog;
    this.onComplete = onComplete;
    this.modelChannels = new Map();
    this.skillChannels = new Map();
    this.secrets = secrets;
    this.fileStore = new SkillFileStore({
      home,
      secrets,
      publicBaseUrl:
        "https://raw.githubusercontent.com/UllrAI/pamiya/d1ebfa71a83c24d5b3b4b919a253e74e15ce4647/assets/skills",
    });
    this.home = home;
    this.autoLocal = autoLocal;
    this.workerFile = workerFile;
    this.state = null;
    this.client = null;
    this.connection = { status: "disconnected" };
    this.live = new Map();
    this.children = new Map();
    this.queue = Promise.resolve();
    this.incoming = Promise.resolve();
    this.closed = false;
  }
  async init() {
    await this.fileStore.init();
    this.state = (await this.store.load()) ?? {
      version: 1,
      broker: {
        url: PUBLIC_BROKER,
        username: "",
        namespace: `sandbox/pamiya/${randomUUID()}`,
        publicTest: true,
      },
      enabled: false,
      workers: [],
      tasks: [],
    };
    this.state.sessionTargets ??= {};
    await this.store.save(this.state);
    this.timer = setInterval(() => {
      void this.tick().catch(() => {});
    }, 2000);
    if (this.autoLocal) await this.ensureLocal();
    if (this.state.enabled) await this.connect();
    for (const worker of this.state.workers)
      if (worker.local && worker.autoStart && !worker.revoked)
        await this.startLocal(worker.id).catch(() => {});
    return this;
  }
  mutate(fn) {
    const next = this.queue.then(async () => {
      const snapshot = structuredClone(this.state);
      const result = await fn(snapshot);
      await this.store.save(snapshot);
      this.state = snapshot;
      return result;
    });
    this.queue = next.catch(() => {});
    return next;
  }
  conversationTarget(sessionId) {
    const workerId = this.state.sessionTargets[sessionId] ?? null;
    return {
      workerId,
      worker:
        this.snapshot().workers.find((worker) => worker.id === workerId) ??
        null,
    };
  }
  async selectTarget(sessionId, workerId) {
    await this.mutate((state) => {
      if (
        workerId &&
        !state.workers.some(
          (worker) => worker.id === workerId && !worker.revoked,
        )
      )
        throw new Error("节点已移除，请重新选择");
      if (workerId) state.sessionTargets[sessionId] = workerId;
      else delete state.sessionTargets[sessionId];
    });
    return this.conversationTarget(sessionId);
  }
  conversationContext(sessionId) {
    const { workerId, worker } = this.conversationTarget(sessionId);
    const instructions =
      "Pamiya tools execute on connected workers. Native DSH bash/file/browser tools still run on the DSH host; never present their results as coming from a remote worker. If a remote worker lacks an action, explain that limitation instead of substituting a host tool.";
    if (!workerId)
      return `${instructions}\nPamiya target: automatic. Use pamiya_workers to resolve a computer explicitly named by the user; omit workerId otherwise (prefers this computer, then an available capable worker).`;
    return `${instructions}\nThe user selected this conversation's Pamiya execution target: ${JSON.stringify({ id: workerId, label: worker?.label ?? null, status: worker?.status ?? "removed", actions: worker?.actions ?? [] })}. Use pamiya_execute without workerId for execution requests on the selected computer. All Pamiya executions in this conversation are bound to this target until the user changes the picker. Do not switch computers or use host tools as a substitute. The selection does not move the Agent or its native tools to that computer.`;
  }
  async broker() {
    return {
      ...this.state.broker,
      password: (await this.secrets.get("broker"))?.password ?? "",
    };
  }
  snapshot() {
    return {
      fileStorage: this.fileStore.snapshot(),
      broker: this.state.broker,
      connection: this.connection,
      workers: this.state.workers.map((worker) => {
        const live = this.live.get(worker.id),
          online =
            (worker.local
              ? this.children.has(worker.id)
              : this.connection.status === "connected") &&
            live &&
            Date.now() - live.at < 18000;
        return {
          ...worker,
          status: worker.revoked
            ? "revoked"
            : worker.paused
              ? "paused"
              : online
                ? this.state.tasks.some(
                    (task) =>
                      task.workerId === worker.id &&
                      ["sent", "running", "stop_requested", "unknown"].includes(
                        task.status,
                      ),
                  )
                  ? "busy"
                  : "ready"
                : worker.paired
                  ? "offline"
                  : "pairing",
          ...(live
            ? {
                lastSeen: live.at,
                platform: live.platform,
                actions: live.actions,
                capabilities: live.capabilities ?? [],
                agents: live.agents ?? [],
                skillSyncVersion: live.skillSyncVersion ?? 0,
                skillSelections: live.skillSelections ?? {},
              }
            : {}),
          workspace: worker.local
            ? worker.workspace ||
              resolve(this.home, "pamiya", "workers", worker.id, "workspace")
            : worker.workspace,
          localRunning: this.children.has(worker.id),
        };
      }),
      tasks: [...this.state.tasks].reverse().slice(0, 200),
    };
  }
  async saveBroker(input) {
    const prior = await this.broker();
    const config = brokerSchema.parse({
      ...input,
      password: input.password === undefined ? prior.password : input.password,
      namespace: this.state.broker.namespace,
    });
    const active = this.state.tasks.some((task) =>
      ["sent", "running", "stop_requested"].includes(task.status),
    );
    if (active) throw new Error("还有任务正在执行，请先完成或停止后再修改连接");
    await this.secrets.set("broker", { password: config.password });
    const { password, ...visible } = config;
    await this.mutate((state) => {
      state.broker = visible;
      state.enabled = true;
    });
    await this.connect();
    for (const worker of this.state.workers)
      if (worker.local && worker.autoStart && !worker.revoked) {
        const child = this.children.get(worker.id);
        if (child) {
          await new Promise((done) => {
            child.once("exit", done);
            child.kill("SIGTERM");
          });
        }
        await this.startLocal(worker.id);
      }
    return this.snapshot();
  }
  async connect() {
    if (this.client) {
      await this.client.endAsync(true);
      this.client = null;
    }
    if (this.closed) return;
    this.connection = { status: "connecting" };
    const config = await this.broker();
    const client = mqtt.connect(options(config, `pamiya-host-${randomUUID()}`));
    this.client = client;
    client.on("connect", () => {
      void (async () => {
        await client.subscribeAsync(`${config.namespace}/workers/+/up`, {
          qos: 1,
        });
        if (this.client !== client || this.closed) return;
        this.connection = { status: "connected" };
        if (this.autoLocal) await this.ensureLocal();
        for (const task of this.state.tasks)
          if (
            ["sent", "running", "stop_requested", "unknown"].includes(
              task.status,
            )
          )
            await this.send(
              task.workerId,
              task.status === "stop_requested" ? "cancel" : "query",
              {},
              task.id,
            );
      })().catch(() => {
        this.connection = {
          status: "error",
          error: "连接已建立，但订阅失败，请检查 topic 权限",
        };
      });
    });
    client.on("offline", () => {
      if (this.client === client) this.connection = { status: "reconnecting" };
    });
    client.on("error", () => {
      if (this.client === client)
        this.connection = {
          status: "error",
          error: "无法连接，请检查网络、地址和账号；测试服务账号可能已轮换",
        };
    });
    client.on("message", (name, data) => {
      this.incoming = this.incoming
        .then(() => this.receive(config, name, data))
        .catch(() => {});
    });
  }
  async send(workerId, kind, payload, taskId) {
    const key = (await this.secrets.get(`worker-${workerId}`))?.key;
    const worker = this.state.workers.find(
      (item) => item.id === workerId && !item.revoked,
    );
    if (!key || !worker) throw new Error("节点已移除或配对信息不存在");
    const config = await this.broker();
    const value = seal(
      config,
      workerId,
      key,
      "down",
      packet(
        workerId,
        this.live.get(workerId)?.bootId ?? randomUUID(),
        kind,
        payload,
        taskId,
      ),
    );
    if (worker.local) {
      const child = this.children.get(workerId);
      if (!child?.connected) throw new Error("本机节点尚未启动");
      await new Promise((done, reject) =>
        child.send(
          {
            type: "pamiya-host",
            topic: topic(config, workerId, "down"),
            data: value.toString("base64"),
          },
          (error) => (error ? reject(error) : done()),
        ),
      );
      return;
    }
    if (!this.client?.connected) throw new Error("连接尚未就绪");
    await this.client.publishAsync(topic(config, workerId, "down"), value, {
      qos: 1,
      retain: false,
    });
  }
  async receive(config, name, data) {
    const workerId = name.split("/").at(-2);
    const worker = this.state.workers.find(
      (item) => item.id === workerId && !item.revoked,
    );
    if (!worker) return;
    const key = (await this.secrets.get(`worker-${workerId}`))?.key;
    if (!key) return;
    let message;
    try {
      message = open(config, workerId, key, "up", data);
    } catch {
      return;
    }
    if (message.kind === "status") {
      const payload = message.payload;
      if (
        !payload ||
        !Array.isArray(payload.actions) ||
        payload.actions.some((action) => typeof action !== "string") ||
        payload.actions.length > 64
      )
        return;
      if (!worker.paired && worker.expiresAt < Date.now()) return;
      const previous = this.live.get(workerId);
      if (previous && previous.emittedAt > message.at) return;
      this.live.set(workerId, {
        ...payload,
        at: Date.now(),
        emittedAt: message.at,
        bootId: message.bootId,
      });
      if (!worker.paired)
        await this.mutate((state) => {
          state.workers.find((item) => item.id === workerId).paired = true;
        });
      if (!previous || previous.bootId !== message.bootId)
        for (const task of this.state.tasks)
          if (
            task.workerId === workerId &&
            !["succeeded", "failed", "cancelled"].includes(task.status)
          )
            await this.send(workerId, "query", {}, task.id);
      return;
    }
    const task = this.state.tasks.find(
      (item) => item.id === message.taskId && item.workerId === workerId,
    );
    if (!task) return;
    if (message.kind === "files") {
      if (
        !["sent", "running"].includes(task.status) ||
        message.bootId !== task.bootId
      )
        return;
      let channel = this.skillChannels.get(workerId);
      if (!channel) {
        channel = new ModelChannel({
          send: (frame, id) => this.send(workerId, "files", frame, id),
          handle: async (request, id, signal) => {
            const current = this.state.tasks.find(
              (item) => item.id === id && item.workerId === workerId,
            );
            if (
              !current ||
              !["sent", "running"].includes(current.status) ||
              !current.input.skills?.some((ref) => ref.hash === request.hash)
            )
              throw new Error("任务没有选择这个 Skill 版本");
            signal.throwIfAborted();
            const bundle = await this.skillCatalog.bundle(request.hash);
            if (!bundle) throw new Error("Skill 快照已缺失，请重新发起任务");
            return this.fileStore.reference({
              bundle,
              workerId,
              key,
              local: worker.local,
              publicTest: config.publicTest,
              signal,
            });
          },
        });
        this.skillChannels.set(workerId, channel);
      }
      await channel.receive(message.payload, task.id);
      return;
    }
    if (message.kind === "model") {
      if (
        !["sent", "running"].includes(task.status) ||
        task.input.modelSource === "independent" ||
        !task.modelRoute ||
        message.bootId !== task.bootId
      )
        return;
      let channel = this.modelChannels.get(workerId);
      if (!channel) {
        channel = new ModelChannel({
          send: (frame, id) => this.send(workerId, "model", frame, id),
          handle: (request, id, signal) => {
            const current = this.state.tasks.find(
              (item) => item.id === id && item.workerId === workerId,
            );
            if (!current || !["sent", "running"].includes(current.status))
              throw new Error("任务已结束");
            return this.modelCall(current.modelRoute, request, signal);
          },
        });
        this.modelChannels.set(workerId, channel);
      }
      await channel.receive(message.payload, task.id);
      return;
    }
    if (
      message.kind === "progress" &&
      message.bootId === task.bootId &&
      !terminal.has(task.status)
    ) {
      await this.mutate((state) => {
        const current = state.tasks.find((item) => item.id === task.id);
        current.progress = {
          phase: String(message.payload?.phase ?? "running").slice(0, 160),
          text:
            typeof message.payload?.text === "string"
              ? message.payload.text.slice(-2000)
              : "",
          at: Date.now(),
        };
      });
      return;
    }
    if (message.kind === "accepted") {
      if (message.bootId !== task.bootId || task.status !== "sent") return;
      await this.mutate((state) => {
        const current = state.tasks.find((item) => item.id === task.id);
        if (current.status === "sent") {
          current.status = "running";
          current.updatedAt = Date.now();
        }
      });
    }
    if (message.kind === "result") {
      const result = message.payload;
      if (
        !result ||
        ![
          "succeeded",
          "failed",
          "cancelled",
          "unknown",
          "needs_preparation",
        ].includes(result.status)
      )
        return;
      if ((result.preparationRevision ?? 0) !== (task.preparationRevision ?? 0))
        return;
      // A restarted Worker may only settle a previous boot from its durable journal.
      if (message.bootId !== task.bootId && result.bootId !== task.bootId)
        return;
      await this.mutate((state) => {
        const current = state.tasks.find((item) => item.id === task.id);
        if (["succeeded", "failed", "cancelled"].includes(current.status))
          return;
        if (current.status !== result.status && current.callbackDelivered) {
          current.callbackDelivered = false;
          current.callbackRevision = (current.callbackRevision ?? 0) + 1;
        }
        current.status = result.status;
        current.result = result.result ?? null;
        current.error =
          typeof result.error === "string" ? result.error.slice(0, 2000) : "";
        current.updatedAt = Date.now();
      });
      await this.send(
        workerId,
        "resultAck",
        { preparationRevision: task.preparationRevision ?? 0 },
        task.id,
      );
    }
  }
  async ensureLocal() {
    if (this.localSetup) return this.localSetup;
    this.localSetup = (async () => {
      const existing = this.state.workers.find(
        (worker) => worker.local && !worker.revoked,
      );
      if (existing) return existing;
      return (await this.invite("这台电脑", true)).worker;
    })();
    try {
      return await this.localSetup;
    } finally {
      this.localSetup = null;
    }
  }
  async invite(label, local = false) {
    if (!local && this.connection.status !== "connected")
      throw new Error("请先完成连接设置");
    if (
      local &&
      this.state.workers.some((worker) => worker.local && !worker.revoked)
    )
      throw new Error("本机节点已存在，可在节点卡片中启动或恢复分配");
    const worker = {
      id: randomUUID(),
      label,
      local,
      autoStart: local,
      paired: false,
      paused: false,
      revoked: false,
      expiresAt: Date.now() + 30 * 60 * 1000,
      createdAt: Date.now(),
    };
    const key = randomBytes(32).toString("base64url");
    await this.secrets.set(`worker-${worker.id}`, { key });
    await this.mutate((state) => {
      state.workers.push(worker);
    });
    const code = Buffer.from(
      JSON.stringify({
        v: 1,
        workerId: worker.id,
        key,
        label,
        expiresAt: worker.expiresAt,
        broker: await this.broker(),
      }),
    ).toString("base64url");
    if (local) await this.startLocal(worker.id);
    return { worker, code };
  }
  async reissue(id) {
    const worker = this.state.workers.find(
      (item) => item.id === id && !item.revoked && !item.local,
    );
    if (!worker) throw new Error("未找到远程节点");
    const key = (await this.secrets.get(`worker-${id}`))?.key;
    if (!key) throw new Error("节点配对信息不存在");
    const expiresAt = Date.now() + 30 * 60 * 1000;
    await this.mutate((state) => {
      state.workers.find((item) => item.id === id).expiresAt = expiresAt;
    });
    return {
      worker: { ...worker, expiresAt },
      code: Buffer.from(
        JSON.stringify({
          v: 1,
          workerId: id,
          key,
          label: worker.label,
          expiresAt,
          broker: await this.broker(),
        }),
      ).toString("base64url"),
    };
  }
  async startLocal(id) {
    if (this.children.has(id)) return;
    const worker = this.state.workers.find(
      (item) => item.id === id && item.local && !item.revoked,
    );
    if (!worker) throw new Error("本机节点不存在");
    const config = { ...(await this.broker()) };
    const key = (await this.secrets.get(`worker-${id}`))?.key;
    const directory = resolve(this.home, "pamiya", "workers", id);
    const workspace = worker.workspace || resolve(directory, "workspace");
    await mkdir(workspace, { recursive: true, mode: 0o700 });
    await atomicJson(resolve(directory, "config.json"), {
      workerId: id,
      key,
      label: worker.label,
      broker: config,
      workspace,
      allowShell: Boolean(worker.allowShell),
    });
    // Desktop owns a Node-compatible Electron executable; preserve its runtime mode.
    const child = spawn(
      process.execPath,
      [this.workerFile, "start", "--directory", directory, "--managed-local"],
      {
        env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
        stdio: ["ignore", "pipe", "pipe", "ipc"],
      },
    );
    this.children.set(id, child);
    child.on("message", (message) => {
      if (message?.type !== "pamiya-worker") return;
      this.incoming = this.incoming
        .then(() =>
          this.receive(
            config,
            message.topic,
            Buffer.from(message.data, "base64"),
          ),
        )
        .catch(() => {});
    });
    child.stdout.on("data", () => {});
    child.stderr.on("data", () => {});
    child.once("exit", () => {
      this.children.delete(id);
      this.live.delete(id);
    });
    child.once("error", () => {
      this.children.delete(id);
    });
    await this.mutate((state) => {
      state.workers.find((item) => item.id === id).autoStart = true;
    });
  }
  async configureLocal(id, { workspace, allowShell }) {
    const worker = this.state.workers.find(
      (item) => item.id === id && item.local && !item.revoked,
    );
    if (!worker) throw new Error("未找到本机节点");
    // Resolve before stopping: an invalid directory must leave the current worker intact.
    const { realpath, stat } = await import("node:fs/promises");
    const directory = await realpath(resolve(workspace));
    if (!(await stat(directory)).isDirectory())
      throw new Error("请选择一个已有文件夹");
    await this.mutate((state) => {
      if (
        state.tasks.some(
          (task) =>
            task.workerId === id &&
            ["sent", "running", "stop_requested", "unknown"].includes(
              task.status,
            ),
        )
      )
        throw new Error("请先完成或核对这个节点的任务，再修改能力");
      const current = state.workers.find((item) => item.id === id);
      current.workspace = directory;
      current.allowShell = allowShell;
      current.paused = true;
    });
    const child = this.children.get(id);
    if (child)
      await new Promise((done) => {
        child.once("exit", done);
        if (!child.kill("SIGTERM")) done();
      });
    await this.startLocal(id);
    await this.mutate((state) => {
      state.workers.find((item) => item.id === id).paused = worker.paused;
    });
    return this.snapshot();
  }
  async manage(id, action, label) {
    const worker = this.state.workers.find((item) => item.id === id);
    if (!worker) throw new Error("未找到节点");
    if (action === "start") {
      await this.startLocal(id);
      return this.snapshot();
    }
    if (action === "query") {
      for (const task of this.state.tasks)
        if (
          task.workerId === id &&
          ["unknown", "running", "stop_requested", "sent"].includes(task.status)
        )
          await this.send(id, "query", {}, task.id);
      return this.snapshot();
    }
    if (
      action === "remove" &&
      this.state.tasks.some(
        (task) =>
          task.workerId === id &&
          ["sent", "running", "stop_requested", "unknown"].includes(
            task.status,
          ),
      )
    )
      throw new Error("这个节点仍有在途或待核对任务，请先核对结果后移除");
    await this.mutate((state) => {
      const current = state.workers.find((item) => item.id === id);
      if (action === "rename") current.label = label;
      if (action === "pause") current.paused = true;
      if (action === "resume") current.paused = false;
      if (action === "remove") {
        current.revoked = true;
        current.autoStart = false;
      }
      if (action === "stop") current.autoStart = false;
    });
    if (action === "remove") await this.secrets.delete?.(`worker-${id}`);
    if (action === "remove" || action === "stop") {
      this.children.get(id)?.kill("SIGTERM");
      this.live.delete(id);
    }
    return this.snapshot();
  }
  async dispatch({
    workerId,
    action,
    input,
    intentKey,
    sessionId,
    modelRoute,
    callback = false,
  }) {
    if (intentKey) {
      const existing = this.state.tasks.find(
        (task) => task.intentKey === intentKey,
      );
      if (existing) return existing;
    }
    if (Buffer.byteLength(JSON.stringify(input)) > 24000)
      throw new Error("输入超过 24 KB，请缩小内容");
    const candidates = this.snapshot().workers.filter(
      (worker) =>
        worker.status === "ready" &&
        worker.actions?.includes(action) &&
        (!workerId || worker.id === workerId),
    );
    if (!candidates.length)
      throw new Error(
        workerId
          ? "所选节点离线、暂停、正忙或未提供该能力"
          : "没有可用节点，请先添加节点或等待当前任务完成",
      );
    const worker = candidates.find((worker) => worker.local) ?? candidates[0],
      live = this.live.get(worker.id);
    input = validateInput(
      action,
      input,
      !worker.local && this.state.broker.publicTest,
      live.capabilities ?? [],
    );
    if (["agent.run", "agent.demo"].includes(action)) {
      const agent = live.agents?.find((item) => item.id === input.agent);
      if (!agent?.installed || !agent.enabled)
        throw new Error("请先安装并启用所选 Agent");
      input.modelSource =
        action === "agent.demo"
          ? "inherit"
          : (input.modelSource ?? agent.modelSource ?? "inherit");
      if (input.modelSource === "inherit" && !modelRoute)
        throw new Error("请先在 DSH 选择模型");
      input.modelRoute = modelRoute;
    }
    if (["agent.run", "agent.demo", "skills.prepare"].includes(action)) {
      const selection =
        input.skills ??
        live.skillSelections?.[input.agent]?.map((ref) => ref.id) ??
        [];
      if (selection.length && live.skillSyncVersion !== 2)
        throw new Error("请先更新此节点的 Worker，再使用 Skills 同步");
      if (selection.some((id) => typeof id !== "string"))
        throw new Error("请选择能力列表中的 Skill ID，不能自行构造快照");
      const priorSession =
        input.sessionRef && input.skills === undefined
          ? [...this.state.tasks]
              .reverse()
              .find(
                (task) =>
                  task.workerId === worker.id &&
                  task.input.agent === input.agent &&
                  task.result?.sessionRef === input.sessionRef,
              )
          : null;
      input.skills = priorSession
        ? structuredClone(priorSession.input.skills ?? [])
        : selection.length
          ? await this.skillCatalog.snapshot(selection, { sessionId })
          : [];
      if (
        !worker.local &&
        this.state.broker.publicTest &&
        input.skills.some((ref) => !ref.synthetic)
      )
        throw new Error(
          "公共连接只验证内置合成 Skill；个人 Skills 请使用本地或私有连接",
        );
      if (Buffer.byteLength(JSON.stringify(input)) > 24000)
        throw new Error("所选 Skills 的依赖声明过大，请减少本次选择");
    }
    const task = {
      id: randomUUID(),
      intentKey: intentKey ?? randomUUID(),
      sessionId: sessionId ?? null,
      modelRoute: modelRoute ?? null,
      callback,
      workerId: worker.id,
      workerLabel: worker.label,
      bootId: live.bootId,
      attempt: 1,
      action,
      input,
      status: "sent",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deadline:
        Date.now() +
        (input.skills?.length
          ? (input.timeoutSeconds ?? 600) + 1230
          : action === "agent.install" || input.installDependencies
            ? 1230
            : ["agent.run", "agent.demo"].includes(action)
              ? (input.timeoutSeconds ?? 600) + 30
              : action.startsWith("custom.")
                ? (live.capabilities?.find((item) => item.name === action)
                    ?.timeoutSeconds ?? 120) + 30
                : 120) *
          1000,
    };
    const saved = await this.mutate((state) => {
      const existing = state.tasks.find(
        (item) => item.intentKey === task.intentKey,
      );
      if (existing) return existing;
      const currentWorker = state.workers.find((item) => item.id === worker.id);
      if (
        !currentWorker ||
        currentWorker.revoked ||
        currentWorker.paused ||
        this.live.get(worker.id)?.bootId !== live.bootId
      )
        throw new Error("节点状态已变化，请重新选择节点");
      if (
        state.tasks.some(
          (item) =>
            item.workerId === worker.id &&
            ["sent", "running", "stop_requested", "unknown"].includes(
              item.status,
            ),
        )
      )
        throw new Error("节点刚接到其他任务，请稍后重试");
      state.tasks.push(task);
      return task;
    });
    if (saved.id !== task.id) return saved;
    try {
      await this.send(
        worker.id,
        "dispatch",
        { action, input, deadline: task.deadline },
        task.id,
      );
    } catch {
      await this.mutate((state) => {
        const current = state.tasks.find((item) => item.id === task.id);
        current.status = "unknown";
        current.error = "发送未得到确认，结果待核对；未重放动作";
      });
    }
    return this.state.tasks.find((item) => item.id === task.id);
  }
  async continueTask(id) {
    const task = this.state.tasks.find((item) => item.id === id);
    if (!task || task.status !== "needs_preparation")
      throw new Error("只有等待准备的任务可以继续");
    const worker = this.snapshot().workers.find(
      (item) => item.id === task.workerId,
    );
    if (worker?.status !== "ready") throw new Error("请等待原节点可用后继续");
    await this.mutate((state) => {
      const current = state.tasks.find((item) => item.id === id);
      if (current.status !== "needs_preparation")
        throw new Error("任务已经继续，请查看当前进度");
      current.status = "sent";
      current.input.installDependencies = true;
      current.preparationRevision = (current.preparationRevision ?? 0) + 1;
      current.bootId = this.live.get(task.workerId).bootId;
      current.deadline =
        Date.now() + ((current.input.timeoutSeconds ?? 600) + 1230) * 1000;
      current.updatedAt = Date.now();
      current.callbackDelivered = false;
      current.callbackRevision = (current.callbackRevision ?? 0) + 1;
    });
    try {
      await this.send(
        task.workerId,
        "continue",
        {
          deadline: this.state.tasks.find((item) => item.id === id).deadline,
          preparationRevision: this.state.tasks.find((item) => item.id === id)
            .preparationRevision,
        },
        id,
      );
    } catch {
      await this.mutate((state) => {
        const current = state.tasks.find((item) => item.id === id);
        current.status = "unknown";
        current.error = "继续请求未获确认，请核对原节点";
      });
    }
    return this.state.tasks.find((item) => item.id === id);
  }
  async cancel(id) {
    const task = this.state.tasks.find((item) => item.id === id);
    if (!task) throw new Error("未找到任务");
    this.modelChannels.get(task.workerId)?.cancelTask(id);
    this.skillChannels.get(task.workerId)?.cancelTask(id);
    if (
      terminal.has(task.status) &&
      !["unknown", "needs_preparation"].includes(task.status)
    )
      return task;
    await this.mutate((state) => {
      const current = state.tasks.find((item) => item.id === id);
      if (
        terminal.has(current.status) &&
        !["unknown", "needs_preparation"].includes(current.status)
      )
        return;
      current.status = "stop_requested";
      current.updatedAt = Date.now();
    });
    if (
      this.state.tasks.find((item) => item.id === id).status !==
      "stop_requested"
    )
      return this.state.tasks.find((item) => item.id === id);
    try {
      await this.send(task.workerId, "cancel", {}, id);
    } catch {}
    return this.state.tasks.find((item) => item.id === id);
  }
  async tick() {
    if (this.closed) return;
    if (this.onComplete && !this.delivering) {
      this.delivering = true;
      try {
        for (const task of this.state.tasks.filter(
          (item) =>
            item.callback &&
            terminal.has(item.status) &&
            !item.callbackDelivered,
        )) {
          try {
            const revision = task.callbackRevision ?? 0;
            if (await this.onComplete(task))
              await this.mutate((state) => {
                const current = state.tasks.find((item) => item.id === task.id);
                if ((current.callbackRevision ?? 0) === revision)
                  current.callbackDelivered = true;
              });
          } catch {
            /* Retry delivery when the originating agent is available. */
          }
        }
      } finally {
        this.delivering = false;
      }
    }
    if (
      this.state.tasks.some(
        (task) =>
          ["sent", "running", "stop_requested"].includes(task.status) &&
          Date.now() > task.deadline,
      )
    )
      await this.mutate((state) => {
        for (const task of state.tasks)
          if (
            ["sent", "running", "stop_requested"].includes(task.status) &&
            Date.now() > task.deadline
          ) {
            task.status = "unknown";
            task.error = "未收到确定结果，请核对节点；不会自动换节点重跑";
            task.updatedAt = Date.now();
          }
      });
  }
  async resolveTask({ id, status, note }) {
    return this.mutate((state) => {
      const task = state.tasks.find((item) => item.id === id);
      if (!task || task.status !== "unknown")
        throw new Error("只有待核对任务可以登记人工结果");
      task.status = status;
      task.verification = { note, at: Date.now() };
      task.updatedAt = Date.now();
    });
  }
  async toolRun(args, exec, { delegate = false, modelRoute } = {}) {
    exec.signal?.throwIfAborted();
    if (
      ["agent.run", "agent.demo", "agent.install", "skills.prepare"].includes(
        args.action,
      ) ||
      args.action.startsWith("custom.")
    )
      delegate = true;
    const sessionId =
      exec.agent?.session?.id ??
      exec.agent?.sessionId ??
      exec.agent?.id ??
      "host";
    if (!exec.callId)
      throw new Error("DSH 未提供稳定工具调用 ID，未分派远程任务");
    const intentKey = createHash("sha256")
      .update(`${sessionId}:${exec.callId}`)
      .digest("hex");
    const selected = this.state.sessionTargets[sessionId];
    // Retries must read the original task, even after the picker changes.
    const existing = this.state.tasks.some(
      (task) => task.intentKey === intentKey,
    );
    if (!existing && selected && args.workerId && args.workerId !== selected)
      throw new Error(
        "本对话已指定执行节点；请使用所选节点，或先在执行节点菜单切换为自动/其他节点",
      );
    let task = await this.dispatch({
      ...args,
      workerId: selected ?? args.workerId,
      input: args.input ?? {},
      intentKey,
      sessionId,
      modelRoute,
      callback: delegate,
    });
    if (delegate)
      return {
        taskId: task.id,
        worker: task.workerLabel,
        status: task.status,
        callback:
          "Result will return to this conversation. Use pamiya_task to inspect or cancel.",
      };
    const cancel = () => {
      void this.cancel(task.id).catch(() => {});
    };
    exec.signal?.addEventListener("abort", cancel, { once: true });
    try {
      if (exec.signal?.aborted) await this.cancel(task.id);
      while (!terminal.has(task.status) && !exec.signal?.aborted) {
        await new Promise((resolveDone) => setTimeout(resolveDone, 300));
        task = this.state.tasks.find((item) => item.id === task.id);
      }
      return {
        taskId: task.id,
        worker: task.workerLabel,
        status: task.status,
        result: task.result ?? null,
        error: task.error ?? "",
      };
    } finally {
      exec.signal?.removeEventListener("abort", cancel);
    }
  }
  async workerDownload() {
    return {
      name: "pamiya-worker.mjs",
      content: (await readFile(this.workerFile)).toString("base64"),
    };
  }
  async close() {
    this.closed = true;
    clearInterval(this.timer);
    await Promise.all(
      [...this.children.values()].map(
        (child) =>
          new Promise((done) => {
            child.once("exit", done);
            if (!child.kill("SIGTERM")) done();
          }),
      ),
    );
    for (const channel of [
      ...this.modelChannels.values(),
      ...this.skillChannels.values(),
    ])
      channel.close();
    await this.client?.endAsync(true);
    await this.queue;
  }
}

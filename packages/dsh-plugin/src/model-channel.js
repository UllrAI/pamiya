import { randomUUID } from "node:crypto";

const PART_BYTES = 16000;
const MAX_BYTES = 4 * 1024 * 1024;

// Model context can exceed an MQTT packet; frame it over the existing encrypted link.
export class ModelChannel {
  constructor({ send, handle }) {
    this.send = send;
    this.handle = handle;
    this.pending = new Map();
    this.receiving = new Map();
    this.running = new Map();
  }
  async transmit(id, phase, value, taskId) {
    const bytes = Buffer.from(JSON.stringify(value));
    if (bytes.length > MAX_BYTES)
      throw new Error("模型上下文超过 4 MB，请精简任务或上下文");
    const total = Math.max(1, Math.ceil(bytes.length / PART_BYTES));
    for (let part = 0; part < total; part++)
      await this.send(
        {
          id,
          phase,
          part,
          total,
          data: bytes
            .subarray(part * PART_BYTES, (part + 1) * PART_BYTES)
            .toString("base64"),
        },
        taskId,
      );
  }
  async request(body, taskId, signal) {
    signal?.throwIfAborted();
    const id = randomUUID();
    return new Promise((resolve, reject) => {
      const finish = (error, value) => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
        this.pending.delete(id);
        error ? reject(error) : resolve(value);
      };
      const abort = () => {
        void this.send({ id, phase: "cancel" }, taskId).catch(() => {});
        finish(new Error("模型请求已取消"));
      };
      const timer = setTimeout(() => {
        abort();
      }, 300000);
      this.pending.set(id, finish);
      signal?.addEventListener("abort", abort, { once: true });
      void this.transmit(id, "request", body, taskId).catch((error) =>
        finish(error),
      );
    });
  }
  async receive(frame, taskId) {
    if (!frame || typeof frame.id !== "string" || frame.id.length > 80) return;
    if (frame.phase === "cancel") {
      this.running.get(frame.id)?.abort();
      return;
    }
    if (
      !["request", "response"].includes(frame.phase) ||
      !Number.isInteger(frame.total) ||
      frame.total < 1 ||
      frame.total > Math.ceil(MAX_BYTES / PART_BYTES) ||
      !Number.isInteger(frame.part) ||
      frame.part < 0 ||
      frame.part >= frame.total ||
      typeof frame.data !== "string" ||
      frame.data.length > 22000
    )
      return;
    const key = `${frame.phase}:${frame.id}`;
    let entry = this.receiving.get(key);
    if (!entry) {
      if (this.receiving.size >= 32) return;
      const timer = setTimeout(() => this.receiving.delete(key), 60000);
      timer.unref?.();
      entry = { total: frame.total, taskId, parts: new Map(), timer };
      this.receiving.set(key, entry);
    }
    if (entry.total !== frame.total || entry.taskId !== taskId) return;
    const part = Buffer.from(frame.data, "base64");
    if (part.length > PART_BYTES) return;
    entry.parts.set(frame.part, part);
    if (entry.parts.size !== entry.total) return;
    clearTimeout(entry.timer);
    this.receiving.delete(key);
    let value;
    try {
      value = JSON.parse(
        Buffer.concat(
          Array.from({ length: entry.total }, (_, i) => entry.parts.get(i)),
        ).toString(),
      );
    } catch {
      return;
    }
    if (frame.phase === "response") {
      this.pending.get(frame.id)?.(
        value.error ? new Error(value.error) : null,
        value.value,
      );
      return;
    }
    if (!this.handle || this.running.has(frame.id)) return;
    const abort = new AbortController();
    abort.taskId = taskId;
    this.running.set(frame.id, abort);
    void (async () => {
      let response;
      try {
        response = { value: await this.handle(value, taskId, abort.signal) };
      } catch (error) {
        response = { error: error.message };
      }
      await this.transmit(frame.id, "response", response, taskId);
    })()
      .catch(() => {})
      .finally(() => {
        // Retain completed IDs briefly so QoS 1 retries never repeat a model call.
        const timer = setTimeout(() => this.running.delete(frame.id), 120000);
        timer.unref?.();
      });
  }
  cancelTask(taskId) {
    for (const abort of this.running.values())
      if (abort.taskId === taskId) abort.abort();
  }
  close() {
    for (const entry of this.receiving.values()) clearTimeout(entry.timer);
    for (const abort of this.running.values()) abort.abort();
    for (const finish of this.pending.values())
      finish(new Error("模型连接已关闭"));
    this.pending.clear();
    this.receiving.clear();
    this.running.clear();
  }
}

import { EventEmitter } from "node:events";

// Keep one worker protocol; managed local workers carry it over Node IPC.
export function localTransport() {
  if (!process.send) throw new Error("本机节点需要由 DSH 托管启动");
  const client = new EventEmitter();
  client.connected = true;
  client.subscribeAsync = async () => {};
  client.publishAsync = async (topic, data) => {
    await new Promise((done, reject) =>
      process.send(
        { type: "pamiya-worker", topic, data: data.toString("base64") },
        (error) => (error ? reject(error) : done()),
      ),
    );
  };
  const receive = (message) => {
    if (message?.type === "pamiya-host")
      client.emit(
        "message",
        message.topic,
        Buffer.from(message.data, "base64"),
      );
  };
  process.on("message", receive);
  client.endAsync = async () => {
    client.connected = false;
    process.off("message", receive);
  };
  queueMicrotask(() => client.emit("connect"));
  return client;
}

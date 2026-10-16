import { createServer } from "node:http";
import { randomBytes, randomUUID } from "node:crypto";
import {
  decodeModelRequest,
  encodeModelResponse,
  responseEvents,
} from "./model-wire.js";

export async function modelGateway({
  call,
  signal,
  model,
  onError = () => {},
}) {
  const token = randomBytes(24).toString("base64url");
  const server = createServer(async (request, response) => {
    if (
      request.headers.authorization !== `Bearer ${token}` &&
      request.headers["x-api-key"] !== token
    )
      return response
        .writeHead(401)
        .end(
          JSON.stringify({ error: { message: "Invalid local model token" } }),
        );
    const path = new URL(request.url, "http://localhost").pathname;
    if (request.method === "GET" && path.endsWith("/models"))
      return response
        .writeHead(200, { "content-type": "application/json" })
        .end(
          JSON.stringify({
            object: "list",
            data: [{ id: model, object: "model", owned_by: "pamiya" }],
          }),
        );
    const abort = new AbortController();
    const cancel = () => abort.abort();
    signal?.addEventListener("abort", cancel, { once: true });
    response.once("close", cancel);
    let heartbeat;
    try {
      request.setEncoding("utf8");
      let raw = "";
      for await (const chunk of request) {
        raw += chunk.toString();
        if (Buffer.byteLength(raw) > 4 * 1024 * 1024)
          throw new Error("模型请求超过 4 MB");
      }
      const body = JSON.parse(raw),
        decoded = decodeModelRequest(path, body);
      if (body.stream) {
        response.writeHead(200, {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
          connection: "keep-alive",
        });
        response.write(": pamiya model connection\n\n");
        heartbeat = setInterval(() => response.write(": keepalive\n\n"), 10000);
      }
      const result = encodeModelResponse(
        decoded,
        await call(decoded.request, abort.signal),
      );
      if (body.stream) {
        for (const event of responseEvents(decoded.kind, result))
          response.write(
            `${event.type ? `event: ${event.type}\n` : ""}data: ${JSON.stringify(event)}\n\n`,
          );
        if (decoded.kind === "chat") response.write("data: [DONE]\n\n");
        response.end();
      } else
        response
          .writeHead(200, { "content-type": "application/json" })
          .end(JSON.stringify(result));
    } catch (error) {
      onError(error);
      const value = {
        type: "error",
        error: {
          type: "pamiya_model_error",
          message: error.message,
          request_id: randomUUID(),
        },
      };
      if (response.headersSent)
        response.end(`event: error\ndata: ${JSON.stringify(value)}\n\n`);
      else
        response
          .writeHead(400, { "content-type": "application/json" })
          .end(JSON.stringify(value));
    } finally {
      clearInterval(heartbeat);
      signal?.removeEventListener("abort", cancel);
      response.off("close", cancel);
    }
  });
  await new Promise((done, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", done);
  });
  return {
    token,
    url: `http://127.0.0.1:${server.address().port}`,
    async close() {
      server.closeAllConnections();
      await new Promise((done) => server.close(done));
    },
  };
}

export async function sharedModelCall(llm, route, request, signal) {
  if (!route?.provider || !route.model)
    throw new Error("当前对话还没有可用模型，请先在 DSH 选择模型");
  const messages = request.messages.map((message) => {
    const { replayState, callId, ...value } = message;
    return {
      ...value,
      id: randomUUID(),
      source:
        message.role === "assistant"
          ? {
              kind: "model",
              provider: route.provider,
              model: route.model,
              ...(replayState ? { replayState } : {}),
            }
          : message.role === "tool"
            ? { kind: "tool", callId }
            : { kind: "user" },
    };
  });
  const result = { blocks: [], finishReason: "stop" };
  for await (const chunk of llm.stream({
    ...request,
    ...route,
    messages,
    signal,
  })) {
    if (chunk.type === "block-end") result.blocks.push(chunk.block);
    if (chunk.type === "usage") result.usage = chunk.usage;
    if (chunk.type === "finish") {
      if (["error", "aborted"].includes(chunk.reason.kind))
        throw new Error(chunk.reason.failure?.message ?? "模型请求失败");
      result.finishReason = chunk.reason.kind;
      result.replayState = chunk.replayState;
    }
  }
  return result;
}

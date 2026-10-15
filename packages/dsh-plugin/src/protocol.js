import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { z } from "zod";

export const VERSION = 1;
export const MAX_MESSAGE = 96 * 1024;
export const PUBLIC_BROKER = "mqtts://public.runmqtt.com:8883";
export const demoActions = [
  "demo.echo",
  "demo.wait",
  "text.stats",
  "system.check",
];
export const privateActions = [
  ...demoActions,
  "fs.list",
  "fs.read",
  "fs.write",
  "shell.run",
];
export const terminal = new Set([
  "succeeded",
  "failed",
  "cancelled",
  "unknown",
]);
export const brokerSchema = z
  .object({
    url: z
      .string()
      .max(500)
      .refine((value) => {
        try {
          const u = new URL(value);
          return (
            ["mqtt:", "mqtts:", "ws:", "wss:"].includes(u.protocol) &&
            !u.username &&
            !u.password
          );
        } catch {
          return false;
        }
      }, "请输入有效的 MQTT 连接地址，不要把密码放在地址中"),
    username: z.string().max(300).default(""),
    password: z.string().max(2000).default(""),
    namespace: z.string().regex(/^sandbox\/pamiya\/[a-zA-Z0-9_-]{12,80}$/),
    publicTest: z.boolean(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      new URL(value.url).hostname === "public.runmqtt.com" &&
      !value.publicTest
    )
      ctx.addIssue({
        code: "custom",
        message: "RunMQTT public broker 仅用于测试，请保留测试模式",
      });
  });
export const messageSchema = z
  .object({
    v: z.literal(VERSION),
    id: z.string().uuid(),
    at: z.number().finite(),
    workerId: z.string().uuid(),
    bootId: z.string().uuid(),
    kind: z.enum([
      "status",
      "dispatch",
      "accepted",
      "result",
      "resultAck",
      "cancel",
      "query",
    ]),
    taskId: z.string().uuid().optional(),
    payload: z.unknown(),
  })
  .strict();
export function packet(workerId, bootId, kind, payload, taskId) {
  return {
    v: VERSION,
    id: randomUUID(),
    at: Date.now(),
    workerId,
    bootId,
    kind,
    payload,
    ...(taskId ? { taskId } : {}),
  };
}
export function topic(config, workerId, direction) {
  return `${config.namespace}/workers/${workerId}/${direction}`;
}
export function seal(config, workerId, key, direction, value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(
    "aes-256-gcm",
    Buffer.from(key, "base64url"),
    iv,
  );
  cipher.setAAD(Buffer.from(`${config.namespace}|${workerId}|${direction}`));
  const data = Buffer.concat([
    cipher.update(JSON.stringify(value)),
    cipher.final(),
  ]);
  if (data.length > 64 * 1024) throw new Error("消息过大，请减小输入或输出");
  return Buffer.from(
    JSON.stringify({
      iv: iv.toString("base64url"),
      data: data.toString("base64url"),
      tag: cipher.getAuthTag().toString("base64url"),
    }),
  );
}
export function open(config, workerId, key, direction, data) {
  if (data.length > MAX_MESSAGE) throw new Error("消息过大");
  const envelope = z
    .object({
      iv: z.string().max(24),
      data: z.string().max(MAX_MESSAGE),
      tag: z.string().max(32),
    })
    .strict()
    .parse(JSON.parse(data));
  const decipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(key, "base64url"),
    Buffer.from(envelope.iv, "base64url"),
  );
  decipher.setAAD(Buffer.from(`${config.namespace}|${workerId}|${direction}`));
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64url"));
  const value = messageSchema.parse(
    JSON.parse(
      Buffer.concat([
        decipher.update(Buffer.from(envelope.data, "base64url")),
        decipher.final(),
      ]).toString(),
    ),
  );
  if (value.workerId !== workerId || Math.abs(Date.now() - value.at) > 120_000)
    throw new Error("消息已过期或不属于该节点");
  return value;
}
export function options(config, clientId) {
  const url = new URL(config.url);
  const protocol = url.protocol.slice(0, -1);
  return {
    protocol,
    hostname: url.hostname,
    host: url.hostname,
    port: Number(
      url.port || { mqtt: 1883, mqtts: 8883, ws: 80, wss: 443 }[protocol],
    ),
    path: url.pathname + url.search,
    clientId,
    username: config.username || undefined,
    password: config.password || undefined,
    protocolVersion: 4,
    clean: true,
    reconnectPeriod: 2500,
    connectTimeout: 10000,
    queueQoSZero: false,
    resubscribe: true,
    rejectUnauthorized: true,
  };
}
export function errorText(error) {
  return error instanceof Error ? error.message : String(error);
}
export function validateInput(action, input, publicTest) {
  const allowed = publicTest ? demoActions : privateActions;
  if (!allowed.includes(action)) throw new Error("此连接或节点未开放这项能力");
  if (action === "demo.echo" || action === "text.stats")
    return z
      .object({ text: z.string().max(12000) })
      .strict()
      .parse(input);
  if (action === "demo.wait")
    return z
      .object({ seconds: z.number().int().min(1).max(90) })
      .strict()
      .parse(input);
  if (action === "fs.list")
    return z
      .object({ path: z.string().max(500).default(".") })
      .strict()
      .parse(input);
  if (action === "fs.read")
    return z
      .object({ path: z.string().min(1).max(500) })
      .strict()
      .parse(input);
  if (action === "fs.write")
    return z
      .object({ path: z.string().min(1).max(500), text: z.string().max(24000) })
      .strict()
      .parse(input);
  if (action === "shell.run")
    return z
      .object({
        command: z.string().min(1).max(4000),
        timeoutSeconds: z.number().int().min(1).max(90).default(30),
      })
      .strict()
      .parse(input);
  return z.object({}).strict().parse(input);
}

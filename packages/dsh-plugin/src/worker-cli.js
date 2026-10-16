import { parseArgs } from "node:util";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { readFile, mkdir, open, unlink } from "node:fs/promises";
import { z } from "zod";
import { startWorker, atomicJson, loadJson } from "./worker.js";
import { brokerSchema, errorText } from "./protocol.js";
import { localTransport } from "./local-transport.js";

export const invitationSchema = z
  .object({
    v: z.literal(1),
    workerId: z.string().uuid(),
    key: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    label: z.string().min(1).max(60),
    expiresAt: z.number(),
    broker: brokerSchema,
  })
  .strict();
export function parseInvitation(code) {
  if (code.length > 12000) throw new Error("配对码过长");
  const invite = invitationSchema.parse(
    JSON.parse(Buffer.from(code.trim(), "base64url").toString()),
  );
  if (invite.expiresAt < Date.now())
    throw new Error("配对码已过期，请回到 Pamiya 重新生成");
  return invite;
}
export async function main(argv = process.argv.slice(2)) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      code: { type: "string" },
      "code-stdin": { type: "boolean" },
      id: { type: "string" },
      directory: { type: "string" },
      workspace: { type: "string" },
      "allow-shell": { type: "boolean" },
      help: { type: "boolean" },
      "managed-local": { type: "boolean" },
    },
  });
  if (values.help || !positionals.length) {
    console.log(
      "Pamiya Worker\n\n连接节点：node pamiya-worker.mjs join --code <配对码>\n重新启动：node pamiya-worker.mjs start --id <节点 ID>\n私有连接可添加 --workspace <目录>，需要命令执行时显式添加 --allow-shell。\n按 Ctrl+C 停止。需要 Node.js 22.19 或更新版本。",
    );
    return;
  }
  let config, directory;
  if (positionals[0] === "join") {
    let code = values.code;
    if (values["code-stdin"]) {
      code = "";
      for await (const chunk of process.stdin) code += chunk.toString();
    }
    if (!code) throw new Error("请从 Pamiya 的“添加节点”复制配对码");
    const invite = parseInvitation(code);
    directory = values.directory
      ? resolve(values.directory)
      : resolve(homedir(), ".pamiya", "workers", invite.workerId);
    const previous = await loadJson(resolve(directory, "config.json"), null);
    if (
      previous &&
      (previous.workerId !== invite.workerId || previous.key !== invite.key)
    )
      throw new Error("目录已经属于其他节点，请选择新目录");
    if (invite.broker.publicTest && (values.workspace || values["allow-shell"]))
      throw new Error(
        "公共测试连接不开放文件与命令能力；请在 Pamiya 中改用私有连接",
      );
    config = {
      ...invite,
      workspace: resolve(values.workspace ?? resolve(directory, "workspace")),
      allowShell: Boolean(values["allow-shell"]),
    };
    await mkdir(config.workspace, { recursive: true, mode: 0o700 });
    await atomicJson(resolve(directory, "config.json"), config);
  } else if (positionals[0] === "start") {
    if (!values.id && !values.directory)
      throw new Error("请提供 --id 或 --directory");
    if (values.id) z.string().uuid().parse(values.id);
    directory = values.directory
      ? resolve(values.directory)
      : resolve(homedir(), ".pamiya", "workers", values.id);
    config = await loadJson(resolve(directory, "config.json"), null);
    if (!config) throw new Error("未找到已配对的节点，请先使用 join");
  } else throw new Error("未知命令，请运行 --help");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const lockPath = resolve(directory, "worker.pid");
  const oldPid = await loadJson(lockPath, null);
  if (oldPid) {
    try {
      process.kill(oldPid, 0);
      throw new Error("这个节点已经在运行，无需重复启动");
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
    await unlink(lockPath);
  }
  const lock = await open(lockPath, "wx", 0o600);
  await lock.writeFile(JSON.stringify(process.pid));
  await lock.close();
  let worker,
    shuttingDown = false;
  const stop = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    await worker?.stop();
    await unlink(lockPath).catch(() => {});
  };
  try {
    worker = await startWorker(config, {
      directory,
      transport: values["managed-local"] ? localTransport : undefined,
      onState: (state) =>
        console.log(
          state.status === "connected"
            ? "已连接，可以回到 Pamiya 体验此节点。"
            : state.status === "error"
              ? state.error
              : "连接中断，正在重连…",
        ),
    });
    console.log(
      `Pamiya · ${config.label}\n节点 ID：${config.workerId}\n${config.broker.publicTest ? "公共测试模式，仅开放演示能力。" : "私有连接。文件能力限制在指定工作目录；命令执行仅在显式允许后开放。"}`,
    );
    if (values["managed-local"])
      process.once("disconnect", () => {
        void stop().then(() => process.exit(0));
      });
    for (const signal of ["SIGINT", "SIGTERM"])
      process.once(signal, () => {
        void stop().then(() => process.exit(0));
      });
  } catch (error) {
    await stop();
    throw error;
  }
}
main().catch((error) => {
  console.error(`Pamiya：${errorText(error)}`);
  process.exitCode = 1;
});

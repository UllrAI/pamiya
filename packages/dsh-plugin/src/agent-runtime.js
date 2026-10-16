import { mkdir, readFile, writeFile, readdir, stat } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { randomUUID } from "node:crypto";
import { runProcess } from "./capabilities.js";
import { modelGateway } from "./model-gateway.js";

export const SYNTHETIC_PROMPT =
  "This is a Pamiya synthetic connectivity test. Do not inspect files, run tools, access the network or change anything. Reply exactly: PAMIYA_AGENT_OK";
const json = async (path, value) =>
  writeFile(path, JSON.stringify(value), { mode: 0o600 });

export function agentEvent(id, row) {
  if (id === "dsh")
    return {
      sessionId: row.type === "session" ? row.sessionId : undefined,
      text: ["text", "final"].includes(row.type) ? row.text : undefined,
      final: row.type === "final",
      error:
        row.type === "status" &&
        row.phase === "turn_end" &&
        row.reason === "error"
          ? "DSH turn failed"
          : undefined,
      phase: row.tool ? `tool: ${row.tool}` : (row.phase ?? row.type),
    };
  if (id === "codex")
    return {
      sessionId: row.thread_id,
      text: row.item?.type === "agent_message" ? row.item.text : undefined,
      final: row.type === "turn.completed",
      error:
        row.type === "turn.failed"
          ? (row.error?.message ?? "Codex turn failed")
          : row.type === "error"
            ? row.message
            : undefined,
      phase: row.item?.type ?? row.type,
    };
  if (id === "claude")
    return {
      sessionId: row.session_id,
      text:
        row.type === "result"
          ? row.result
          : row.type === "assistant"
            ? row.message?.content
                ?.filter((x) => x.type === "text")
                .map((x) => x.text)
                .join("")
            : undefined,
      final: row.type === "result" && !row.is_error,
      error: row.is_error
        ? (row.result ?? row.errors?.join("; ") ?? row.subtype)
        : undefined,
      phase: row.type,
    };
  const message = row.message;
  return {
    text:
      row.type === "message_end" && message?.role === "assistant"
        ? message.content
            ?.filter((x) => x.type === "text")
            .map((x) => x.text)
            .join("")
        : undefined,
    final: row.type === "agent_end",
    error:
      message?.stopReason === "error"
        ? (message.errorMessage ?? "Pi model failed")
        : undefined,
    phase: row.toolName ? `tool: ${row.toolName}` : row.type,
  };
}

export async function runAgent({
  agent,
  input,
  taskId,
  directory,
  workspace,
  publicTest,
  signal,
  modelCall,
  progress = () => {},
}) {
  if (!agent?.installed || !agent.enabled)
    throw new Error("请先在该电脑安装并启用所选 Agent");
  const demo = input.synthetic === true;
  if (publicTest && !demo) throw new Error("公共连接只支持固定合成任务");
  const root = resolve(directory, "sessions");
  await mkdir(root, { recursive: true, mode: 0o700 });
  let session,
    sessionRef = input.sessionRef;
  if (sessionRef) {
    session = JSON.parse(
      await readFile(resolve(root, `${sessionRef}.json`), "utf8"),
    );
    if (
      session.agent !== agent.id ||
      session.synthetic !== demo ||
      session.modelSource !== (input.modelSource ?? agent.modelSource)
    )
      throw new Error("续接任务的 Agent、模型来源和测试模式必须一致");
  } else {
    sessionRef = randomUUID();
    session = {
      agent: agent.id,
      synthetic: demo,
      modelSource: input.modelSource ?? agent.modelSource,
    };
  }
  if (publicTest && session.modelSource !== "inherit")
    throw new Error("公共合成验证请复用 DSH 模型；独立鉴权留在私有连接使用");
  const ownedHome = resolve(root, sessionRef);
  await mkdir(ownedHome, { recursive: true, mode: 0o700 });
  const cwd = demo ? resolve(ownedHome, "sandbox") : workspace;
  await mkdir(cwd, { recursive: true, mode: 0o700 });
  const before = new Map(
    (await readdir(cwd, { withFileTypes: true }))
      .filter((x) => x.isFile())
      .map((x) => [x.name, null]),
  );
  for (const name of before.keys())
    before.set(name, (await stat(resolve(cwd, name))).mtimeMs);
  const inherit = session.modelSource === "inherit";
  if (inherit && !input.modelRoute?.model)
    throw new Error("请先在 DSH 选择模型，然后重试");
  let modelError;
  const gateway = inherit
    ? await modelGateway({
        model: input.modelRoute.model,
        signal,
        call: modelCall,
        onError: (error) => {
          modelError = error.message;
          progress({
            phase: "model_error",
            text: error.message.slice(0, 2000),
          });
        },
      })
    : null;
  const model = inherit ? input.modelRoute.model : agent.model;
  const env = {
    PAMIYA_MODEL_TOKEN: gateway?.token ?? "",
    PATH: `${resolve(process.execPath, "..")}${process.platform === "win32" ? ";" : ":"}${process.env.PATH ?? ""}`,
  };
  let args;
  if (agent.id === "dsh") {
    args = ["--profile", "headless"];
    if (inherit || demo) env.DSH_HOME = resolve(ownedHome, "dsh");
    if (inherit) {
      const patch = resolve(ownedHome, "dsh-model.json");
      await json(patch, [
        {
          id: "llm-deepseek",
          config: {
            baseURL: gateway.url,
            apiKeyEnv: "PAMIYA_MODEL_TOKEN",
            models: [{ id: model }],
          },
        },
        {
          id: "agent-default-model",
          config: {
            provider: "deepseek-official",
            model,
            reasoningEffort: input.modelRoute.reasoningEffort,
          },
        },
      ]);
      args.push("--patch", patch);
    }
    if (session.nativeId) args.push("--session-id", session.nativeId);
    args.push("--json", "-");
  } else if (agent.id === "codex") {
    args = [
      "exec",
      ...(session.nativeId ? ["resume"] : []),
      "--json",
      "--skip-git-repo-check",
    ];
    if (inherit) {
      env.CODEX_HOME = resolve(ownedHome, "codex");
      args.push(
        "--ignore-user-config",
        "-c",
        'web_search="disabled"',
        "-c",
        'model_provider="pamiya"',
        "-c",
        'model_providers.pamiya.name="Pamiya"',
        "-c",
        `model_providers.pamiya.base_url=${JSON.stringify(`${gateway.url}/v1`)}`,
        "-c",
        'model_providers.pamiya.wire_api="responses"',
        "-c",
        'model_providers.pamiya.env_key="PAMIYA_MODEL_TOKEN"',
      );
    }
    if (model) args.push("-m", model);
    if (session.nativeId) args.push(session.nativeId);
    args.push("-");
  } else if (agent.id === "claude") {
    args = ["--print", "--verbose", "--output-format", "stream-json"];
    if (inherit)
      Object.assign(env, {
        CLAUDE_CONFIG_DIR: resolve(ownedHome, "claude"),
        ANTHROPIC_BASE_URL: gateway.url,
        ANTHROPIC_AUTH_TOKEN: gateway.token,
        ANTHROPIC_API_KEY: gateway.token,
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
      });
    if (model) args.push("--model", model);
    if (session.nativeId) args.push("--resume", session.nativeId);
    if (demo) args.push("--tools", "", "--strict-mcp-config");
  } else {
    args = [
      "--print",
      "--mode",
      "json",
      "--session",
      resolve(ownedHome, "pi-session.jsonl"),
    ];
    if (inherit) {
      env.PI_CODING_AGENT_DIR = resolve(ownedHome, "pi");
      await mkdir(env.PI_CODING_AGENT_DIR, { recursive: true, mode: 0o700 });
      await json(resolve(env.PI_CODING_AGENT_DIR, "models.json"), {
        providers: {
          pamiya: {
            baseUrl: gateway.url,
            api: "anthropic-messages",
            apiKey: gateway.token,
            models: [
              {
                id: model,
                reasoning: false,
                contextWindow: 128000,
                maxTokens: 8192,
              },
            ],
          },
        },
      });
      args.push("--provider", "pamiya");
    } else if (agent.provider) args.push("--provider", agent.provider);
    if (model) args.push("--model", model);
    if (demo)
      args.push(
        "--no-tools",
        "--no-extensions",
        "--no-skills",
        "--no-prompt-templates",
      );
  }
  for (const key of [
    "DSH_HOME",
    "CODEX_HOME",
    "CLAUDE_CONFIG_DIR",
    "PI_CODING_AGENT_DIR",
  ])
    if (env[key]) await mkdir(env[key], { recursive: true, mode: 0o700 });
  let final = false,
    error,
    answer = "";
  const logFile = resolve(directory, "runs", taskId, "events.jsonl");
  await json(resolve(root, `${sessionRef}.json`), session);
  try {
    progress({ phase: "starting", agent: agent.id, sessionRef });
    const result = await runProcess(agent.command, args, {
      cwd,
      env,
      input: `${demo ? SYNTHETIC_PROMPT : input.prompt}\n`,
      signal,
      timeoutSeconds: input.timeoutSeconds ?? 600,
      logFile,
      onLine(line) {
        let row;
        try {
          row = JSON.parse(line);
        } catch {
          return;
        }
        const event = agentEvent(agent.id, row);
        if (event.sessionId && event.sessionId.length < 200)
          session.nativeId = event.sessionId;
        if (event.text) answer = event.text;
        if (event.error) error = String(event.error);
        if (event.final) final = true;
        progress({
          phase: event.phase,
          text: event.text?.slice(-2000),
          sessionRef,
          agent: agent.id,
        });
      },
    });
    await json(resolve(root, `${sessionRef}.json`), session);
    if (result.exitCode !== 0 || error || !final)
      throw new Error(
        modelError ||
          error ||
          result.stderr.trim() ||
          `Agent 未返回完成事件（退出码 ${result.exitCode}）`,
      );
    const artifacts = [
      { name: "events.jsonl", path: relative(directory, logFile), kind: "log" },
    ];
    for (const entry of await readdir(cwd, { withFileTypes: true }))
      if (entry.isFile()) {
        const file = resolve(cwd, entry.name),
          info = await stat(file);
        if (before.get(entry.name) !== info.mtimeMs)
          artifacts.push({
            name: entry.name,
            path: file,
            kind: "file",
            bytes: info.size,
          });
      }
    return {
      agent: agent.id,
      sessionRef,
      nativeSessionId: session.nativeId ?? null,
      modelSource: session.modelSource,
      answer: answer.slice(-24000),
      artifacts,
      synthetic: demo,
    };
  } finally {
    await json(resolve(root, `${sessionRef}.json`), session);
    await gateway?.close();
  }
}

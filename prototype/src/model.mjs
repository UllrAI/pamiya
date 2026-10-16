import { messageIntents } from "./message-intents.mjs";

export const STORAGE_KEY = "pamiya-prototype-v1";
export const uid = () => crypto.randomUUID();
export const ACTIVE = ["running", "stopping"];
export const BLOCKED = [
  "waiting-input",
  "waiting-connection",
  "failed",
  "reconciling",
  "interrupted",
];
export const isOpen = (run) =>
  Boolean(run && [...ACTIVE, ...BLOCKED].includes(run.status));
export const currentRun = (session) => session?.runs.at(-1);
const stages = ["阅读目标与上下文", "整理核心体验", "完善方案与交付内容"];

export const scenarios = {
  deliver: {
    name: "从目标到成果",
    prompt: "帮我整理 Pamiya 的核心体验，做一份简洁的产品方案。",
    description: "补充、询问、排后续、打开成果，再继续修改。",
  },
  input: {
    name: "补充关键信息",
    prompt: "帮我准备一份项目介绍。",
    description: "只问会改变结果的问题，然后继续。",
  },
  connection: {
    name: "按需连接工具",
    prompt: "参考我的演示工作区，整理产品方案。",
    description: "连接工作区，或换用消息和文件作为资料。",
  },
  failure: {
    name: "失败后恢复",
    prompt: "读取演示资料并整理一份摘要。",
    description: "读取失败后重试，保留已经完成的工作。",
  },
  uncertain: {
    name: "停止与结果核对",
    prompt: "向演示收件箱提交一条产品更新通知。",
    description: "未知回执保持可见，核对前不启动后续工作。",
  },
};

export function newSession(title = "新对话") {
  return {
    id: uid(),
    title,
    messages: [],
    runs: [],
    artifacts: [],
    requests: [],
    readResults: [],
    draft: "",
    draftAttachments: [],
    updatedAt: Date.now(),
    archived: false,
  };
}

function say(session, text, extra = {}) {
  return {
    ...session,
    updatedAt: Date.now(),
    messages: [
      ...session.messages,
      { id: uid(), role: "assistant", text, ...extra },
    ],
  };
}
function patchRun(session, patch) {
  return {
    ...session,
    updatedAt: Date.now(),
    runs: session.runs.map((r, i) =>
      i === session.runs.length - 1 ? { ...r, ...patch } : r,
    ),
  };
}
function treatment(session, id, patch) {
  return {
    ...session,
    messages: session.messages.map((m) =>
      m.treatments
        ? {
            ...m,
            treatments: m.treatments.map((t) =>
              t.id === id ? { ...t, ...patch } : t,
            ),
          }
        : m,
    ),
  };
}
function holdRequests(session, reason) {
  let next = {
    ...session,
    requests: session.requests.map((r) =>
      r.status === "pending" ? { ...r, status: "held", reason } : r,
    ),
  };
  for (const request of session.requests)
    if (request.status === "pending")
      next = treatment(next, request.id, { state: "held" });
  return next;
}

function beginRun(
  session,
  request,
  { scenario = "deliver", connected = false } = {},
) {
  if (isOpen(currentRun(session))) return session;
  const id = uid();
  const previous = request.previousRunId
    ? session.runs.find((r) => r.id === request.previousRunId)
    : null;
  const artifact = request.targetArtifactId
    ? session.artifacts.find((a) => a.id === request.targetArtifactId)
    : null;
  const originId = request.originId;
  const status =
    scenario === "input"
      ? "waiting-input"
      : scenario === "connection" && !connected
        ? "waiting-connection"
        : "running";
  const run = {
    id,
    originId,
    sourceMessageId: request.messageId,
    previousRunId: previous?.id ?? null,
    targetArtifactId: artifact?.id ?? null,
    scenario,
    status,
    step: 0,
    attempt: 1,
    goal: request.text,
    notes: [],
    activity: [],
    dispatched: false,
    startedAt: Date.now(),
    acceptedInputs: [request.id],
  };
  let next = { ...session, runs: [...session.runs, run] };
  next = treatment(next, request.id, {
    state: "accepted",
    targetRunId: id,
    originId,
  });
  return say(
    next,
    status === "waiting-input"
      ? "这份介绍主要给谁看？受众会影响篇幅和表达。"
      : status === "waiting-connection"
        ? "需要读取演示工作区的资料。可以连接，也可以换资料后继续。"
        : scenario === "uncertain"
          ? "我会模拟提交通知并核对回执，不会发送真实消息。"
          : artifact
            ? "我会修改这份成果，保留人工内容和历史版本。"
            : "我会按这个目标整理演示成果，过程与内容由本地脚本模拟。",
    { runId: id },
  );
}

export function startRun(
  session,
  text,
  {
    scenario = "deliver",
    attachments = [],
    connected = false,
    messageId = uid(),
  } = {},
) {
  if (
    isOpen(currentRun(session)) ||
    session.messages.some((m) => m.id === messageId)
  )
    return session;
  const originId = `${messageId}:0`;
  const request = {
    id: `${messageId}:0`,
    messageId,
    originId,
    text,
  };
  const next = {
    ...session,
    title: session.messages.length ? session.title : text.slice(0, 24),
    draft: "",
    draftAttachments: [],
    messages: [
      ...session.messages,
      {
        id: messageId,
        role: "user",
        text,
        attachments,
        originId,
        treatments: [{ ...request, kind: "start", state: "accepted" }],
      },
    ],
  };
  return beginRun(next, request, { scenario, connected });
}

function enqueue(
  session,
  item,
  { kind = item.kind, held = false, reason = "" } = {},
) {
  const request = {
    ...item,
    kind,
    status: held ? "held" : "pending",
    reason,
    createdAt: Date.now(),
  };
  const next = { ...session, requests: [...session.requests, request] };
  return treatment(next, item.id, {
    state: held ? "held" : "queued",
    originId: item.originId,
  });
}
function demoAnswer(session, item) {
  const target =
    session.runs.find((r) => r.id === item.targetRunId) ?? currentRun(session);
  return say(
    session,
    `这是演示问答：当前目标是“${target?.goal ?? "查看已有资料"}”。资料来自本次明确添加的消息和文件；未开展真实检索，不能为数字编造来源。这条询问不修改目标${target?.status === "running" ? "，原工作继续" : "，也不会重新启动执行"}。`,
  );
}
function applyIntent(session, item, { connected = false } = {}) {
  const run = currentRun(session);
  if (item.kind === "steer") {
    const target = session.runs.find((r) => r.id === item.targetRunId);
    item = {
      ...item,
      originId: target?.originId ?? item.originId,
      previousRunId: target?.id,
      targetArtifactId:
        item.targetArtifactId ?? target?.artifactId ?? target?.targetArtifactId,
    };
  }
  if (item.kind === "clarify") return session;
  if (item.kind === "question")
    return demoAnswer(treatment(session, item.id, { state: "answered" }), item);
  if (item.kind === "stop")
    return stopRun(treatment(session, item.id, { state: "applied" }));
  if (item.kind === "replace") {
    let next = holdRequests(session, "原目标已替换，后续请求暂存");
    if (isOpen(run)) {
      next = patchRun(next, {
        status: run.dispatched ? "reconciling" : "stopping",
      });
      next = enqueue(
        next,
        {
          ...item,
          originId: item.id,
          targetArtifactId: null,
          previousRunId: run.id,
        },
        { kind: "replace" },
      );
      return say(
        next,
        run.dispatched
          ? "替换请求已保存。原提交仍待核对，核对前不会启动新目标；旧目标的后续请求已暂存。"
          : "正在停止原工作，确认后改做新目标；已有成果保留，旧目标的后续请求暂存。",
      );
    }
    return beginRun(
      next,
      {
        ...item,
        originId: item.id,
        targetArtifactId: null,
        previousRunId: run?.id,
      },
      { connected },
    );
  }
  if (item.kind === "queue" || (isOpen(run) && run.id !== item.targetRunId)) {
    const held =
      run &&
      ["stopping", "reconciling", "failed", "interrupted"].includes(run.status);
    const next = enqueue(
      session,
      item.kind === "steer"
        ? item
        : {
            ...item,
            originId: item.id,
            targetArtifactId: null,
            previousRunId: null,
          },
      { held, reason: held ? "原工作需要先处理" : "" },
    );
    return say(
      next,
      held
        ? "后续请求已暂存。先处理原工作的停止或恢复，再继续；也可以撤回。"
        : "已排在当前工作之后，可以查看原文或撤回。",
    );
  }
  if (isOpen(run) && run.id === item.targetRunId) {
    if (run.dispatched || ["stopping", "reconciling"].includes(run.status)) {
      return say(
        enqueue(
          session,
          {
            ...item,
            targetArtifactId: run.artifactId ?? run.targetArtifactId,
            previousRunId: run.id,
          },
          { kind: "steer", held: true, reason: "停止或核对完成后才可继续" },
        ),
        "修改要求已暂存，不会恢复正在停止的目标；请先完成停止或核对。",
      );
    }
    let next = patchRun(session, {
      notes: [...run.notes, item.text],
      acceptedInputs: [...run.acceptedInputs, item.id],
      ...(item.kind === "answer" && run.status === "waiting-input"
        ? { status: "running" }
        : {}),
    });
    next = treatment(next, item.id, {
      state: "accepted",
      targetRunId: run.id,
      originId: run.originId,
    });
    return say(
      next,
      run.status === "waiting-connection"
        ? "补充已保存，但仍缺资料。可以连接工作区，或使用“换资料”解除原依赖。"
        : "已记下这条要求，下一次演示推进会应用；尚未改变已交付版本。",
    );
  }
  const prior = session.runs.find((r) => r.id === item.targetRunId) ?? run;
  const artifact =
    session.artifacts.find(
      (a) =>
        a.id ===
        (item.targetArtifactId ?? prior?.artifactId ?? prior?.targetArtifactId),
    ) ?? (item.kind === "steer" ? session.artifacts.at(-1) : null);
  return beginRun(
    session,
    {
      ...item,
      originId:
        item.kind === "steer"
          ? (artifact?.originId ?? prior?.originId ?? item.id)
          : item.id,
      targetArtifactId: item.kind === "steer" ? artifact?.id : null,
      previousRunId: item.kind === "steer" ? prior?.id : null,
    },
    { connected },
  );
}

export function submitMessage(
  session,
  text,
  {
    attachments = [],
    connected = false,
    messageId = uid(),
    targetArtifactId,
  } = {},
) {
  if (!text.trim() || session.messages.some((m) => m.id === messageId))
    return session;
  const run = currentRun(session);
  const intents = messageIntents(text, {
    open: isOpen(run),
    waitingInput: run?.status === "waiting-input",
  });
  const items = intents.map((intent, i) => ({
    ...intent,
    id: `${messageId}:${i}`,
    messageId,
    originId: run?.originId ?? `${messageId}:${i}`,
    targetRunId: run?.id,
    targetArtifactId:
      targetArtifactId ?? run?.artifactId ?? run?.targetArtifactId,
    attachments,
    state: intent.kind === "clarify" ? "needs-choice" : "received",
  }));
  let next = {
    ...session,
    title: session.messages.length ? session.title : text.slice(0, 24),
    draft: "",
    draftAttachments: [],
    messages: [
      ...session.messages,
      { id: messageId, role: "user", text, attachments, treatments: items },
    ],
  };
  for (const item of items) {
    const target =
      !item.targetRunId && ["steer", "answer"].includes(item.kind)
        ? currentRun(next)
        : null;
    next = applyIntent(
      next,
      target
        ? { ...item, targetRunId: target.id, originId: target.originId }
        : item,
      { connected },
    );
  }
  return next;
}

export function resolveMessage(session, treatmentId, kind, connected = false) {
  const item = session.messages
    .flatMap((m) => m.treatments ?? [])
    .find((t) => t.id === treatmentId && t.state === "needs-choice");
  if (!item || !["steer", "question", "replace", "queue"].includes(kind))
    return session;
  return applyIntent(
    treatment(session, item.id, { kind, state: "received" }),
    { ...item, kind },
    { connected },
  );
}

function resultMessage(session, run, text, kind, artifact) {
  return say(session, text, {
    artifactId: artifact?.id,
    result: {
      id: `${run.id}:${kind}`,
      runId: run.id,
      originId: run.originId,
      goal: run.goal,
      kind,
      at: Date.now(),
      artifactId: artifact?.id,
      artifactVersion: artifact?.version,
    },
  });
}
function finish(session, status, text, { artifact, verified = false } = {}) {
  const run = currentRun(session);
  let next = patchRun(session, {
    status,
    finishedAt: Date.now(),
    verified,
    ...(artifact ? { artifactId: artifact.id } : {}),
  });
  next = resultMessage(next, currentRun(next), text, status, artifact);
  return next;
}
function startPending(session, requestId) {
  const run = currentRun(session);
  if (isOpen(run)) return session;
  const request = session.requests.find(
    (r) => r.status === "pending" && (!requestId || r.id === requestId),
  );
  if (!request) return session;
  let next = {
    ...session,
    requests: session.requests.map((r) =>
      r.id === request.id ? { ...r, status: "started" } : r,
    ),
  };
  next = beginRun(next, request);
  return {
    ...next,
    requests: next.requests.map((r) =>
      r.id === request.id ? { ...r, runId: currentRun(next).id } : r,
    ),
  };
}
export function withdrawRequest(session, id) {
  const request = session.requests.find((r) => r.id === id);
  if (!request) return session;
  if (request.status === "started")
    return currentRun(session)?.id === request.runId
      ? stopRun(session)
      : session;
  if (!["pending", "held"].includes(request.status)) return session;
  return say(
    treatment(
      {
        ...session,
        requests: session.requests.map((r) =>
          r.id === id ? { ...r, status: "withdrawn" } : r,
        ),
      },
      id,
      { state: "withdrawn" },
    ),
    "已撤回尚未开始的请求，其他工作不变。",
  );
}
export function continueRequest(session, id) {
  const request = session.requests.find(
    (r) => r.id === id && r.status === "held",
  );
  if (!request || isOpen(currentRun(session))) return session;
  return startPending(
    {
      ...session,
      requests: session.requests.map((r) =>
        r.id === id ? { ...r, status: "pending", reason: "" } : r,
      ),
    },
    id,
  );
}
export function stopRun(session) {
  const run = currentRun(session);
  if (!isOpen(run)) return session;
  const next = holdRequests(session, "已停止当前执行，后续请求暂存");
  if (run.status === "stopping") return next;
  return say(
    patchRun(next, { status: run.dispatched ? "reconciling" : "stopping" }),
    run.dispatched
      ? "提交效果仍待核对，不能当作已停止；后续请求已暂存。"
      : "正在停止当前执行；后续请求已暂存，未来安排不受影响。",
  );
}
export function retryRun(session, connected = false) {
  const run = currentRun(session);
  if (
    !run ||
    !["failed", "interrupted", "waiting-connection"].includes(run.status)
  )
    return session;
  if (
    run.status === "waiting-connection" &&
    !connected &&
    !run.alternateMaterial
  )
    return session;
  if (run.dispatched) return patchRun(session, { status: "reconciling" });
  return patchRun(session, { status: "running", attempt: run.attempt + 1 });
}
export function replaceMaterial(
  session,
  text,
  attachments = [],
  messageId = uid(),
) {
  const run = currentRun(session);
  if (
    run?.status !== "waiting-connection" ||
    session.messages.some((m) => m.id === messageId)
  )
    return session;
  if (!text.trim() && !attachments.some((a) => a.text?.trim())) return session;
  let next = {
    ...session,
    draftAttachments: [],
    messages: [
      ...session.messages,
      {
        id: messageId,
        role: "user",
        text: text.trim() || "改用这些文件作为资料。",
        attachments,
        originId: run.originId,
      },
    ],
  };
  next = patchRun(next, {
    status: "running",
    alternateMaterial: true,
    notes: [...run.notes, text.trim()].filter(Boolean),
  });
  return say(next, "已改用这些资料，解除对演示工作区的依赖，继续原工作。");
}
export function reconcileRun(session) {
  const run = currentRun(session);
  if (run?.status !== "reconciling") return session;
  return finish(
    session,
    "completed",
    "演示回执已核对：通知提交一次，没有重复提交。这是模拟结果，没有发送真实消息。",
    { verified: true },
  );
}
export function dismissRun(session) {
  const run = currentRun(session);
  if (!run || !BLOCKED.includes(run.status) || run.dispatched) return session;
  const next = holdRequests(session, "原工作已结束，后续请求暂存");
  return finish(
    next,
    run.status === "failed" ? "incomplete" : "stopped",
    run.status === "failed"
      ? "本轮未完成：演示资料读取失败，已有内容保留；后续请求已暂存。"
      : "已结束本轮，已有内容保留；后续请求已暂存。",
  );
}

export function makeDocument(goal, notes = [], attachments = []) {
  const source = attachments.length
    ? attachments
        .map(
          (a) =>
            `- ${a.name}${a.text ? `：${a.text.slice(0, 160).replace(/\n/g, " ")}` : "（仅文件信息，未解析内容）"}`,
        )
        .join("\n")
    : "- 本次对话中的目标与补充。";
  return `# Pamiya 产品方案\n\n> 演示成果，用于验证协作与编辑流程。未调用真实模型，也未开展外部调研。\n\n## 目标\n\n${goal}\n\n## 一个可以持续共事的 Agent\n\n直接表达想完成的事，Pamiya 理解上下文、使用可用工具，并把工作推进到可以使用的成果。对话用于表达和调整方向；文档、文件和预览承载结果。\n\n## 第一次使用\n\n- 打开就能提出目标，不先配置 Agent、工作流或设备。\n- 文件与对话可以作为上下文；缺少关键信息时只问必要问题。\n- 在已有授权范围内直接推进，需要新资源时说明具体用途。\n\n## 一起推进\n\n- 用简短活动说明当前进展，详情按需展开。\n- 随时补充方向，不丢失已经完成的工作。\n- 成果可查看、编辑、下载，也可以回到对话继续完善。\n\n## 完成之后\n\n保留对话与成果版本，便于下次继续。只有用户希望持续承担一件事时，才添加定时安排。\n\n## 本次上下文\n\n${source}${notes.length ? `\n\n## 你的补充\n\n${notes.map((n) => `- ${n}`).join("\n")}` : ""}\n\n## 下一步\n\n用一个真实目标走通首次使用，检查结果是否有用，再扩展工具与持续工作。`;
}

export function needsTick(session) {
  return (
    ACTIVE.includes(currentRun(session)?.status) ||
    (!isOpen(currentRun(session)) &&
      session.requests.some((r) => r.status === "pending"))
  );
}
export function tickSession(session) {
  const run = currentRun(session);
  if (!run || !isOpen(run)) return startPending(session);
  if (run.status === "stopping")
    return finish(session, "stopped", "当前执行已确认停止，已有内容保留。");
  if (run.status !== "running") return session;
  let next = session;
  for (const id of run.acceptedInputs)
    next = treatment(next, id, { state: "applied" });
  if (run.scenario === "failure" && run.step === 1 && run.attempt === 1)
    return holdRequests(
      patchRun(next, { status: "failed" }),
      "读取失败，后续请求暂存",
    );
  if (run.scenario === "uncertain") {
    if (run.step >= 2)
      return holdRequests(
        patchRun(next, { status: "reconciling" }),
        "提交效果待核对",
      );
    return patchRun(next, {
      step: run.step + 1,
      dispatched: run.step >= 1,
      activity: [
        ...run.activity,
        run.step === 0 ? "已整理演示通知" : "已提交演示通知，等待回执",
      ],
    });
  }
  if (run.step < stages.length)
    return patchRun(next, {
      step: run.step + 1,
      activity: [...run.activity, `${stages[run.step]} · 已完成`],
    });
  const old = session.artifacts.find((a) => a.id === run.targetArtifactId);
  const attachments = session.messages
    .filter(
      (m) =>
        m.originId === run.originId ||
        m.treatments?.some((t) => t.originId === run.originId),
    )
    .flatMap((m) => m.attachments ?? []);
  const body = old
    ? `${old.body}\n\n## 本轮修改\n\n${[run.goal, ...run.notes].join("\n\n")}`
    : makeDocument(run.goal, run.notes, attachments);
  const artifact = old
    ? {
        ...old,
        body,
        version: old.version + 1,
        versions: [...old.versions, { version: old.version, body: old.body }],
        updatedAt: Date.now(),
      }
    : {
        id: uid(),
        originId: run.originId,
        name: `${run.goal.replace(/[\\/:*?"<>|。]/g, "").slice(0, 24) || "演示成果"}.md`,
        body,
        version: 1,
        versions: [],
        updatedAt: Date.now(),
      };
  next = {
    ...next,
    artifacts: old
      ? next.artifacts.map((a) => (a.id === old.id ? artifact : a))
      : [...next.artifacts, artifact],
  };
  return finish(
    next,
    "completed",
    old
      ? `已更新到第 ${artifact.version} 版，人工内容和历史版本仍保留。`
      : "演示成果已整理好，可以打开、编辑，或继续要求修改。",
    { artifact },
  );
}

function normalizeSession(session, legacy) {
  const messages = (session.messages ?? []).map((m) => ({ ...m }));
  const artifacts = (session.artifacts ?? []).map((a) => ({
    ...a,
    originId: a.originId ?? `artifact:${a.id}`,
  }));
  const runs = (session.runs ?? []).map((r) => {
    const position = messages.findIndex((m) => m.runId === r.id);
    const source = messages
      .slice(0, position < 0 ? messages.length : position)
      .findLast((m) => m.role === "user");
    const artifact =
      artifacts.find((a) => a.id === r.artifactId) ?? artifacts.at(-1);
    return {
      ...r,
      originId: r.originId ?? artifact?.originId ?? `${source?.id ?? r.id}:0`,
      sourceMessageId: r.sourceMessageId ?? source?.id,
      targetArtifactId: r.targetArtifactId ?? (legacy ? artifact?.id : null),
      acceptedInputs: r.acceptedInputs ?? [],
    };
  });
  if (legacy)
    for (const run of runs) {
      if (!["completed", "stopped", "incomplete"].includes(run.status))
        continue;
      const existing = messages.find((m) => m.result?.runId === run.id);
      if (!existing)
        messages.push({
          id: `legacy-result:${run.id}`,
          role: "assistant",
          text:
            run.status === "completed"
              ? "之前的工作已交付，保留原成果。"
              : "之前的执行已结束，内容保留。",
          artifactId: run.artifactId,
          result: {
            id: `${run.id}:${run.status}`,
            runId: run.id,
            originId: run.originId,
            goal: run.goal,
            kind: run.status,
            at: run.finishedAt ?? run.startedAt,
            artifactId: run.artifactId,
          },
        });
    }
  return {
    ...newSession(),
    ...session,
    messages,
    artifacts,
    runs,
    requests: session.requests ?? [],
    readResults: session.readResults ?? [],
  };
}
export function recoverState(value) {
  if (
    !value ||
    ![1, 2].includes(value.version) ||
    !Array.isArray(value.sessions)
  )
    return initialState();
  return {
    ...value,
    version: 2,
    sessions: value.sessions.map((s) => {
      let next = normalizeSession(s, value.version === 1);
      const run = currentRun(next);
      if (!run || !ACTIVE.includes(run.status)) return next;
      next = holdRequests(next, "页面刷新中断了本地模拟，请先处理原工作");
      if (run.dispatched) return patchRun(next, { status: "reconciling" });
      if (run.status === "stopping")
        return finish(
          next,
          "stopped",
          "页面刷新结束了正在停止的本地模拟；后续请求保持暂存。",
        );
      return patchRun(next, { status: "interrupted" });
    }),
  };
}

export function attentionItems(sessions) {
  const items = new Map();
  const add = (session, originId, info) => {
    const id = `${session.id}:${originId}`;
    const existing = items.get(id) ?? {
      id,
      sessionId: session.id,
      originId,
      goal: info.goal ?? session.title,
      actions: [],
      results: [],
    };
    items.set(id, {
      ...existing,
      ...info,
      actions: [...existing.actions, ...(info.action ? [info.action] : [])],
      results: [...existing.results, ...(info.result ? [info.result] : [])],
    });
  };
  for (const session of sessions) {
    const run = currentRun(session);
    if (run && BLOCKED.includes(run.status))
      add(session, run.originId, {
        goal: run.goal,
        runId: run.id,
        messageId: session.messages.find((m) => m.runId === run.id)?.id,
        action: {
          kind: "run",
          at: run.startedAt,
          label: {
            "waiting-input": "需要补充受众",
            "waiting-connection": "缺少资料：连接或换资料",
            failed: "读取失败：重试或结束",
            reconciling: "重要提交待核对",
            interrupted: "本地模拟中断：继续或结束",
          }[run.status],
        },
      });
    for (const request of session.requests)
      if (request.status === "held")
        add(session, request.originId, {
          goal: request.text,
          messageId: request.messageId,
          action: {
            kind: "request",
            requestId: request.id,
            at: request.createdAt,
            label: request.reason || "后续请求已暂存",
          },
        });
    for (const message of session.messages) {
      for (const t of message.treatments ?? [])
        if (t.state === "needs-choice")
          add(session, t.originId, {
            goal: t.text,
            messageId: message.id,
            action: {
              kind: "message",
              at: message.at ?? session.updatedAt,
              label: "需要明确这条消息的用途",
            },
          });
      if (message.result && !session.readResults.includes(message.result.id))
        add(session, message.result.originId, {
          goal: message.result.goal,
          result: { ...message.result, messageId: message.id },
        });
    }
  }
  return [...items.values()]
    .map((item) => ({
      ...item,
      group: item.actions.length ? "action" : "result",
      latestResult: item.results.at(-1),
      at: item.actions.length
        ? Math.min(...item.actions.map((a) => a.at))
        : Math.max(...item.results.map((r) => r.at)),
    }))
    .sort((a, b) =>
      a.group !== b.group
        ? a.group === "action"
          ? -1
          : 1
        : a.group === "action"
          ? a.at - b.at
          : b.at - a.at,
    );
}
export function markResultsRead(session, resultIds) {
  const known = new Set(
    session.messages.flatMap((m) => (m.result ? [m.result.id] : [])),
  );
  const added = resultIds.filter(
    (id) => known.has(id) && !session.readResults.includes(id),
  );
  return added.length
    ? { ...session, readResults: [...session.readResults, ...added] }
    : session;
}
export function saveArtifact(session, id, body) {
  if (!body.trim()) return session;
  return {
    ...session,
    artifacts: session.artifacts.map((a) =>
      a.id === id && a.body !== body
        ? {
            ...a,
            body,
            version: a.version + 1,
            versions: [...a.versions, { version: a.version, body: a.body }],
            updatedAt: Date.now(),
          }
        : a,
    ),
  };
}

export function initialState() {
  const session = newSession("Pamiya 产品方案");
  const artifact = {
    id: uid(),
    name: "Pamiya 产品方案.md",
    body: makeDocument("梳理一个现代个人 Agent 的核心体验。"),
    version: 1,
    versions: [],
    updatedAt: Date.now(),
  };
  artifact.originId = `artifact:${artifact.id}`;
  session.artifacts = [artifact];
  session.messages = [
    {
      id: uid(),
      role: "user",
      text: "梳理一个现代个人 Agent 的核心体验。",
      attachments: [],
    },
    {
      id: uid(),
      role: "assistant",
      text: "我把核心体验整理成了一份方案：提出目标、一起推进、交付成果。可以继续完善首次使用流程。",
      artifactId: artifact.id,
    },
  ];
  const reading = newSession("本周阅读笔记");
  reading.messages = [
    {
      id: uid(),
      role: "assistant",
      text: "这里保留阅读笔记的上下文。把想整理的文章或文件放进来，我们可以继续。",
    },
  ];
  const travel = newSession("旅行安排");
  reading.updatedAt = session.updatedAt - 86400000;
  travel.updatedAt = session.updatedAt - 172800000;
  travel.messages = [
    {
      id: uid(),
      role: "assistant",
      text: "上次我们还没有确定目的地。可以从出发城市、可用日期和偏好开始。",
    },
  ];
  return {
    version: 2,
    sessions: [session, reading, travel],
    connections: { workspace: false },
    memories: [],
    schedules: [],
  };
}

// The prototype offers two fixed-offset zones. Production scheduling belongs to the server.
export function nextOccurrence(schedule, now = Date.now()) {
  const offset = schedule.timezone === "UTC" ? 0 : 8 * 60 * 60 * 1000;
  const localNow = new Date(now + offset);
  const [h, m] = schedule.time.split(":").map(Number);
  for (let days = 0; days < 9; days++) {
    const candidate = new Date(
      Date.UTC(
        localNow.getUTCFullYear(),
        localNow.getUTCMonth(),
        localNow.getUTCDate() + days,
        h,
        m,
      ),
    );
    if (
      schedule.frequency === "weekly" &&
      candidate.getUTCDay() !== Number(schedule.weekday)
    )
      continue;
    const timestamp = candidate.getTime() - offset;
    if (timestamp > now) return timestamp;
  }
  return null;
}

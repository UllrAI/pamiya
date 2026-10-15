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

export const scenarios = {
  deliver: {
    name: "从目标到成果",
    prompt: "帮我整理 Pamiya 的核心体验，做一份简洁的产品方案。",
    description: "自主推进、查看活动、打开成果、继续修改。",
  },
  input: {
    name: "补充关键信息",
    prompt: "帮我准备一份项目介绍。",
    description: "只问会改变结果的问题，然后继续。",
  },
  connection: {
    name: "按需连接工具",
    prompt: "参考我的演示工作区，整理产品方案。",
    description: "缺少资料时连接一个明确的工作区。",
  },
  failure: {
    name: "失败后恢复",
    prompt: "读取演示资料并整理一份摘要。",
    description: "读取失败后重试，保留已经完成的工作。",
  },
  uncertain: {
    name: "停止与结果核对",
    prompt: "向演示收件箱提交一条产品更新通知。",
    description: "模拟提交后的未知回执；查询结果，避免重复提交。",
  },
};

export function newSession(title = "新对话") {
  return {
    id: uid(),
    title,
    messages: [],
    runs: [],
    artifacts: [],
    draft: "",
    draftAttachments: [],
    updatedAt: Date.now(),
    archived: false,
  };
}

export function currentRun(session) {
  return session?.runs.at(-1);
}

const stages = ["阅读目标与上下文", "整理核心体验", "完善方案与交付内容"];

export function startRun(
  session,
  text,
  { scenario = "deliver", attachments = [], connected = false } = {},
) {
  const prior = currentRun(session);
  if (prior && [...ACTIVE, ...BLOCKED].includes(prior.status)) return session;
  const id = uid();
  const status =
    scenario === "input"
      ? "waiting-input"
      : scenario === "connection" && !connected
        ? "waiting-connection"
        : "running";
  const intro =
    status === "waiting-input"
      ? "这份介绍主要给谁看？受众会影响篇幅和表达。"
      : status === "waiting-connection"
        ? "需要读取演示工作区的资料。连接后，我会在当前对话继续。"
        : scenario === "uncertain"
          ? "我会向演示收件箱提交一条通知，并核对回执。这条演示不会发送真实消息。"
          : session.artifacts.length
            ? "我会结合你的补充更新这份成果，保留之前的版本。"
            : "我会先梳理重点，再整理成一份可以继续修改的方案。";
  return {
    ...session,
    title: session.messages.length ? session.title : text.slice(0, 24),
    draft: "",
    draftAttachments: [],
    updatedAt: Date.now(),
    messages: [
      ...session.messages,
      { id: uid(), role: "user", text, attachments },
      { id: uid(), role: "assistant", text: intro, runId: id },
    ],
    runs: [
      ...session.runs,
      {
        id,
        scenario,
        status,
        step: 0,
        attempt: 1,
        goal: text,
        notes: [],
        activity: [],
        dispatched: false,
        startedAt: Date.now(),
      },
    ],
  };
}

function patchRun(session, patch) {
  return {
    ...session,
    updatedAt: Date.now(),
    runs: session.runs.map((run, i) =>
      i === session.runs.length - 1 ? { ...run, ...patch } : run,
    ),
  };
}

export function addInput(session, text, attachments = []) {
  const run = currentRun(session);
  if (
    !run ||
    ![...ACTIVE, ...BLOCKED].includes(run.status) ||
    run.status === "stopping"
  )
    return session;
  const resume = run.status === "waiting-input";
  const next = patchRun(session, {
    notes: [...run.notes, text],
    ...(resume ? { status: "running" } : {}),
  });
  return {
    ...next,
    draft: "",
    draftAttachments: [],
    messages: [
      ...next.messages,
      { id: uid(), role: "user", text, attachments },
      {
        id: uid(),
        role: "assistant",
        text: resume
          ? "明白，我会按这个方向继续。"
          : "收到，这条补充已记下，会纳入当前工作。",
      },
    ],
  };
}

export function stopRun(session) {
  const run = currentRun(session);
  if (!run || !["running", ...BLOCKED].includes(run.status)) return session;
  if (run.dispatched && run.scenario === "uncertain")
    return patchRun(session, { status: "reconciling" });
  return patchRun(session, { status: "stopping" });
}

export function retryRun(session, connected) {
  const run = currentRun(session);
  if (
    !run ||
    !["failed", "interrupted", "waiting-connection"].includes(run.status)
  )
    return session;
  if (run.status === "waiting-connection" && !connected) return session;
  if (run.dispatched) return patchRun(session, { status: "reconciling" });
  return patchRun(session, { status: "running", attempt: run.attempt + 1 });
}

export function reconcileRun(session) {
  const run = currentRun(session);
  if (!run || run.status !== "reconciling") return session;
  return {
    ...patchRun(session, { status: "completed", verified: true }),
    messages: [
      ...session.messages,
      {
        id: uid(),
        role: "assistant",
        text: "演示回执已核对：通知已提交一次，没有重复提交。记录已保留。这是模拟结果，没有发送真实消息。",
      },
    ],
  };
}

export function dismissRun(session) {
  const run = currentRun(session);
  if (!run || !BLOCKED.includes(run.status) || run.dispatched) return session;
  return patchRun(session, { status: "stopped" });
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

export function tickSession(session) {
  const run = currentRun(session);
  if (!run) return session;
  if (run.status === "stopping")
    return patchRun(session, { status: "stopped" });
  if (run.status !== "running") return session;
  if (run.scenario === "failure" && run.step === 1 && run.attempt === 1)
    return patchRun(session, { status: "failed" });
  if (run.scenario === "uncertain") {
    if (run.step >= 2) return patchRun(session, { status: "reconciling" });
    return patchRun(session, {
      step: run.step + 1,
      dispatched: run.step >= 1,
      activity: [
        ...run.activity,
        run.step === 0 ? "已整理演示通知" : "已提交演示通知，等待回执",
      ],
    });
  }
  if (run.step < stages.length)
    return patchRun(session, {
      step: run.step + 1,
      activity: [...run.activity, `${stages[run.step]} · 已完成`],
    });
  const old = session.artifacts.at(-1);
  const attachments = session.messages
    .filter((m) => m.role === "user")
    .flatMap((m) => m.attachments || []);
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
        name: "Pamiya 产品方案.md",
        body,
        version: 1,
        versions: [],
        updatedAt: Date.now(),
      };
  return {
    ...patchRun(session, { status: "completed", artifactId: artifact.id }),
    artifacts: old
      ? session.artifacts.map((a) => (a.id === old.id ? artifact : a))
      : [artifact],
    messages: [
      ...session.messages,
      {
        id: uid(),
        role: "assistant",
        text: old
          ? `已更新到第 ${artifact.version} 版，之前的版本仍可查看。`
          : "方案已整理好。打开成果后可以直接修改，也可以继续告诉我想调整什么。",
        artifactId: artifact.id,
      },
    ],
  };
}

export function recoverState(value) {
  if (!value || value.version !== 1 || !Array.isArray(value.sessions))
    return initialState();
  return {
    ...value,
    sessions: value.sessions.map((s) => ({
      ...s,
      runs: s.runs.map((r) =>
        ACTIVE.includes(r.status)
          ? { ...r, status: r.dispatched ? "reconciling" : "interrupted" }
          : r,
      ),
    })),
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
    version: 1,
    sessions: [session, reading, travel],
    connections: { workspace: false },
    memories: [],
    schedules: [],
  };
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

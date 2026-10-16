import { test } from "node:test";
import assert from "node:assert/strict";
import {
  newSession,
  startRun,
  currentRun,
  tickSession,
  submitMessage,
  stopRun,
  retryRun,
  reconcileRun,
  recoverState,
  initialState,
  saveArtifact,
  nextOccurrence,
  resolveMessage,
  replaceMaterial,
  withdrawRequest,
  continueRequest,
  dismissRun,
  attentionItems,
  markResultsRead,
  needsTick,
} from "../src/model.mjs";

const run = (scenario = "deliver") =>
  startRun(newSession(), "整理产品方案", { scenario });
const ticks = (s, n) => {
  for (let i = 0; i < n; i++) s = tickSession(s);
  return s;
};

test("a goal needs the full execution before an artifact is delivered", () => {
  let s = ticks(run(), 3);
  assert.equal(currentRun(s).status, "running");
  assert.equal(s.artifacts.length, 0);
  s = tickSession(s);
  assert.equal(currentRun(s).status, "completed");
  assert.equal(s.artifacts.length, 1);
  assert.equal(s.messages.at(-1).artifactId, s.artifacts[0].id);
  assert.deepEqual(tickSession(s), s);
});

test("steering an active run preserves one run and includes the new input", () => {
  let s = ticks(run(), 1);
  s = submitMessage(s, "重点放在首次使用");
  assert.equal(s.runs.length, 1);
  assert.equal(s.messages.at(-2).text, "重点放在首次使用");
  assert.equal(startRun(s, "第二个目标"), s);
  s = ticks(s, 3);
  assert.match(s.artifacts[0].body, /重点放在首次使用/);
});

test("stop remains pending until acknowledged and creates no late artifact", () => {
  let s = stopRun(ticks(run(), 2));
  assert.equal(currentRun(s).status, "stopping");
  s = tickSession(s);
  assert.equal(currentRun(s).status, "stopped");
  assert.equal(ticks(s, 5).artifacts.length, 0);
  assert.equal(currentRun(startRun(s, "新的目标")).status, "running");
});

test("unknown submitted result cannot be retried or cleared by stop", () => {
  let s = ticks(run("uncertain"), 2);
  assert.equal(currentRun(s).dispatched, true);
  s = stopRun(s);
  assert.equal(currentRun(s).status, "reconciling");
  assert.equal(retryRun(s, true), s);
  const id = currentRun(s).id;
  s = reconcileRun(s);
  assert.equal(currentRun(s).status, "completed");
  assert.equal(currentRun(s).verified, true);
  assert.equal(currentRun(s).id, id);
  assert.equal(s.runs.length, 1);
});

test("reading failure retries within the same run and preserves completed steps", () => {
  let s = ticks(run("failure"), 2);
  assert.equal(currentRun(s).status, "failed");
  const id = currentRun(s).id;
  s = retryRun(s);
  assert.equal(currentRun(s).step, 1);
  s = ticks(s, 3);
  assert.equal(currentRun(s).id, id);
  assert.equal(currentRun(s).status, "completed");
  assert.equal(currentRun(s).attempt, 2);
});

test("missing input and missing connection only resume through their matching action", () => {
  let s = run("input");
  assert.equal(currentRun(s).status, "waiting-input");
  assert.equal(tickSession(s), s);
  s = submitMessage(s, "主要给新用户看");
  assert.equal(currentRun(s).status, "running");
  s = run("connection");
  assert.equal(retryRun(s, false), s);
  assert.equal(currentRun(retryRun(s, true)).status, "running");
});

test("refresh never pretends a local execution continued in the background", () => {
  const base = initialState();
  base.sessions = [run(), ticks(run("uncertain"), 2)];
  const recovered = recoverState(JSON.parse(JSON.stringify(base)));
  assert.equal(currentRun(recovered.sessions[0]).status, "interrupted");
  assert.equal(currentRun(recovered.sessions[1]).status, "reconciling");
});

test("editing and follow-up preserve artifact identity and historical content", () => {
  let s = ticks(run(), 4);
  const original = s.artifacts[0];
  s = saveArtifact(s, original.id, "# 人工修改后的成果");
  assert.equal(s.artifacts[0].version, 2);
  assert.equal(s.artifacts[0].versions[0].body, original.body);
  s = ticks(submitMessage(s, "补充验收标准"), 4);
  assert.equal(s.artifacts.length, 1);
  assert.equal(s.artifacts[0].id, original.id);
  assert.equal(s.artifacts[0].version, 3);
  assert.match(s.artifacts[0].body, /人工修改后的成果/);
  assert.match(s.artifacts[0].body, /补充验收标准/);
});

test("weekly schedules and daily schedules use the selected timezone across midnight", () => {
  const now = Date.parse("2026-10-15T14:30:00Z");
  assert.equal(
    new Date(
      nextOccurrence(
        {
          frequency: "weekly",
          weekday: "1",
          time: "09:00",
          timezone: "Asia/Shanghai",
        },
        now,
      ),
    ).toISOString(),
    "2026-10-19T01:00:00.000Z",
  );
  assert.equal(
    new Date(
      nextOccurrence(
        { frequency: "daily", time: "09:00", timezone: "Asia/Shanghai" },
        now,
      ),
    ).toISOString(),
    "2026-10-16T01:00:00.000Z",
  );
  assert.equal(
    new Date(
      nextOccurrence(
        { frequency: "daily", time: "15:00", timezone: "UTC" },
        now,
      ),
    ).toISOString(),
    "2026-10-15T15:00:00.000Z",
  );
});

const attention = (s) => attentionItems([s]);
const roundTrip = (s) =>
  recoverState(JSON.parse(JSON.stringify({ ...initialState(), sessions: [s] })))
    .sessions[0];

test("questions never change the goal or restart completed work", () => {
  let s = run();
  const goal = currentRun(s).goal;
  s = submitMessage(s, "这个数字依据是什么？");
  assert.equal(currentRun(s).goal, goal);
  assert.deepEqual(currentRun(s).notes, []);
  assert.equal(s.runs.length, 1);
  assert.equal(s.messages.at(-2).treatments[0].state, "answered");
  s = ticks(s, 4);
  s = submitMessage(s, "请解释这个结论");
  assert.equal(s.runs.length, 1);
  assert.equal(currentRun(s).status, "completed");
});

test("mixed input steers, answers and queues distinct goals from one message", () => {
  let s = submitMessage(
    run(),
    "报告再短一点；这个数字依据是什么？完成后再整理附件；之后再写摘要",
    { messageId: "mixed" },
  );
  assert.equal(s.runs.length, 1);
  assert.deepEqual(currentRun(s).notes, ["报告再短一点"]);
  assert.equal(s.requests.length, 2);
  assert.notEqual(s.requests[0].originId, s.requests[1].originId);
  assert.notEqual(s.requests[0].originId, currentRun(s).originId);
  s = tickSession(s);
  const input = s.messages.find((m) => m.id === "mixed");
  assert.deepEqual(
    input.treatments.map((t) => t.state),
    ["applied", "answered", "queued", "queued"],
  );
});

test("steering later in the first message joins the new run", () => {
  const s = submitMessage(newSession(), "整理报告；缩短篇幅");
  assert.equal(s.runs.length, 1);
  assert.equal(s.requests.length, 0);
  assert.deepEqual(currentRun(s).notes, ["缩短篇幅"]);
});

test("duplicate message delivery does not repeat work even after completion", () => {
  let s = submitMessage(run(), "完成后再整理附件", {
    messageId: "retry-message",
  });
  assert.equal(
    submitMessage(s, "完成后再整理附件", { messageId: "retry-message" }),
    s,
  );
  s = ticks(s, 9);
  assert.equal(s.runs.length, 2);
  assert.equal(
    submitMessage(s, "完成后再整理附件", { messageId: "retry-message" }),
    s,
  );
});

test("successful completion starts a separate queued goal without editing the old artifact", () => {
  let s = submitMessage(run(), "完成后再整理附件");
  const originalOrigin = currentRun(s).originId;
  s = ticks(s, 4);
  const original = structuredClone(s.artifacts[0]);
  assert.equal(currentRun(s).status, "completed");
  assert.equal(needsTick(s), true);
  s = tickSession(s);
  assert.equal(s.runs.length, 2);
  assert.notEqual(currentRun(s).originId, originalOrigin);
  assert.equal(currentRun(s).targetArtifactId, null);
  s = ticks(s, 4);
  assert.equal(s.artifacts.length, 2);
  assert.deepEqual(s.artifacts[0], original);
});

test("withdrawal before execution removes a request while withdrawal after start stops it", () => {
  let s = submitMessage(run(), "完成后再整理附件");
  const request = s.requests[0].id;
  const before = withdrawRequest(s, request);
  assert.equal(ticks(before, 9).runs.length, 1);
  s = ticks(s, 5);
  assert.equal(s.requests[0].status, "started");
  s = withdrawRequest(s, request);
  assert.equal(currentRun(s).status, "stopping");
});

test("stopping holds follow-ups until explicit continuation and retains the original goal", () => {
  let s = submitMessage(run(), "完成后再整理附件");
  const original = currentRun(s).id;
  const request = s.requests[0].id;
  s = stopRun(s);
  assert.equal(s.requests[0].status, "held");
  assert.equal(continueRequest(s, request), s);
  s = ticks(s, 10);
  assert.equal(s.runs.length, 1);
  assert.equal(currentRun(s).id, original);
  s = continueRequest(s, request);
  assert.equal(s.runs.length, 2);
  assert.equal(currentRun(s).goal, "整理附件");
});

test("final incomplete outcome holds pending requests and creates an unread conclusion", () => {
  let s = submitMessage(run("failure"), "完成后再整理附件");
  s = ticks(s, 2);
  assert.equal(s.requests[0].status, "held");
  s = dismissRun(s);
  assert.equal(currentRun(s).status, "incomplete");
  assert.equal(ticks(s, 5).runs.length, 1);
  assert.ok(
    attention(s).some((item) => item.latestResult?.kind === "incomplete"),
  );
});

test("replacement waits for stop and preserves old results while holding old follow-ups", () => {
  let s = ticks(run(), 4);
  const original = structuredClone(s.artifacts[0]);
  s = submitMessage(s, "修改这份报告");
  const replacedRun = currentRun(s).id;
  const origin = currentRun(s).originId;
  s = submitMessage(s, "完成后再整理附件");
  s = submitMessage(s, "不要报告了，改成演示提纲");
  assert.equal(currentRun(s).status, "stopping");
  assert.equal(s.requests[0].status, "held");
  s = tickSession(s);
  assert.equal(currentRun(s).status, "stopped");
  s = tickSession(s);
  assert.equal(currentRun(s).goal, "演示提纲");
  assert.equal(currentRun(s).previousRunId, replacedRun);
  assert.notEqual(currentRun(s).originId, origin);
  s = ticks(s, 5);
  assert.deepEqual(s.artifacts[0], original);
  assert.equal(s.requests[0].status, "held");
});

test("withdrawing a replacement never revives the stopped goal", () => {
  let s = submitMessage(run(), "不要报告了，改成演示提纲");
  s = withdrawRequest(s, s.requests[0].id);
  s = ticks(s, 10);
  assert.equal(s.runs.length, 1);
  assert.equal(currentRun(s).status, "stopped");
});

test("uncertain submission blocks replacement and continuation until reconciliation", () => {
  let s = ticks(run("uncertain"), 2);
  s = submitMessage(s, "完成后再整理附件");
  const held = s.requests[0].id;
  s = submitMessage(s, "不要通知了，改成演示提纲");
  assert.equal(currentRun(s).status, "reconciling");
  assert.equal(dismissRun(s), s);
  assert.equal(continueRequest(s, held), s);
  assert.equal(ticks(s, 10).runs.length, 1);
  s = reconcileRun(s);
  s = tickSession(s);
  assert.equal(currentRun(s).goal, "演示提纲");
  assert.equal(s.requests[0].status, "held");
});

test("late steering during stopping is held rather than applied to the old goal", () => {
  const s = submitMessage(stopRun(run()), "缩短篇幅");
  assert.equal(currentRun(s).status, "stopping");
  assert.deepEqual(currentRun(s).notes, []);
  assert.equal(s.requests[0].status, "held");
});

test("ambiguous messages can be resolved after completion without losing their intended artifact", () => {
  let s = submitMessage(run(), "蓝色");
  const choice = s.messages.at(-1).treatments[0].id;
  assert.equal(attention(s)[0].group, "action");
  s = ticks(s, 4);
  const artifact = s.artifacts[0];
  s = resolveMessage(s, choice, "steer");
  assert.equal(s.runs.length, 2);
  assert.equal(currentRun(s).targetArtifactId, artifact.id);
  assert.equal(currentRun(s).originId, artifact.originId);
  assert.equal(resolveMessage(s, choice, "steer"), s);
});

test("replacing unavailable resources accepts usable material only and preserves the run", () => {
  let s = run("connection");
  const id = currentRun(s).id;
  const binary = [
    { id: "pdf", name: "report.pdf", kind: "metadata", text: "" },
  ];
  assert.equal(replaceMaterial(s, "", binary), s);
  s = replaceMaterial(s, "资料：产品只支持本地模拟。", [], "material");
  assert.equal(currentRun(s).id, id);
  assert.equal(currentRun(s).alternateMaterial, true);
  assert.equal(currentRun(s).status, "running");
  assert.equal(replaceMaterial(s, "重复", [], "material"), s);
  assert.equal(attention(s).length, 0);
  s = ticks(s, 4);
  assert.match(s.artifacts[0].body, /产品只支持本地模拟/);
});

test("read acknowledgements clear only seen result IDs, never required actions or newer versions", () => {
  let s = ticks(run(), 4);
  const oldResult = s.messages.at(-1).result.id;
  s = ticks(submitMessage(s, "继续修改这份报告"), 4);
  const latestResult = s.messages.at(-1).result.id;
  assert.equal(attention(s).length, 1);
  s = markResultsRead(s, [oldResult, "unknown-id"]);
  assert.equal(attention(s)[0].latestResult.id, latestResult);
  s = markResultsRead(s, [latestResult]);
  assert.equal(attention(s).length, 0);
  s = submitMessage(s, "修改这份报告");
  s = submitMessage(s, "蓝色");
  assert.equal(attention(s)[0].group, "action");
  s = markResultsRead(s, [oldResult, latestResult]);
  assert.equal(attention(s)[0].group, "action");
});

test("archived work remains actionable and attention sorts required actions before unread results", () => {
  let waiting = run("input");
  waiting = { ...waiting, archived: true };
  const completed = ticks(run(), 4);
  const items = attentionItems([completed, waiting]);
  assert.equal(items.length, 2);
  assert.equal(items[0].sessionId, waiting.id);
  assert.equal(items[0].group, "action");
  assert.equal(items[1].group, "result");
  assert.equal(items[0].messageId, waiting.messages.find((m) => m.runId)?.id);
});

test("refresh persists pending messages, read markers and goal links without replay", () => {
  let s = ticks(run(), 4);
  const result = s.messages.at(-1).result.id;
  s = markResultsRead(s, [result]);
  s = submitMessage(s, "继续修改这份报告");
  const id = currentRun(s).id;
  const originId = currentRun(s).originId;
  s = submitMessage(s, "完成后再整理附件", { messageId: "persisted" });
  s = roundTrip(s);
  assert.equal(currentRun(s).id, id);
  assert.equal(currentRun(s).originId, originId);
  assert.equal(currentRun(s).status, "interrupted");
  assert.equal(s.requests[0].status, "held");
  assert.ok(s.readResults.includes(result));
  assert.equal(
    submitMessage(s, "完成后再整理附件", { messageId: "persisted" }),
    s,
  );
});

test("refresh while stopping finishes only the local stop and cannot restart the old goal", () => {
  let s = submitMessage(run(), "不要报告了，改成演示提纲");
  s = roundTrip(s);
  assert.equal(currentRun(s).status, "stopped");
  assert.equal(s.requests[0].status, "held");
  assert.equal(ticks(s, 10).runs.length, 1);
});

test("version-one browser data migrates without discarding messages, artifacts or drafts", () => {
  const s = ticks(run(), 4);
  const old = structuredClone(s);
  delete old.requests;
  delete old.readResults;
  old.runs.forEach((r) => {
    delete r.originId;
    delete r.acceptedInputs;
  });
  old.draft = "尚未发送";
  const migrated = recoverState({
    ...initialState(),
    version: 1,
    sessions: [old],
  });
  assert.equal(migrated.version, 2);
  assert.equal(migrated.sessions[0].draft, "尚未发送");
  assert.equal(migrated.sessions[0].artifacts[0].body, s.artifacts[0].body);
  assert.ok(migrated.sessions[0].runs[0].originId);
  assert.deepEqual(migrated.sessions[0].requests, []);
});

test("clarifying old steering while another goal runs queues a revision of the intended artifact", () => {
  let s = submitMessage(run(), "蓝色");
  const choice = s.messages.at(-1).treatments[0].id;
  s = ticks(s, 4);
  const intended = structuredClone(s.artifacts[0]);
  s = startRun(s, "另一件独立工作");
  s = resolveMessage(s, choice, "steer");
  assert.equal(s.requests[0].targetArtifactId, intended.id);
  assert.equal(s.requests[0].originId, intended.originId);
  s = ticks(s, 9);
  assert.equal(s.artifacts.length, 2);
  assert.equal(s.artifacts[0].id, intended.id);
  assert.equal(s.artifacts[0].version, 2);
});

test("steering after submission is held even before the reconciliation tick", () => {
  let s = ticks(run("uncertain"), 2);
  s = submitMessage(s, "缩短这条通知");
  assert.deepEqual(currentRun(s).notes, []);
  assert.equal(s.requests[0].status, "held");
});

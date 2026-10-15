import { test } from "node:test";
import assert from "node:assert/strict";
import {
  newSession,
  startRun,
  currentRun,
  tickSession,
  addInput,
  stopRun,
  retryRun,
  reconcileRun,
  recoverState,
  initialState,
  saveArtifact,
  nextOccurrence,
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
  s = addInput(s, "重点放在首次使用");
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
  s = addInput(s, "主要给新用户看");
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
  s = ticks(startRun(s, "补充验收标准"), 4);
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

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { ModelChannel } from "../src/model-channel.js";
import { modelGateway } from "../src/model-gateway.js";
import {
  decodeModelRequest,
  encodeModelResponse,
  responseEvents,
} from "../src/model-wire.js";
import {
  parseCapabilities,
  validateCustom,
  runProcess,
  discoverAgents,
} from "../src/capabilities.js";
import { runAgent } from "../src/agent-runtime.js";
import { Controller } from "../src/controller.js";

const temporary = async (t) => {
  const dir = await mkdtemp(resolve(tmpdir(), "pamiya-agent-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
};

test("large model context crosses encrypted-link frames once and cancellation aborts provider", async (t) => {
  let calls = 0;
  const a = new ModelChannel({ send: (frame, id) => b.receive(frame, id) });
  const b = new ModelChannel({
    send: (frame, id) => a.receive(frame, id),
    handle: async (body) => {
      calls++;
      return { text: body.text };
    },
  });
  t.after(() => {
    a.close();
    b.close();
  });
  const text = "模型上下文".repeat(15000);
  assert.deepEqual(
    await a.request({ text }, "task", new AbortController().signal),
    { text },
  );
  assert.equal(calls, 1);
  const abort = new AbortController();
  b.handle = (_body, _id, signal) =>
    new Promise((done, reject) =>
      signal.addEventListener("abort", () => reject(new Error("aborted")), {
        once: true,
      }),
    );
  const pending = a.request({ text: "cancel" }, "task", abort.signal);
  await new Promise((done) => setTimeout(done, 20));
  abort.abort();
  await assert.rejects(pending, /取消/);
});

test("model gateway supports actual Anthropic tool round-trip and UTF-8 without exposing credentials", async (t) => {
  let round = 0;
  const gateway = await modelGateway({
    model: "shared",
    call: async (request) => {
      round++;
      if (round === 1) {
        assert.equal(request.messages[0].content[0].text, "你好");
        return {
          blocks: [
            {
              type: "tool-call",
              id: "call1",
              name: "inspect",
              arguments: '{"path":"."}',
            },
          ],
          finishReason: "tool-calls",
        };
      }
      assert.equal(request.messages[2].role, "tool");
      assert.equal(request.messages[2].callId, "call1");
      return { blocks: [{ type: "text", text: "完成" }], finishReason: "stop" };
    },
  });
  t.after(() => gateway.close());
  const call = async (messages) => {
    const response = await fetch(`${gateway.url}/v1/messages`, {
      method: "POST",
      headers: {
        "x-api-key": gateway.token,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "shared",
        messages,
        tools: [{ name: "inspect", input_schema: { type: "object" } }],
      }),
    });
    assert.equal(response.status, 200);
    return response.json();
  };
  const messages = [{ role: "user", content: "你好" }];
  const first = await call(messages);
  assert.equal(first.stop_reason, "tool_use");
  const last = await call([
    ...messages,
    { role: "assistant", content: first.content },
    {
      role: "user",
      content: [{ type: "tool_result", tool_use_id: "call1", content: "ok" }],
    },
  ]);
  assert.equal(last.content[0].text, "完成");
  assert.equal((await fetch(`${gateway.url}/v1/models`)).status, 401);
});

test("Responses namespace/custom tools preserve calls and do not duplicate initial streamed content", () => {
  const decoded = decodeModelRequest("/v1/responses", {
    input: [{ role: "user", content: "test" }],
    tools: [
      {
        type: "namespace",
        name: "functions",
        tools: [{ type: "custom", name: "apply_patch" }],
      },
    ],
  });
  assert.match(decoded.request.tools[0].name, /^[a-zA-Z0-9_-]+$/);
  const response = encodeModelResponse(decoded, {
    blocks: [
      {
        type: "tool-call",
        id: "call",
        name: decoded.request.tools[0].name,
        arguments: '{"input":"patch"}',
      },
    ],
  });
  assert.equal(response.output[0].namespace, "functions");
  const events = responseEvents("responses", response);
  assert.equal(
    events.find((x) => x.type === "response.output_item.added").item.input,
    "",
  );
  assert.equal(
    events.find((x) => x.type === "response.custom_tool_call_input.delta")
      .delta,
    "patch",
  );
  const replay = decodeModelRequest("/responses", {
    input: [
      ...response.output,
      { type: "custom_tool_call_output", call_id: "call", output: "done" },
    ],
  });
  assert.equal(replay.request.messages.at(-1).callId, "call");
});

test("custom actions validate JSON schema and pass literal JSON to a real process", async (t) => {
  const directory = await temporary(t);
  const config = parseCapabilities({
    actions: [
      {
        name: "custom.echo",
        description: "Echo JSON",
        command: process.execPath,
        args: [
          "-e",
          'process.stdin.setEncoding("utf8");let s="";process.stdin.on("data",x=>s+=x);process.stdin.on("end",()=>process.stdout.write(s))',
        ],
        inputSchema: {
          type: "object",
          properties: { text: { type: "string" } },
          required: ["text"],
          additionalProperties: false,
        },
      },
    ],
  });
  assert.throws(() =>
    validateCustom(config.actions[0].inputSchema, { text: 1 }),
  );
  const value = { text: "你好 $(touch should-not-exist)" };
  const result = await runProcess(process.execPath, config.actions[0].args, {
    cwd: directory,
    input: JSON.stringify(value),
    logFile: resolve(directory, "events.log"),
  });
  assert.deepEqual(JSON.parse(result.output), value);
  const abort = new AbortController();
  const pending = runProcess(
    process.execPath,
    ["-e", "setInterval(()=>{},1000)"],
    { signal: abort.signal },
  );
  setTimeout(() => abort.abort(), 50);
  await assert.rejects(pending, /停止/);
});

test("first local worker performs real files with MQTT disabled", async (t) => {
  const directory = await temporary(t);
  let saved;
  const secrets = new Map();
  const controller = await new Controller({
    home: directory,
    autoLocal: true,
    store: {
      load: async () => saved,
      save: async (value) => {
        saved = structuredClone(value);
      },
    },
    secrets: {
      get: async (id) => secrets.get(id),
      set: async (id, value) => secrets.set(id, value),
    },
  }).init();
  t.after(() => controller.close());
  const deadline = Date.now() + 9000;
  while (
    !controller.snapshot().workers.some((x) => x.status === "ready") &&
    Date.now() < deadline
  )
    await new Promise((done) => setTimeout(done, 30));
  assert.equal(controller.state.enabled, false);
  assert.equal(controller.connection.status, "disconnected");
  const task = await controller.dispatch({
    action: "fs.write",
    input: { path: "first.txt", text: "zero MQTT" },
  });
  while (
    controller.state.tasks.find((x) => x.id === task.id).status === "sent" ||
    controller.state.tasks.find((x) => x.id === task.id).status === "running"
  )
    await new Promise((done) => setTimeout(done, 30));
  assert.equal(
    controller.state.tasks.find((x) => x.id === task.id).status,
    "succeeded",
  );
});

test(
  "four installed official agent CLIs execute and resume through the real shared-model gateway",
  { skip: process.env.PAMIYA_REAL_AGENT_TESTS !== "1", timeout: 180000 },
  async (t) => {
    const directory = await temporary(t);
    const agents = await discoverAgents(parseCapabilities({}), directory);
    assert.equal(
      agents.filter((x) => x.installed).length,
      4,
      "Install all four CLIs before running this verification",
    );
    for (const agent of agents) {
      const options = {
        agent,
        input: {
          synthetic: true,
          modelRoute: { provider: "test", model: "pamiya-test" },
          timeoutSeconds: 45,
        },
        taskId: randomUUID(),
        directory,
        workspace: directory,
        publicTest: true,
        signal: new AbortController().signal,
        modelCall: async () => ({
          blocks: [{ type: "text", text: "PAMIYA_AGENT_OK" }],
          finishReason: "stop",
        }),
      };
      const result = await runAgent(options);
      assert.equal(result.answer, "PAMIYA_AGENT_OK", agent.id);
      const resumed = await runAgent({
        ...options,
        taskId: randomUUID(),
        input: { ...options.input, sessionRef: result.sessionRef },
      });
      assert.equal(resumed.answer, "PAMIYA_AGENT_OK", agent.id);
      assert.equal(resumed.sessionRef, result.sessionRef);
    }
  },
);

test(
  "all four official CLIs execute a real fixture tool and return its result to the model",
  { skip: process.env.PAMIYA_REAL_AGENT_TESTS !== "1", timeout: 180000 },
  async (t) => {
    const directory = await temporary(t);
    await writeFile(resolve(directory, "fixture.txt"), "PAMIYA_TOOL_OK");
    for (const agent of await discoverAgents(
      parseCapabilities({}),
      directory,
    )) {
      let requested = false,
        observed = false;
      const result = await runAgent({
        agent,
        input: {
          prompt: "Read fixture.txt and report its contents.",
          modelRoute: { provider: "test", model: "pamiya-test" },
          timeoutSeconds: 45,
        },
        taskId: randomUUID(),
        directory,
        workspace: directory,
        publicTest: false,
        signal: new AbortController().signal,
        modelCall: async (request) => {
          if (
            JSON.stringify(
              request.messages.filter((message) => message.role === "tool"),
            ).includes("PAMIYA_TOOL_OK")
          )
            observed = true;
          const tool = request.tools?.find((tool) =>
            /(^read$|^Read$|^exec_command$)/.test(tool.name),
          );
          if (!requested && tool) {
            requested = true;
            const input =
              tool.name === "exec_command"
                ? { cmd: "cat fixture.txt", max_output_tokens: 100 }
                : agent.id === "pi"
                  ? { path: "fixture.txt" }
                  : { file_path: resolve(directory, "fixture.txt") };
            return {
              blocks: [
                {
                  type: "tool-call",
                  id: "call_fixture",
                  name: tool.name,
                  arguments: JSON.stringify(input),
                },
              ],
              finishReason: "tool-calls",
            };
          }
          return {
            blocks: [{ type: "text", text: "PAMIYA_TOOL_OK" }],
            finishReason: "stop",
          };
        },
      });
      assert.equal(result.answer, "PAMIYA_TOOL_OK", agent.id);
      assert.equal(
        observed,
        true,
        `${agent.id} must return the real tool result to the shared model`,
      );
    }
  },
);

test("configured custom worker action is discovered and delegates with one durable callback", async (t) => {
  const directory = await temporary(t);
  let saved;
  const secrets = new Map(),
    callbacks = [];
  const controller = await new Controller({
    home: directory,
    autoLocal: true,
    onComplete: async (task) => {
      callbacks.push(task.id);
      return true;
    },
    store: {
      load: async () => saved,
      save: async (value) => {
        saved = structuredClone(value);
      },
    },
    secrets: {
      get: async (id) => secrets.get(id),
      set: async (id, value) => secrets.set(id, value),
    },
  }).init();
  t.after(() => controller.close());
  const until = async (check) => {
    const end = Date.now() + 8000;
    while (Date.now() < end) {
      if (check()) return;
      await new Promise((done) => setTimeout(done, 20));
    }
    throw new Error("Worker did not settle");
  };
  await until(() =>
    controller.snapshot().workers.some((worker) => worker.status === "ready"),
  );
  const action = {
    name: "custom.echo",
    description: "Echo input",
    command: process.execPath,
    args: ["-e", "process.stdin.pipe(process.stdout)"],
    inputSchema: {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
      additionalProperties: false,
    },
  };
  const configured = await controller.dispatch({
    action: "worker.configure",
    input: { capabilities: { actions: [action] } },
  });
  await until(
    () =>
      controller.state.tasks.find((task) => task.id === configured.id)
        .status === "succeeded" &&
      controller
        .snapshot()
        .workers.some((worker) => worker.actions.includes("custom.echo")),
  );
  const result = await controller.toolRun(
    { action: "custom.echo", input: { text: "你好" } },
    {
      callId: "custom-call",
      agent: { session: { id: "test-session" } },
      signal: new AbortController().signal,
    },
  );
  assert.ok(result.taskId);
  assert.ok(result.callback);
  await until(
    () =>
      controller.state.tasks.find((task) => task.id === result.taskId)
        .status === "succeeded",
  );
  assert.deepEqual(
    controller.state.tasks.find((task) => task.id === result.taskId).result,
    { text: "你好" },
  );
  await controller.tick();
  await controller.tick();
  assert.deepEqual(callbacks, [result.taskId]);
});

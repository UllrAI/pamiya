import test from "node:test";
import assert from "node:assert/strict";
import { apply } from "../src/host.js";

test("DSH adapter registers authenticated shared API routes, structured failures and actual tools", async () => {
  const routes = new Map(),
    tools = new Map(),
    effects = [];
  let stored;
  const ctx = {
    storageDomain: {
      open: async (spec) => ({
        table: () => ({
          get: () => stored,
          put: async (_key, value) => {
            stored = spec.tables.state.valueSchema.parse(value);
          },
        }),
        close: async () => {},
      }),
    },
    credentials: {
      readRecord: async () => undefined,
      modifyRecord: async () => {},
      deleteRecord: async () => {},
    },
    connection: {
      fetch: { register: (route) => routes.set(route.path, route) },
    },
    tools: { register: (tool) => tools.set(tool.name, tool) },
    effect: (factory) => {
      effects.push(factory());
    },
  };
  try {
    await apply(ctx);
    assert.equal(routes.size, 12);
    assert.equal(tools.size, 3);
    const call = async (endpoint, payload = {}) => {
      const response = await routes.get(`/api/pamiya/${endpoint}`).fetch(
        new Request(`http://localhost/api/pamiya/${endpoint}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            type: "client-request",
            rpcId: "test",
            method: `pamiya/${endpoint}`,
            payload,
          }),
        }),
      );
      return response.json();
    };
    const state = await call("snapshot");
    assert.equal(state.type, "server-response");
    assert.equal(state.result.ok, true);
    assert.equal(state.result.value.connection.status, "disconnected");
    const invalid = await call("invite", { label: "" });
    assert.equal(invalid.result.ok, false);
    assert.equal(typeof invalid.result.error.code, "string");
    assert.equal(typeof invalid.result.error.message, "string");
    assert.deepEqual(invalid.result.error.details, {});
    const roster = await tools.get("pamiya_workers").execute();
    assert.equal(roster.workers.length, 0);
    assert.equal(roster.publicTest, true);
    await assert.rejects(
      tools.get("pamiya_execute").execute(
        { action: "system.check", input: {} },
        {
          callId: "call-1",
          agent: { session: { id: "session-1" } },
          signal: new AbortController().signal,
        },
      ),
    );
  } finally {
    for (const dispose of effects.reverse()) await dispose?.();
  }
});

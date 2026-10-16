import { z } from "zod";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Controller, runmqttPreset } from "./controller.js";
import { errorText } from "./protocol.js";

export const name = "pamiya";
export const inject = [
  "storageDomain",
  "credentials",
  "connection",
  "tools",
  "systemPrompt",
];
const idSchema = z.string().uuid();
const dispatchSchema = z
  .object({
    workerId: idSchema.optional(),
    action: z.enum([
      "system.check",
      "demo.echo",
      "demo.wait",
      "text.stats",
      "fs.list",
      "fs.read",
      "fs.write",
      "shell.run",
    ]),
    input: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();
const stateSpec = {
  name: "pamiya",
  version: 1,
  tables: {
    state: {
      valueSchema: z.object({
        version: z.literal(1),
        broker: z.object({
          url: z.string(),
          username: z.string(),
          namespace: z.string(),
          publicTest: z.boolean(),
        }),
        enabled: z.boolean(),
        workers: z.array(z.record(z.string(), z.unknown())),
        tasks: z.array(z.record(z.string(), z.unknown())),
        sessionTargets: z.record(z.string(), idSchema).default({}),
      }),
    },
  },
};

export async function apply(ctx, config = {}) {
  const domain = await ctx.storageDomain.open(stateSpec);
  const table = domain.table("state");
  const controller = new Controller({
    store: {
      load: () => table.get("current"),
      save: (value) => table.put("current", value),
    },
    secrets: {
      get: async (id) =>
        (await ctx.credentials.readRecord(`pamiya/${id}`))?.payload,
      delete: (id) => ctx.credentials.deleteRecord(`pamiya/${id}`),
      set: (id, payload) =>
        ctx.credentials.modifyRecord(`pamiya/${id}`, async () => ({
          kind: "grant",
          payload,
        })),
    },
    autoLocal: true,
    home: resolve(process.env.DSH_HOME || resolve(homedir(), ".dsh")),
    workerFile: fileURLToPath(new URL("./worker.js", import.meta.url)),
  });
  // Register cleanup before activation so partial initialization unwinds too.
  ctx.effect(
    () => async () => {
      await controller.close();
      await domain.close();
    },
    "pamiya: runtime",
  );
  await controller.init();
  ctx.systemPrompt.context({
    name: "pamiya:execution-target",
    order: 90,
    interpolate: false,
    text: ({ agent }) =>
      agent?.session?.id
        ? controller.conversationContext(agent.session.id)
        : "",
  });
  if (config.bootstrapDemo === true && !controller.state.enabled) {
    void (async () => {
      await controller.saveBroker({
        ...(await runmqttPreset()),
        namespace: controller.state.broker.namespace,
      });
      const deadline = Date.now() + 25000;
      while (
        !controller.closed &&
        Date.now() < deadline &&
        controller.connection.status !== "connected"
      )
        await new Promise((done) => setTimeout(done, 200));
      if (controller.closed || controller.connection.status !== "connected")
        return;
      const worker = await controller.ensureLocal();
      while (
        !controller.closed &&
        Date.now() < deadline &&
        !controller
          .snapshot()
          .workers.some(
            (worker) => worker.id === worker.id && worker.status === "ready",
          )
      )
        await new Promise((done) => setTimeout(done, 200));
      if (
        !controller.closed &&
        controller
          .snapshot()
          .workers.some(
            (worker) => worker.id === worker.id && worker.status === "ready",
          )
      )
        await controller.dispatch({
          workerId: worker.id,
          action: "system.check",
          input: {},
          intentKey: "onboarding-first-check",
        });
    })().catch(() => {
      if (!controller.closed)
        controller.connection = {
          status: "error",
          error: "首次测试连接未完成，请在连接设置中重试",
        };
    });
  }
  const handle = async (endpoint, payload) => {
    try {
      if (endpoint === "conversation") {
        const input = z
          .object({
            sessionId: z.string().min(1).max(160),
            workerId: idSchema.nullable().optional(),
          })
          .strict()
          .parse(payload);
        const target =
          input.workerId === undefined
            ? controller.conversationTarget(input.sessionId)
            : await controller.selectTarget(input.sessionId, input.workerId);
        return {
          ok: true,
          value: {
            ...target,
            workers: controller
              .snapshot()
              .workers.filter((worker) => !worker.revoked),
          },
        };
      }
      if (endpoint === "snapshot")
        return { ok: true, value: controller.snapshot() };
      if (endpoint === "preset")
        return { ok: true, value: await runmqttPreset() };
      if (endpoint === "saveBroker")
        return { ok: true, value: await controller.saveBroker(payload) };
      if (endpoint === "reconnect") {
        await controller.connect();
        return { ok: true, value: controller.snapshot() };
      }
      if (endpoint === "invite") {
        const input = z
          .object({
            label: z.string().trim().min(1).max(60),
            local: z.boolean().default(false),
          })
          .strict()
          .parse(payload);
        return {
          ok: true,
          value: await controller.invite(input.label, input.local),
        };
      }
      if (endpoint === "configureLocal") {
        const { id, ...input } = z
          .object({
            id: idSchema,
            workspace: z.string().trim().min(1).max(2000),
            allowShell: z.boolean(),
          })
          .strict()
          .parse(payload);
        return { ok: true, value: await controller.configureLocal(id, input) };
      }
      if (endpoint === "reissue")
        return {
          ok: true,
          value: await controller.reissue(idSchema.parse(payload.id)),
        };
      if (endpoint === "manage") {
        const input = z
          .object({
            id: idSchema,
            action: z.enum([
              "rename",
              "pause",
              "resume",
              "remove",
              "start",
              "stop",
              "query",
            ]),
            label: z.string().trim().min(1).max(60).optional(),
          })
          .strict()
          .parse(payload);
        if (input.action === "rename" && !input.label)
          throw new Error("请填写节点名称");
        return {
          ok: true,
          value: await controller.manage(input.id, input.action, input.label),
        };
      }
      if (endpoint === "dispatch")
        return {
          ok: true,
          value: await controller.dispatch(dispatchSchema.parse(payload)),
        };
      if (endpoint === "cancel")
        return {
          ok: true,
          value: await controller.cancel(idSchema.parse(payload.id)),
        };
      if (endpoint === "resolve") {
        const input = z
          .object({
            id: idSchema,
            status: z.enum(["succeeded", "failed", "cancelled"]),
            note: z.string().trim().min(5).max(2000),
          })
          .strict()
          .parse(payload);
        await controller.resolveTask(input);
        return { ok: true, value: controller.snapshot() };
      }
      if (endpoint === "download")
        return { ok: true, value: await controller.workerDownload() };
      throw new Error("未知操作，请更新插件后重试");
    } catch (error) {
      return {
        ok: false,
        error: {
          code: "pamiya/request-failed",
          message:
            error instanceof z.ZodError
              ? (error.issues[0]?.message ?? "输入不正确")
              : errorText(error),
          details: {},
        },
      };
    }
  };
  for (const endpoint of [
    "conversation",
    "snapshot",
    "preset",
    "saveBroker",
    "reconnect",
    "invite",
    "manage",
    "dispatch",
    "cancel",
    "resolve",
    "download",
    "reissue",
    "configureLocal",
  ]) {
    ctx.connection.fetch.register({
      path: `/api/pamiya/${endpoint}`,
      methods: ["POST"],
      requestBody: "buffered",
      async fetch(request) {
        const envelope = z
          .object({
            type: z.literal("client-request"),
            rpcId: z.string().max(128),
            method: z.literal(`pamiya/${endpoint}`),
            payload: z.unknown(),
          })
          .parse(await request.json());
        const result = await handle(endpoint, envelope.payload);
        return Response.json({
          type: "server-response",
          rpcId: envelope.rpcId,
          result,
        });
      },
    });
  }
  const output = {
    schema: {},
    render: (_args, value) => [{ type: "text", text: JSON.stringify(value) }],
  };
  ctx.tools.register({
    name: "pamiya_workers",
    description:
      "List Pamiya remote workers and their available actions. Use before selecting a worker. Public test mode supports synthetic demos only.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    output,
    isConcurrencySafe: () => true,
    execute: async (_args, exec) => ({
      target: exec?.agent?.session?.id
        ? controller.conversationTarget(exec.agent.session.id)
        : null,
      connection: controller.connection.status,
      publicTest: controller.state.broker.publicTest,
      workers: controller
        .snapshot()
        .workers.filter((worker) => !worker.revoked)
        .map(({ id, label, status, actions }) => ({
          id,
          label,
          status,
          actions: actions ?? [],
        })),
    }),
  });
  ctx.tools.register({
    name: "pamiya_execute",
    description:
      "Execute one action on a Pamiya worker and await its business result. Honor this conversation's execution target; omit workerId when a target is selected. In automatic mode, list workers first and bind workerId for a computer named by the user. Never replace a missing remote action with a native host tool. demo.echo/text.stats input={text}; demo.wait={seconds}; system.check={}; fs.list={path}; fs.read={path}; fs.write={path,text}; shell.run={command,timeoutSeconds}. Files/shell require a private connection; shell also needs explicit worker permission. Unknown/stop_requested does not mean success; use pamiya_task to reconcile, never repeat an uncertain action.",
    parameters: {
      type: "object",
      properties: {
        workerId: {
          type: "string",
          description:
            "Omit to use the conversation target. In automatic mode, set an ID from pamiya_workers for an explicitly named computer; otherwise prefers this computer then an available capable worker. Conflicting IDs are rejected when a target is selected.",
        },
        action: {
          type: "string",
          enum: [
            "system.check",
            "demo.echo",
            "demo.wait",
            "text.stats",
            "fs.list",
            "fs.read",
            "fs.write",
            "shell.run",
          ],
        },
        input: { type: "object", additionalProperties: true },
      },
      required: ["action", "input"],
      additionalProperties: false,
    },
    output,
    timeoutMs: 125000,
    isConcurrencySafe: () => true,
    execute: (args, exec) =>
      controller.toolRun(dispatchSchema.parse(args), exec),
  });
  ctx.tools.register({
    name: "pamiya_task",
    description:
      "Read a Pamiya task, ask its worker for the durable result, or request cancellation. Cancellation is confirmed only by a worker result and does not undo earlier effects.",
    parameters: {
      type: "object",
      properties: {
        taskId: { type: "string" },
        operation: { type: "string", enum: ["read", "query", "cancel"] },
      },
      required: ["taskId"],
      additionalProperties: false,
    },
    output,
    isConcurrencySafe: () => true,
    async execute(args) {
      const id = idSchema.parse(args.taskId);
      const task = controller.state.tasks.find((item) => item.id === id);
      if (!task) throw new Error("Task not found");
      if (args.operation === "cancel") return controller.cancel(id);
      if (args.operation === "query")
        await controller.send(task.workerId, "query", {}, id);
      return controller.state.tasks.find((item) => item.id === id);
    },
  });
}

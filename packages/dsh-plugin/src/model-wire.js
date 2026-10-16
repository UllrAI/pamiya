import { randomUUID } from "node:crypto";

const text = (value) =>
  typeof value === "string" ? value : JSON.stringify(value ?? "");
const replay = (value) => {
  if (typeof value !== "string" || !value.startsWith("pamiya:"))
    return undefined;
  try {
    return JSON.parse(Buffer.from(value.slice(7), "base64url").toString());
  } catch {
    return undefined;
  }
};
const opaque = (value) =>
  value === undefined
    ? undefined
    : `pamiya:${Buffer.from(JSON.stringify(value)).toString("base64url")}`;

export function decodeModelRequest(path, body) {
  const kind = path.endsWith("/responses")
    ? "responses"
    : path.endsWith("/messages")
      ? "messages"
      : path.endsWith("/chat/completions")
        ? "chat"
        : null;
  if (!kind) throw new Error("当前模型连接不支持这个 API 路径");
  const messages = [],
    systems = [],
    tools = [],
    customTools = new Set(),
    namespaces = {};
  const add = (role, content, extra = {}) => {
    if (!content.length) return;
    const previous = messages.at(-1);
    if (role === "assistant" && previous?.role === role && !extra.replayState)
      previous.content.push(...content);
    else messages.push({ role, content, ...extra });
  };
  const blocks = (value) => {
    if (typeof value === "string") return [{ type: "text", text: value }];
    return (value ?? []).flatMap((block) => {
      if (["text", "input_text", "output_text"].includes(block.type))
        return [{ type: "text", text: block.text ?? "" }];
      if (["thinking", "reasoning"].includes(block.type))
        return [
          { type: "reasoning", text: block.thinking ?? block.text ?? "" },
        ];
      if (block.type === "tool_use")
        return [
          {
            type: "tool-call",
            id: block.id,
            name: block.name,
            arguments: JSON.stringify(block.input),
          },
        ];
      if (block.type === "tool_result") return [];
      if (
        ["image", "input_image", "image_url", "document", "file"].includes(
          block.type,
        )
      )
        throw new Error(
          "当前共享模型接口接收文本和工具调用；此媒体输入请使用 Agent 的独立模型配置",
        );
      if (["redacted_thinking", "refusal"].includes(block.type))
        return block.refusal ? [{ type: "text", text: block.refusal }] : [];
      throw new Error(`共享模型接口暂不支持内容类型：${block.type}`);
    });
  };
  const rows =
    kind === "responses"
      ? typeof body.input === "string"
        ? [{ role: "user", content: body.input }]
        : (body.input ?? [])
      : (body.messages ?? []);
  if (body.system)
    systems.push(
      typeof body.system === "string"
        ? body.system
        : blocks(body.system)
            .map((x) => x.text)
            .join("\n"),
    );
  if (body.instructions) systems.push(text(body.instructions));
  for (const row of rows) {
    if (row.type === "function_call" || row.type === "custom_tool_call") {
      const name = row.namespace ? `${row.namespace}.${row.name}` : row.name;
      add("assistant", [
        {
          type: "tool-call",
          id: row.call_id,
          name,
          arguments:
            row.type === "custom_tool_call"
              ? JSON.stringify({ input: row.input })
              : row.arguments,
        },
      ]);
    } else if (
      ["function_call_output", "custom_tool_call_output"].includes(row.type)
    ) {
      add("tool", [{ type: "text", text: text(row.output) }], {
        callId: row.call_id,
      });
    } else if (row.type === "reasoning") {
      add(
        "assistant",
        (row.summary ?? []).map((item) => ({
          type: "reasoning",
          text: item.text ?? "",
        })),
        { replayState: replay(row.encrypted_content) },
      );
    } else if (["system", "developer"].includes(row.role))
      systems.push(
        blocks(row.content)
          .map((x) => x.text ?? "")
          .join("\n"),
      );
    else if (row.role === "tool")
      add("tool", blocks(row.content), { callId: row.tool_call_id });
    else {
      const toolResults = Array.isArray(row.content)
        ? row.content.filter((x) => x.type === "tool_result")
        : [];
      for (const result of toolResults)
        add(
          "tool",
          [
            {
              type: "text",
              text:
                typeof result.content === "string"
                  ? result.content
                  : blocks(result.content)
                      .map((x) => x.text ?? "")
                      .join("\n"),
            },
          ],
          { callId: result.tool_use_id },
        );
      const content = blocks(row.content);
      if (row.reasoning_content)
        content.unshift({ type: "reasoning", text: row.reasoning_content });
      for (const call of row.tool_calls ?? [])
        content.push({
          type: "tool-call",
          id: call.id,
          name: call.function.name,
          arguments: call.function.arguments,
        });
      const state = Array.isArray(row.content)
        ? row.content.map((x) => replay(x.signature)).find(Boolean)
        : undefined;
      add(
        row.role === "assistant" ? "assistant" : "user",
        content,
        state ? { replayState: state } : {},
      );
    }
  }
  const addTool = (tool, namespace) => {
    if (tool.type === "namespace") {
      for (const child of tool.tools ?? []) addTool(child, tool.name);
      return;
    }
    const fn = tool.function ?? tool;
    if (![undefined, "function", "custom"].includes(tool.type))
      throw new Error(
        `所选 Agent 请求了提供商专用工具 ${tool.type}，请使用独立模型配置`,
      );
    const name = namespace ? `${namespace}.${fn.name}` : fn.name;
    if (namespace) namespaces[name] = namespace;
    if (tool.type === "custom") customTools.add(name);
    tools.push({
      name,
      description: fn.description ?? "",
      parameters:
        tool.type === "custom"
          ? {
              type: "object",
              properties: { input: { type: "string" } },
              required: ["input"],
              additionalProperties: false,
            }
          : (fn.input_schema ??
            fn.parameters ?? { type: "object", properties: {} }),
    });
  };
  for (const tool of body.tools ?? []) addTool(tool);
  const toolNames = {},
    providerNames = {};
  tools.forEach((tool, index) => {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(tool.name)) {
      const original = tool.name;
      const safe = `pamiya_tool_${index}`;
      toolNames[safe] = original;
      providerNames[original] = safe;
      tool.name = safe;
      tool.description = `${original}: ${tool.description}`;
    }
  });
  for (const message of messages)
    for (const block of message.content)
      if (block.type === "tool-call" && providerNames[block.name])
        block.name = providerNames[block.name];

  return {
    kind,
    body,
    customTools,
    namespaces,
    toolNames,
    request: {
      system: systems.join("\n\n"),
      messages,
      tools,
      maxTokens: body.max_tokens ?? body.max_output_tokens,
      temperature: body.temperature,
    },
  };
}

export function encodeModelResponse(decoded, result) {
  const id = `msg_${randomUUID().replaceAll("-", "")}`;
  const usage = result.usage ?? { inputTokens: 0, outputTokens: 0 };
  const blocks = (result.blocks ?? []).map((block) =>
    block.type === "tool-call" && decoded.toolNames?.[block.name]
      ? { ...block, name: decoded.toolNames[block.name] }
      : block,
  );
  const calls = blocks.filter((x) => x.type === "tool-call");
  const content = blocks
    .filter((x) => x.type === "text")
    .map((x) => x.text)
    .join("");
  const signature = opaque(result.replayState);
  if (decoded.kind === "messages") {
    return {
      id,
      type: "message",
      role: "assistant",
      model: decoded.body.model,
      content: blocks.map((block) =>
        block.type === "tool-call"
          ? {
              type: "tool_use",
              id: block.id,
              name: block.name,
              input: JSON.parse(block.arguments || "{}"),
            }
          : block.type === "reasoning"
            ? {
                type: "thinking",
                thinking: block.text,
                ...(signature ? { signature } : {}),
              }
            : { type: "text", text: block.text ?? "" },
      ),
      stop_reason: calls.length
        ? "tool_use"
        : result.finishReason === "max-tokens"
          ? "max_tokens"
          : "end_turn",
      stop_sequence: null,
      usage: {
        input_tokens: usage.inputTokens + (usage.cacheReadTokens ?? 0),
        output_tokens: usage.outputTokens,
      },
    };
  }
  if (decoded.kind === "chat")
    return {
      id,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: decoded.body.model,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: content || null,
            ...(calls.length
              ? {
                  tool_calls: calls.map((call) => ({
                    id: call.id,
                    type: "function",
                    function: { name: call.name, arguments: call.arguments },
                  })),
                }
              : {}),
          },
          finish_reason: calls.length ? "tool_calls" : "stop",
        },
      ],
      usage: {
        prompt_tokens: usage.inputTokens,
        completion_tokens: usage.outputTokens,
        total_tokens:
          usage.totalTokens ?? usage.inputTokens + usage.outputTokens,
      },
    };
  const output = [];
  const reasoning = blocks.filter((x) => x.type === "reasoning");
  if (reasoning.length || signature)
    output.push({
      id: `rs_${randomUUID()}`,
      type: "reasoning",
      summary: reasoning.map((x) => ({ type: "summary_text", text: x.text })),
      ...(signature ? { encrypted_content: signature } : {}),
    });
  if (content)
    output.push({
      id,
      type: "message",
      role: "assistant",
      status: "completed",
      content: [{ type: "output_text", text: content, annotations: [] }],
    });
  for (const call of calls) {
    const namespace = decoded.namespaces[call.name];
    const common = {
      id: `fc_${randomUUID()}`,
      call_id: call.id,
      name: namespace ? call.name.slice(namespace.length + 1) : call.name,
      ...(namespace ? { namespace } : {}),
      status: "completed",
    };
    output.push(
      decoded.customTools.has(call.name)
        ? {
            ...common,
            type: "custom_tool_call",
            input: JSON.parse(call.arguments).input,
          }
        : { ...common, type: "function_call", arguments: call.arguments },
    );
  }
  return {
    id: `resp_${randomUUID()}`,
    object: "response",
    created_at: Math.floor(Date.now() / 1000),
    status: result.finishReason === "max-tokens" ? "incomplete" : "completed",
    model: decoded.body.model,
    output,
    output_text: content,
    usage: {
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
      total_tokens: usage.totalTokens ?? usage.inputTokens + usage.outputTokens,
    },
  };
}

export function responseEvents(kind, response) {
  if (kind === "messages") {
    const events = [
      {
        type: "message_start",
        message: {
          ...response,
          content: [],
          stop_reason: null,
          usage: { ...response.usage, output_tokens: 0 },
        },
      },
    ];
    response.content.forEach((block, index) => {
      const initial =
        block.type === "tool_use"
          ? { ...block, input: {} }
          : block.type === "thinking"
            ? { type: "thinking", thinking: "" }
            : { type: "text", text: "" };
      events.push({
        type: "content_block_start",
        index,
        content_block: initial,
      });
      events.push({
        type: "content_block_delta",
        index,
        delta:
          block.type === "tool_use"
            ? {
                type: "input_json_delta",
                partial_json: JSON.stringify(block.input),
              }
            : block.type === "thinking"
              ? { type: "thinking_delta", thinking: block.thinking }
              : { type: "text_delta", text: block.text },
      });
      if (block.signature)
        events.push({
          type: "content_block_delta",
          index,
          delta: { type: "signature_delta", signature: block.signature },
        });
      events.push({ type: "content_block_stop", index });
    });
    return [
      ...events,
      {
        type: "message_delta",
        delta: { stop_reason: response.stop_reason, stop_sequence: null },
        usage: response.usage,
      },
      { type: "message_stop" },
    ];
  }
  if (kind === "responses") {
    const events = [
      {
        type: "response.created",
        response: { ...response, status: "in_progress", output: [] },
      },
      {
        type: "response.in_progress",
        response: { ...response, status: "in_progress", output: [] },
      },
    ];
    response.output.forEach((item, output_index) => {
      events.push({
        type: "response.output_item.added",
        output_index,
        item: {
          ...item,
          status: "in_progress",
          ...(item.type === "message"
            ? { content: [] }
            : item.type === "function_call"
              ? { arguments: "" }
              : item.type === "custom_tool_call"
                ? { input: "" }
                : {}),
        },
      });
      if (item.type === "message")
        events.push({
          type: "response.output_text.delta",
          item_id: item.id,
          output_index,
          content_index: 0,
          delta: item.content[0].text,
        });
      if (item.type === "function_call")
        events.push({
          type: "response.function_call_arguments.delta",
          item_id: item.id,
          output_index,
          delta: item.arguments,
        });
      if (item.type === "custom_tool_call")
        events.push({
          type: "response.custom_tool_call_input.delta",
          item_id: item.id,
          output_index,
          delta: item.input,
        });
      events.push({ type: "response.output_item.done", output_index, item });
    });
    return [
      ...events,
      {
        type:
          response.status === "incomplete"
            ? "response.incomplete"
            : "response.completed",
        response,
      },
    ].map((event, sequence_number) => ({ ...event, sequence_number }));
  }
  const choice = response.choices[0];
  return [
    {
      ...response,
      object: "chat.completion.chunk",
      choices: [{ index: 0, delta: choice.message, finish_reason: null }],
    },
    {
      ...response,
      object: "chat.completion.chunk",
      choices: [{ index: 0, delta: {}, finish_reason: choice.finish_reason }],
    },
  ];
}

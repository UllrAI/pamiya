# Agents and custom actions on workers

[Quickstart](quickstart.md) · [简体中文](../zh-CN/agent-workers.md)

Pamiya keeps DSH as the conversation entry point. Workers execute small tools, custom actions, or real DSH, Codex, Claude Code and Pi agents through their official CLIs. Users choose where model configuration and authentication come from.

## First use

The local worker connects automatically without MQTT. Open **Pamiya → This computer → Agent capabilities** to see detected agents; click **Install** for a missing one. Installation downloads pinned packages from the official npm registry into the worker directory, without changing global installations. Activity shows the installation result. Network access and supported platforms are required.

**Share DSH** is selected by default. **Synthetic test** asks only for `PAMIYA_AGENT_OK`; Activity shows the returned answer. Synthetic tests always use the shared model, an isolated test directory and no personal agent login. They verify startup, model requests, status and results, rather than every possible tool or workflow.

Configure MQTT only when connecting another computer. Public RunMQTT supports synthetic tests only; remote personal files, commands, custom actions and free-form agent jobs require a private connection. Local jobs use process IPC and do not cross the public broker.

## Models and authentication

| Choice | Behavior |
|---|---|
| Share DSH (default) | Conversation delegation captures the originating conversation’s model route. The Host’s DSH model service handles authentication. The worker agent calls a temporary loopback model endpoint; requests return to the Host through the existing encrypted link. No separate login or copy of the credential store is required. Management-page tests use the DSH default model. |
| Independent settings | Uses the selected agent’s existing model configuration and login on that computer. The UI can override its model name; a Pi provider can be set in the worker’s `capabilities.json`. Complete that agent’s login or provider setup on that computer first. |

Independent configuration is explicit: missing authentication fails rather than silently switching to shared mode. The shared interface supports text and local tool calls through Anthropic Messages, OpenAI Responses and Chat Completions. Provider-hosted tools and proprietary image/document inputs require independent mode. Sharing a DSH model uses that configured provider and billing source; it does not transfer Codex or Claude subscription entitlements to another provider.

Commands and full agents run as the worker’s OS user. File-tool directory checks do not create an OS sandbox around a full agent. Native permission policies remain in effect; Pamiya does not add approval-bypass flags. Tasks requiring interactive authorization may not continue in a headless CLI; configure the native agent on that computer before retrying.

## Skills, plugins and worker environments

[On-demand Skills, dependency checks and Prepare and continue](skills.md) are implemented for DSH, Codex, Claude Code and Pi. Select complete Skills and resources: local workers read snapshots directly, while remote workers download through HTTPS file relay storage. MQTT carries file references only. Workers check optional `pamiya.json` declarations, prepare installable dependencies in isolated environments, then continue the original task.

Model/authentication sharing is the default; Skills follow the task selection. MCP, plugins, project files and personal credentials do not migrate automatically. Native worker capabilities remain managed by their Agent.

## Delegate from a conversation

Choose a computer from **Execution worker** in the composer’s bottom toolbar, or name a computer while using **Automatic**. For example:

> Use Pamiya’s Codex on the selected computer to analyze this test project. Share the current DSH model and report back here when finished.

For a public connection:

> Verify DSH, Codex, Claude Code and Pi on the Linux test worker using fixed synthetic jobs only. Do not read files. Run them sequentially on the same worker, waiting for each result before starting the next.

DSH queries `pamiya_workers` and submits work with `pamiya_delegate`. The tool returns a durable task ID immediately so long jobs do not hold the conversation open. Completion, failure and unknown outcomes return to the originating conversation. Delivery waits while the conversation is unloaded and resumes when it is opened again. A stable callback message ID prevents duplicate results from starting duplicate work. Worker output remains untrusted data, not new authorization.

`pamiya_task` reads progress and results, queries the worker journal, or requests cancellation. Stopping a process does not undo changes; cancellation of potentially mutating work remains unknown until reconciled. Neither worker nor Host restart automatically replays uncertain work.

## Resume and artifacts

Results include `sessionRef`. Submit it with the same agent and model source to resume the native session. The reference identifies a worker-owned session rather than an arbitrary file path. DSH, Codex and Claude use native session IDs; Pi uses a dedicated session file. Task details also provide a continuation entry.

Results include the answer, session information and registered artifacts. Full JSONL events stay at `runs/<task-id>/events.jsonl` on the worker; returned answers retain at most 24,000 characters. Call `agent.artifact` with `{taskId, name, offset}` to read a registered artifact in Base64 chunks, with the next offset and completion flag. Arbitrary file paths are not accepted. File artifacts currently include new or modified top-level workspace files; nested artifacts must be reported by the agent or read through that worker’s file tools.

## Custom actions

Expand **Edit action definitions (JSON)** in worker details and save the definitions. Public remote connections do not enable custom commands; local and private remote workers support them. Alternatively edit `capabilities.json` in the worker directory, then refresh capabilities through the UI or restart the worker.

```json
{
  "version": 1,
  "actions": [
    {
      "name": "custom.echo",
      "description": "Echo a JSON input for a connectivity check",
      "command": "python3",
      "args": ["-c", "import sys,json; print(json.dumps(json.load(sys.stdin)))"],
      "inputSchema": {
        "type": "object",
        "properties": {"text": {"type": "string"}},
        "required": ["text"],
        "additionalProperties": false
      },
      "timeoutSeconds": 120
    }
  ],
  "agents": {
    "dsh": {"enabled": true, "modelSource": "inherit"},
    "codex": {"enabled": true, "modelSource": "inherit"},
    "claude": {"enabled": true, "modelSource": "independent"},
    "pi": {"enabled": true, "modelSource": "independent", "provider": "anthropic"}
  }
}
```

The UI editor takes only the `actions` array; agent settings are saved separately. Input is checked against JSON Schema and written to the process as JSON on stdin. The owner defines the command and fixed args; user parameters are never interpolated into a shell. stdout may be JSON or text; nonzero exit status fails the action. `pamiya_workers` advertises names, descriptions and input schemas so `pamiya_execute` can call `custom.*`. Custom actions return an asynchronous task ID and callback so DSH’s single-tool timeout does not cut long actions short. Inspect or cancel through `pamiya_task`.

## Verification scope

An optional integration check exercises all four installed official CLIs, the shared model interface and native continuation:

```sh
PAMIYA_REAL_AGENT_TESTS=1 npm run plugin:test
```

It uses controlled model responses to verify adapter protocols. Actual DSH model, physical-worker, cancellation and callback evidence belongs in the [verification record](dsh-verification.md). Generic tests do not establish Windows hardware support or validate every third-party independent login.

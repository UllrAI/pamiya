# Pamiya installation task for DSH

[User quickstart](quickstart.md) · [简体中文](../zh-CN/install-with-dsh.md)

In a new DSH conversation, select **Creator mode** and send:

> Read and follow https://raw.githubusercontent.com/UllrAI/pamiya/main/docs/en/install-with-dsh.md to install Pamiya for me.

This is a self-contained installation task. A user asking you to follow it authorizes installing and enabling this plugin in the **current DSH profile**. If `plugin_manager` is unavailable, ask them to select Creator mode; otherwise use the UI fallback below.

## Installation target

- Package: `@pamiya/dsh-plugin`, version `0.2.0`.
- Release: https://github.com/UllrAI/pamiya/releases/tag/v0.2.0
- Installation spec: `https://github.com/UllrAI/pamiya/releases/download/v0.2.0/pamiya-dsh-plugin-0.2.0.tgz`
- Verified Hosts: DSH `0.2.0-rc.2` and `0.2.1-alpha.4`. Other versions remain subject to the Host’s compatibility checks.
- Preserve existing models, conversations, workspaces, other plugins and connection settings. This prebuilt package needs no clone, source build or npm publication.

## Procedure

1. Call `plugin_manager` with `action="list_bundles"`, paging if needed, to check for `@pamiya/dsh-plugin`. Do not reinstall an enabled existing copy. If its version/source differs, explain the actual state before following an update flow; do not delete its data directory.
2. If absent, call:

```json
{
  "action": "install_bundle",
  "target": "https://github.com/UllrAI/pamiya/releases/download/v0.2.0/pamiya-dsh-plugin-0.2.0.tgz",
  "enabled": true
}
```

For an installed disabled copy, use `set_bundle` with `target="@pamiya/dsh-plugin"` and `enabled=true`. Follow DSH’s normal installation prompts. If dependency scripts require separate approval, name the actual packages and await that approval.

3. Follow the actual result. Continue after `applied`; for `restart-required`, ask the user to fully quit and reopen DSH before verification. Download completion or a pending restart does not establish readiness.
4. Call `list_bundles` again to verify installation and enablement. Call `pamiya_workers` once the tool catalog refreshes; finish any required restart first.
5. An unconfigured MQTT connection is expected. This computer joins automatically through the local channel without a public service or duplicate enrollment. Open **Pamiya → Connection** only when adding remote computers.
6. Once `pamiya_workers` reports a ready Worker, pass its actual ID to `pamiya_execute` with `action="system.check"`, `input={}`. Optionally run `text.stats` with `{"text":"Hello Pamiya"}`, expecting 12 characters, 1 line and 2 words. Judge success from actual tool results.
7. Report the actual installed version, completed stage, local readiness and how to add another computer. Say “installed and verified” only after real execution succeeds.

## Failure handling

- Download failure: offer the release page so the user can download the `.tgz`; use its absolute local path as the `install_bundle` target or use the UI. Do not substitute `github:UllrAI/pamiya`: the repository root is not an installable plugin package.
- Version incompatibility: report the actual Host version and requirements without silently adding an exemption.
- No management tool: guide the user to **Plugins → Add plugin**, paste the full installation URL, install and select **Enable now**. Do not rewrite the entire profile.
- Public connections use synthetic tests only. Pair remote computers separately through Pamiya without collecting or publishing credentials in installation documentation.

See the [quickstart](quickstart.md) for self-service steps, remote Worker setup and troubleshooting.

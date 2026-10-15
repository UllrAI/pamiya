# DSH plugin verification record

[Usage guide](dsh-plugin.md) · [简体中文](../zh-CN/dsh-verification.md)

Verified: 2026-10-16. Screenshots show an actual DSH Web Host, not `prototype/`.

## Verified

- Both the `0.2.0-rc.2` and `0.2.1-alpha.4` DSH Web compositions loaded the plugin, sidebar, authenticated API and tools. The Desktop plugin is installed; native-window acceptance remained pending because the Mac was locked.
- In `0.2.1-alpha.4`, a local macOS Worker and an independent Linux x64 server Worker connected through public RunMQTT. Both completed statistics on the same synthetic text and returned real results.
- A remote 90-second wait was started and stopped through the UI. The UI received Stopped, and the remote journal recorded cancellation with the Host acknowledgement.
- The Linux Worker uses a separate Node.js 24.22.0 runtime from the official release with SHA-256 verification and a systemd service. Restarting the service restored its connection and retained the execution journal. Configuration/journal permissions are 600.
- Plugin reload restored the managed local Worker. Automated tests also verify that a deliberately stopped Worker remains stopped and that the local identity is not duplicated.
- Chinese/English switching, default remote pairing, prevention of duplicate local workers, task lists and status feedback were exercised in the real Host.
- Fourteen automated tests cover real MQTT workers, deduplication, confirmed cancellation, pause, Host restart, forced Worker death, path scope, private files/commands, local capability settings, pre-aborted tools, Host API and installation settings.
- Plugin production dependencies have zero audit findings. Existing low-severity KaTeX/Mermaid findings in documentation tooling remain separate; this implementation does not introduce an unrelated major upgrade.

![Local and remote workers](../../packages/dsh-plugin/design/two-workers.en.png)

![Tasks completed by both workers](../../packages/dsh-plugin/design/activity.zh-CN.png)

## Pending verification

Final operation in the native Desktop window, a real model initiating the tools, and Windows/other desktop process behavior remain pending. Personal API keys were not copied into a test Host to demonstrate a model call; all test inputs were synthetic. Private files and explicitly enabled commands passed local real-process tests and were not exercised through the public service.

This evidence establishes the current implementation path, not a multi-tenant production platform, OS sandbox or automatic failover.

[Confirmed remote stop](../../packages/dsh-plugin/design/remote-cancel.zh-CN.png).

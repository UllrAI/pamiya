import React, { useState, useEffect, useRef } from "react";
import {
  Menu,
  Tooltip,
  IconFollowsystemOutlineRegular,
  IconChevronDownOutlineRegular,
  IconSparkleRegular,
  IconSettingsOutlineRegular,
} from "@deepseek-ai/dsh-client-ui-primitives";
import styles from "./client.css";

const copy = {
  actionAgentDemo: ["Agent 合成验证", "Agent synthetic test"],
  actionAgentRun: ["Agent 任务", "Agent task"],
  actionAgentInstall: ["安装 Agent", "Install agent"],
  actionInspect: ["读取节点能力", "Read worker capabilities"],
  actionConfigure: ["更新节点能力", "Update worker capabilities"],
  actionArtifact: ["读取任务产物", "Read task artifact"],
  ownModel: [
    "模型（可选，留空使用 Agent 默认值）",
    "Model (optional; uses the agent default)",
  ],
  ownProvider: ["提供商（Pi，可选）", "Provider (Pi, optional)"],
  syntheticModelHint: [
    "合成验证始终使用 DSH 共享模型，不读取该 Agent 的个人登录信息。",
    "Synthetic tests always use the shared DSH model, without reading the agent’s personal login.",
  ],
  agentTitle: ["Agent 能力", "Agent capabilities"],
  agentHint: [
    "默认复用 DSH 模型与鉴权，也可使用节点自己的配置。Skills 暂不同步。",
    "Share DSH model/authentication or use this worker’s own settings. Skills are not synced yet.",
  ],
  inheritModel: ["复用 DSH（默认）", "Share DSH (default)"],
  independentModel: ["独立配置", "Independent settings"],
  installAgent: ["安装", "Install"],
  testAgent: ["合成验证", "Synthetic test"],
  installedAgent: ["已检测到", "Detected"],
  absentAgent: ["尚未安装", "Not installed"],
  saveAgents: ["保存 Agent 设置", "Save agent settings"],
  customTitle: ["自定义动作", "Custom actions"],
  customHint: [
    "动作通过标准输入接收 JSON 参数，并从标准输出返回结果。命令以这台电脑的用户身份执行；不会把参数拼接到 shell。",
    "Actions receive JSON on stdin and return stdout. Commands run as this computer’s user; inputs are never interpolated into a shell.",
  ],
  advancedActions: ["编辑动作定义（JSON）", "Edit action definitions (JSON)"],
  saveActions: ["保存动作", "Save actions"],
  loadingAgents: [
    "正在读取这台电脑的能力…",
    "Reading this computer’s capabilities…",
  ],
  agentQueued: [
    "任务已提交，请在运行记录查看进度与结果。",
    "Task submitted. View progress and results in Activity.",
  ],
  localReady: ["本机已自动连接", "This computer connects automatically"],
  localFirstHint: [
    "先完成一个本机任务，再按需接入其他电脑。无需先配置消息服务。",
    "Start with a local task, then connect other computers when needed. No message service setup is needed for this computer.",
  ],
  localFirstTest: ["验证本机连接", "Check this computer"],
  remoteLater: ["接入另一台电脑", "Connect another computer"],
  progressTitle: ["最新进展", "Latest progress"],

  executionTarget: ["执行节点", "Execution worker"],
  automatic: ["自动选择", "Automatic"],
  automaticHint: [
    "优先本机，也可在消息中指定节点",
    "Prefer this computer, or name a worker",
  ],
  targetScope: [
    "仅影响 Pamiya 工具，DSH 自带工具仍在本机。",
    "Applies to Pamiya tools. Native DSH tools stay local.",
  ],
  targetHint: [
    "选择此对话使用的执行节点",
    "Choose this conversation’s execution worker",
  ],
  targetEmpty: [
    "还没有节点，请先添加或连接",
    "No workers yet. Add or connect one to begin.",
  ],
  manageWorkers: ["管理节点", "Manage workers"],
  removedTarget: ["所选节点已移除", "Selected worker removed"],
  updatePairing: ["更新连接 / 重新配对", "Update connection / pair again"],
  stopRemote: [
    "先在远程电脑按 Ctrl+C 停止旧进程，再运行新命令。",
    "Stop the old process with Ctrl+C on the remote computer before running the new command.",
  ],
  title: ["Pamiya", "Pamiya"],
  subtitle: [
    "让 Agent 在你的多台电脑与设备上完成工作。",
    "Let your Agent work across your computers and devices.",
  ],
  workers: ["计算节点", "Workers"],
  runs: ["运行记录", "Activity"],
  connection: ["连接设置", "Connection"],
  add: ["添加节点", "Add worker"],
  ready: ["可用", "Ready"],
  busy: ["工作中", "Busy"],
  offline: ["离线", "Offline"],
  pairing: ["等待连接", "Waiting to pair"],
  paused: ["已暂停分配", "Paused"],
  revoked: ["已移除", "Removed"],
  connected: ["已连接", "Connected"],
  connecting: ["正在连接", "Connecting"],
  reconnecting: ["正在重连", "Reconnecting"],
  disconnected: ["未连接", "Disconnected"],
  error: ["连接异常", "Connection error"],
  succeeded: ["已完成", "Completed"],
  failed: ["未完成", "Failed"],
  cancelled: ["已停止", "Stopped"],
  unknown: ["结果待核对", "Result unknown"],
  sent: ["已发送", "Sent"],
  running: ["执行中", "Running"],
  stop_requested: ["正在请求停止", "Stop requested"],
  close: ["关闭", "Close"],
  cancel: ["取消", "Cancel"],
  save: ["保存", "Save"],
  hostUnavailable: [
    "暂时连不上 DSH，正在重新连接…",
    "DSH is temporarily unavailable. Reconnecting…",
  ],
  saving: ["处理中…", "Working…"],
  rename: ["节点名称", "Worker name"],
  apply: ["保存名称", "Save name"],
  pause: ["暂停分配", "Pause assignments"],
  resume: ["恢复分配", "Resume assignments"],
  stop: ["停止本机节点", "Stop local worker"],
  start: ["启动本机节点", "Start local worker"],
  remove: ["移除节点", "Remove worker"],
  removeHint: [
    "移除后不再接受此节点的结果。远程进程需在对应电脑上停止。",
    "Stops accepting this worker. Stop the remote process on its computer.",
  ],
  localAccess: ["本机能力", "Local capabilities"],
  localWorkspace: ["允许读写的文件夹", "Folder for file access"],
  allowShell: [
    "允许命令执行（以当前用户身份运行，不受文件夹限制）",
    "Allow commands (runs as your user, not restricted to this folder)",
  ],
  saveAccess: ["保存并重启本机节点", "Save and restart local worker"],
  local: ["这台电脑", "This computer"],
  remote: ["另一台电脑或服务器", "Another computer or server"],
  localHint: [
    "无需安装，Pamiya 自动启动并管理。",
    "No separate installation. Pamiya starts and manages it.",
  ],
  remoteHint: [
    "下载 Worker，再复制一条配对命令。",
    "Download the Worker and copy one pairing command.",
  ],
  create: ["创建并连接", "Create and connect"],
  nameHint: [
    "例如：工作电脑、家里的服务器",
    "For example: Office computer or Home server",
  ],
  public: ["RunMQTT 公共测试连接", "RunMQTT public test connection"],
  private: ["自己的 MQTT 服务", "Your MQTT service"],
  publicHint: [
    "仅用于演示，不发送个人文件。节点之间的消息会加密；公共服务可能轮换账号或暂时不可用。",
    "Synthetic demos only, without personal files. Messages are encrypted; shared service credentials and availability may change.",
  ],
  privateHint: [
    "使用自己的连接后，可按节点授权文件和命令能力。",
    "Use your own broker to enable file and command capabilities per worker.",
  ],
  url: ["服务地址", "Broker URL"],
  username: ["用户名", "Username"],
  password: ["密码", "Password"],
  passwordHint: [
    "留空保留当前密码",
    "Leave blank to keep the current password",
  ],
  passwordNew: [
    "服务密码；匿名连接可留空",
    "Broker password; leave blank for anonymous access",
  ],
  preset: ["填入当前测试参数", "Load current test parameters"],
  connect: ["保存并连接", "Save and connect"],
  reconnect: ["重新连接", "Reconnect"],
  details: ["高级信息", "Advanced details"],
  namespace: ["连接空间", "Connection namespace"],
  setupTitle: ["先连接，再交给 Agent", "Connect, then put your Agent to work"],
  setupHint: [
    "连接后，这台电脑会自动加入。添加其他电脑，就能在原来的对话里协同执行。",
    "This computer joins automatically after connecting. Add other computers to work together in your existing conversations.",
  ],
  step1: ["1. 连接服务", "1. Connect"],
  step2: ["2. 本机自动加入", "2. This computer joins"],
  step3: ["3. 完成第一次任务", "3. Try a task"],
  localQuick: ["连接这台电脑", "Connect this computer"],
  noWorkers: ["本机节点将自动加入", "This computer joins automatically"],
  noWorkersHint: [
    "保存连接后，Pamiya 自动启动本机节点。也可以添加其他电脑或服务器。",
    "Save your connection to start this computer automatically. You can also add another computer or server.",
  ],
  test: ["检查连接", "Check connection"],
  tryAll: ["体验多节点", "Try multiple workers"],
  tryHint: [
    "向每个可用节点发送同一份演示文本，比较真实执行结果。",
    "Send the same synthetic text to every available worker and compare real results.",
  ],
  lastSeen: ["最近响应", "Last response"],
  capabilities: ["可用能力", "Available capabilities"],
  online: ["个节点可用", "workers available"],
  all: ["全部", "All"],
  search: ["搜索节点名称", "Search worker names"],
  noMatch: ["没有匹配的节点", "No matching workers"],
  noRuns: ["还没有运行记录", "No activity yet"],
  noRunsHint: [
    "检查一个节点，或在对话中让 Agent 使用 Pamiya。",
    "Check a worker, or ask your Agent to use Pamiya.",
  ],
  view: ["查看结果", "View result"],
  task: ["任务", "Task"],
  input: ["输入", "Input"],
  result: ["结果", "Result"],
  requestStop: ["请求停止", "Request stop"],
  query: ["核对结果", "Check result"],
  retry: ["再次运行", "Run again"],
  taskHint: [
    "停止需要节点确认；此前产生的修改不会撤销。结果不明时不会自动重跑。",
    "Stopping needs worker confirmation and does not undo earlier effects. Uncertain actions are never replayed automatically.",
  ],
  export: ["导出最近记录", "Export recent activity"],
  paired: ["已配对", "Paired"],
  awaiting: [
    "等待这台电脑上线，配对码 30 分钟内有效。",
    "Waiting for this computer. Pairing code expires in 30 minutes.",
  ],
  download: ["下载 Worker", "Download Worker"],
  downloadHint: [
    "另一台电脑需要 Node.js 22.19 或更新版本。下载脚本后放进“下载”文件夹。",
    "The other computer needs Node.js 22.19 or newer. Put the downloaded script in Downloads.",
  ],
  command: ["复制启动命令", "Copy start command"],
  code: ["复制配对码", "Copy pairing code"],
  copied: ["已复制", "Copied"],
  manualCommand: ["手动复制命令", "Copy command manually"],
  showCommand: ["显示命令以手动复制", "Show command for manual copy"],
  hideCommand: ["隐藏命令", "Hide command"],
  clipboardError: [
    "无法写入剪贴板，请选择文本复制。",
    "Clipboard unavailable. Select and copy the text.",
  ],
  joinStep1: [
    "1. 在另一台电脑下载 Worker",
    "1. Download Worker on the other computer",
  ],
  joinStep2: [
    "2. 复制命令，在那台电脑的终端运行",
    "2. Copy the command and run it in that computer’s terminal",
  ],
  joinStep3: [
    "3. 等待“可用”，回到对话开始工作",
    "3. Wait for Ready, then return to your conversation",
  ],
  commandHint: [
    "配对信息只给你自己的节点。可在两台电脑间复制，切勿放进公开聊天或截图。",
    "Share pairing information only with your own worker. Keep it out of public chats and screenshots.",
  ],
  shellHint: [
    "私有连接：文件操作限制在指定目录。命令执行仅在启动时明确添加 --allow-shell 后开放；它不是系统沙箱。",
    "Private broker: files stay inside the chosen directory. Shell requires --allow-shell at startup; this is not an OS sandbox.",
  ],
  directory: [
    "工作目录（私有连接可选）",
    "Workspace (optional with private broker)",
  ],
  backChat: ["回到对话", "Back to conversation"],
  chatHint: [
    "试着说：“用 Pamiya 查看节点，分别检查它们的连接。”",
    "Try: “Use Pamiya to list my workers and check each one.”",
  ],
  working: ["真实连接与执行", "Live connection and execution"],
  emptyValue: ["无", "None"],
  seconds: ["秒前", "s ago"],
  now: ["刚刚", "Just now"],
  nameSaved: ["名称已保存", "Name saved"],
  saved: ["连接已保存，正在验证…", "Saved. Verifying connection…"],
  unavailable: [
    "请先连接服务并添加可用节点",
    "Connect and add an available worker first",
  ],
  confirmRemove: ["确定移除这个节点？", "Remove this worker?"],
  confirmYes: ["确认移除", "Remove worker"],
  pending: ["等待节点确认", "Waiting for worker confirmation"],
  localStopHint: [
    "由本机 DSH 管理；启动后会随 DSH 启动。",
    "Managed by this DSH installation and starts with DSH.",
  ],
  nodes: ["节点", "Workers"],
  recordsHint: [
    "显示最近 200 条。已发送、执行中与结果待核对都不会被当作成功。",
    "Latest 200 entries. Sent, running and unknown results are not successes.",
  ],
  actionCheck: ["连接检查", "Connection check"],
  actionEcho: ["演示回声", "Demo echo"],
  actionWait: ["等待演示", "Wait demo"],
  actionStats: ["文本统计", "Text statistics"],
  actionFiles: ["目录浏览", "List files"],
  actionRead: ["读取文件", "Read file"],
  actionWrite: ["写入文件", "Write file"],
  actionShell: ["执行命令", "Run command"],
  preview: ["节点体验", "Try a worker"],
  action: ["操作", "Action"],
  run: ["运行", "Run"],
  text: ["演示文本", "Synthetic text"],
  wait: ["等待秒数", "Wait seconds"],
  refresh: ["刷新", "Refresh"],
  lost: ["暂时无法读取状态，请重试。", "Unable to read status. Try again."],
  notStarted: ["本机进程尚未运行。", "Local process is not running."],
  removed: ["节点已移除", "Worker removed"],
  select: ["选择节点", "Select worker"],
  noPassword: ["此连接无需密码", "No password required"],
  readMore: ["查看 Node.js 安装说明", "Node.js installation guide"],
  recent: ["最近运行", "Recent activity"],
  resolve: ["登记核对结果", "Record verified outcome"],
  note: ["核对说明", "Verification note"],
  resolveHint: [
    "仅在已到节点确认实际结果后登记，不会重新执行任务。",
    "Record only after verifying the real outcome at the worker. This does not execute the task again.",
  ],
  verified: ["已人工核对", "Manually verified"],
  settled: ["核对后的状态", "Verified status"],
  noContent: ["暂无结果", "No result yet"],
  ago: ["前", "ago"],
  changing: [
    "修改服务地址或连接模式需先移除节点。更新账号后，远程节点也需更新连接。",
    "Remove workers before changing the address or mode. Credential changes also need updating at remote workers.",
  ],
  unsaved: ["修改尚未保存", "Unsaved changes"],
  readOnly: [
    "当前测试连接只开放演示能力。",
    "This test connection supports synthetic demos only.",
  ],
};
const dictionaries = Object.fromEntries(
  ["zh", "en"].map((lang, index) => [
    lang,
    Object.fromEntries(
      Object.entries(copy).map(([key, value]) => [key, value[index]]),
    ),
  ]),
);
const actions = {
  "agent.demo": "actionAgentDemo",
  "agent.run": "actionAgentRun",
  "agent.install": "actionAgentInstall",
  "agent.artifact": "actionArtifact",
  "worker.inspect": "actionInspect",
  "worker.configure": "actionConfigure",
  "system.check": "actionCheck",
  "demo.echo": "actionEcho",
  "demo.wait": "actionWait",
  "text.stats": "actionStats",
  "fs.list": "actionFiles",
  "fs.read": "actionRead",
  "fs.write": "actionWrite",
  "shell.run": "actionShell",
};
function Icon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="12" rx="2" />
      <path d="M8 21h8M12 15v6M7 7h10M7 11h6" />
    </svg>
  );
}
function Badge({ status, t }) {
  return (
    <span className={`pm-badge pm-${status}`}>
      <i />
      {t(status)}
    </span>
  );
}
function Button({ children, primary = false, ...props }) {
  return (
    <button
      className={primary ? "pm-button pm-primary" : "pm-button"}
      {...props}
    >
      {children}
    </button>
  );
}
function Modal({ title, onClose, children, t }) {
  const ref = useRef();
  useEffect(() => {
    ref.current.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      className="pm-dialog"
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header>
        <h2>{title}</h2>
        <button className="pm-close" aria-label={t("close")} onClick={onClose}>
          ×
        </button>
      </header>
      <div className="pm-dialog-content">{children}</div>
    </dialog>
  );
}
function download(name, content, type = "application/json") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Field({ label, children, hint }) {
  return (
    <label className="pm-field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
function ConnectionForm({ snapshot, rpc, act, t, notify }) {
  const [form, setForm] = useState(() => ({
      ...snapshot.broker,
      password: undefined,
    })),
    [loading, setLoading] = useState(false),
    [dirty, setDirty] = useState(false),
    [anonymous, setAnonymous] = useState(false);
  const change = (key, value) => {
    setForm((old) => ({ ...old, [key]: value }));
    setDirty(true);
  };
  async function preset() {
    setLoading(true);
    try {
      const value = await rpc("preset");
      setForm((old) => ({ ...old, ...value }));
      setAnonymous(false);
      setDirty(true);
    } catch (error) {
      notify(error.message, true);
    } finally {
      setLoading(false);
    }
  }
  async function save(event) {
    event.preventDefault();
    await act(async () => {
      await rpc("saveBroker", {
        ...form,
        ...(anonymous
          ? { password: "" }
          : form.password === undefined || form.password === ""
            ? { password: undefined }
            : {}),
      });
      setDirty(false);
      notify(t("saved"));
    });
  }
  return (
    <form onSubmit={save} className="pm-connection">
      <div className="pm-radio-grid">
        <label className={form.publicTest ? "selected" : ""}>
          <input
            type="radio"
            name="pm-broker"
            checked={form.publicTest}
            onChange={() => {
              change("publicTest", true);
              change("url", "mqtts://public.runmqtt.com:8883");
            }}
          />
          <strong>{t("public")}</strong>
          <small>{t("publicHint")}</small>
        </label>
        <label className={!form.publicTest ? "selected" : ""}>
          <input
            type="radio"
            name="pm-broker"
            checked={!form.publicTest}
            onChange={() => {
              change("publicTest", false);
              change("url", "");
              change("username", "");
              change("password", "");
            }}
          />
          <strong>{t("private")}</strong>
          <small>{t("privateHint")}</small>
        </label>
      </div>
      {form.publicTest && (
        <Button type="button" disabled={loading} onClick={preset}>
          {loading ? t("saving") : t("preset")}
        </Button>
      )}
      <div className="pm-form-grid">
        <Field label={t("url")}>
          <input
            value={form.url}
            onChange={(e) => change("url", e.target.value)}
            required
            placeholder="mqtts://broker.example.com:8883"
            autoComplete="off"
          />
        </Field>
        <Field label={t("username")}>
          <input
            value={form.username}
            onChange={(e) => change("username", e.target.value)}
            autoComplete="off"
          />
        </Field>
        <Field label={t("password")}>
          <input
            type="password"
            value={form.password ?? ""}
            disabled={anonymous}
            onChange={(e) => change("password", e.target.value)}
            placeholder={
              snapshot.connection.status === "disconnected"
                ? t("passwordNew")
                : t("passwordHint")
            }
            autoComplete="new-password"
          />
        </Field>
      </div>
      {!form.publicTest && (
        <label className="pm-inline">
          <input
            type="checkbox"
            checked={anonymous}
            onChange={(e) => {
              setAnonymous(e.target.checked);
              setDirty(true);
            }}
          />
          {t("noPassword")}
        </label>
      )}
      <div className="pm-row">
        <Button type="submit" primary disabled={loading}>
          {t("connect")}
        </Button>
        {snapshot.connection.status !== "disconnected" && (
          <Button type="button" onClick={() => act(() => rpc("reconnect"))}>
            {t("reconnect")}
          </Button>
        )}
        {dirty && <small>{t("unsaved")}</small>}
      </div>
      {snapshot.workers.some((w) => !w.revoked) && (
        <p className="pm-note">{t("changing")}</p>
      )}
      <details>
        <summary>{t("details")}</summary>
        <p>
          {t("namespace")} <code>{snapshot.broker.namespace}</code>
        </p>
      </details>
    </form>
  );
}
function AddWorker({
  rpc,
  act,
  snapshot,
  t,
  onClose,
  notify,
  existingInvitation = null,
}) {
  const hasLocal = snapshot.workers.some(
    (worker) => worker.local && !worker.revoked,
  );
  const [mode, setMode] = useState(hasLocal ? "remote" : "local"),
    [label, setLabel] = useState(""),
    [invitation, setInvitation] = useState(existingInvitation),
    [os, setOs] = useState("unix"),
    [workspace, setWorkspace] = useState(""),
    [manual, setManual] = useState(false);
  const paired =
    invitation &&
    snapshot.workers.find((w) => w.id === invitation.worker.id)?.paired;
  const quotePath = (value) =>
    os === "win"
      ? `'${value.replaceAll("'", "''")}'`
      : `'${value.replaceAll("'", "'\\''")}'`;
  const command = invitation
    ? `${os === "win" ? 'node "$HOME/Downloads/pamiya-worker.mjs"' : 'node "$HOME/Downloads/pamiya-worker.mjs"'} join --code ${invitation.code}${workspace && !snapshot.broker.publicTest ? ` --workspace ${quotePath(workspace)}` : ""}`
    : "";
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      notify(t("copied"));
    } catch {
      setManual(true);
      notify(t("clipboardError"), true);
    }
  }
  async function create() {
    await act(async () => {
      const value = await rpc("invite", {
        label: label.trim() || (mode === "local" ? t("local") : t("remote")),
        local: mode === "local",
      });
      if (mode === "local") onClose();
      else setInvitation(value);
    });
  }
  return (
    <Modal title={t("add")} onClose={onClose} t={t}>
      {!invitation ? (
        <>
          <div className="pm-radio-grid">
            <label className={mode === "local" ? "selected" : ""}>
              <input
                type="radio"
                name="pm-add"
                disabled={hasLocal}
                checked={mode === "local"}
                onChange={() => setMode("local")}
              />
              <strong>{t("local")}</strong>
              <small>{t("localHint")}</small>
            </label>
            <label className={mode === "remote" ? "selected" : ""}>
              <input
                type="radio"
                name="pm-add"
                checked={mode === "remote"}
                onChange={() => setMode("remote")}
              />
              <strong>{t("remote")}</strong>
              <small>{t("remoteHint")}</small>
            </label>
          </div>
          <Field label={t("rename")}>
            <input
              value={label}
              maxLength={60}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t("nameHint")}
            />
          </Field>
          <div className="pm-row">
            <Button primary onClick={create}>
              {t("create")}
            </Button>
            <Button onClick={onClose}>{t("cancel")}</Button>
          </div>
        </>
      ) : (
        <>
          <Badge status={paired ? "ready" : "pairing"} t={t} />
          <h3>{t("joinStep1")}</h3>
          <p>{t("downloadHint")}</p>
          <div className="pm-row">
            <Button
              onClick={() =>
                act(async () => {
                  const file = await rpc("download");
                  download(
                    file.name,
                    Uint8Array.from(atob(file.content), (c) => c.charCodeAt(0)),
                    "text/javascript",
                  );
                })
              }
            >
              {t("download")}
            </Button>
            <a
              href="https://nodejs.org/en/download"
              target="_blank"
              rel="noreferrer"
            >
              {t("readMore")}
            </a>
          </div>
          <h3>{t("joinStep2")}</h3>
          <Field label="Terminal">
            <select value={os} onChange={(e) => setOs(e.target.value)}>
              <option value="unix">macOS / Linux</option>
              <option value="win">Windows PowerShell</option>
            </select>
          </Field>
          {!snapshot.broker.publicTest && (
            <Field label={t("directory")} hint={t("shellHint")}>
              <input
                value={workspace}
                onChange={(e) => setWorkspace(e.target.value)}
                placeholder="/home/me/work"
              />
            </Field>
          )}
          <pre className="pm-command">
            node …/pamiya-worker.mjs join --code ••••••••
          </pre>
          <div className="pm-row">
            <Button primary onClick={() => copyText(command)}>
              {t("command")}
            </Button>
            <Button onClick={() => copyText(invitation.code)}>
              {t("code")}
            </Button>
            <Button onClick={() => setManual(!manual)}>
              {t(manual ? "hideCommand" : "showCommand")}
            </Button>
          </div>
          {manual && (
            <textarea
              readOnly
              aria-label={t("manualCommand")}
              value={command}
              onFocus={(e) => e.target.select()}
            />
          )}
          <p className="pm-note">{t("commandHint")}</p>
          <p className="pm-note">{t("stopRemote")}</p>
          <h3>{t("joinStep3")}</h3>
          <p>{paired ? t("paired") : t("awaiting")}</p>
          <Button onClick={onClose}>{t("close")}</Button>
        </>
      )}
    </Modal>
  );
}
function AgentSettings({ worker, rpc, act, t, publicTest }) {
  const [settings, setSettings] = useState(null),
    [error, setError] = useState(""),
    [actionsJson, setActionsJson] = useState("[]");
  useEffect(() => {
    let cancelled = false;
    rpc("capabilities", { id: worker.id })
      .then((value) => {
        if (cancelled) return;
        setSettings(value.capabilities);
        setActionsJson(
          JSON.stringify(value.capabilities.actions ?? [], null, 2),
        );
      })
      .catch((error) => {
        if (!cancelled) setError(error.message);
      });
    return () => {
      cancelled = true;
    };
  }, [worker.id]);
  const save = (custom = false) =>
    act(async () => {
      const value = {
        ...settings,
        ...(custom ? { actions: JSON.parse(actionsJson) } : {}),
      };
      await rpc("capabilities", { id: worker.id, capabilities: value });
      setSettings(value);
    });
  return (
    <section className="pm-agent-settings">
      <h3>{t("agentTitle")}</h3>
      <p className="pm-note">{t("agentHint")}</p>
      {error && (
        <p role="alert" className="pm-error">
          {error}
        </p>
      )}
      {!settings && !error && <p>{t("loadingAgents")}</p>}
      {(worker.agents ?? []).map((agent) => (
        <div className="pm-agent-row" key={agent.id}>
          <div>
            <strong>{agent.name}</strong>
            <small>
              {t(agent.installed ? "installedAgent" : "absentAgent")}
            </small>
          </div>
          <select
            aria-label={`${agent.name} ${t("inheritModel")}`}
            disabled={!settings}
            value={settings?.agents?.[agent.id]?.modelSource ?? "inherit"}
            onChange={(event) =>
              setSettings({
                ...settings,
                agents: {
                  ...settings.agents,
                  [agent.id]: {
                    ...settings.agents?.[agent.id],
                    enabled: true,
                    modelSource: event.target.value,
                  },
                },
              })
            }
          >
            <option value="inherit">{t("inheritModel")}</option>
            <option value="independent">{t("independentModel")}</option>
          </select>
          {settings?.agents?.[agent.id]?.modelSource === "independent" &&
            (!publicTest || worker.local) && (
              <input
                aria-label={`${agent.name} ${t("ownModel")}`}
                placeholder={t("ownModel")}
                value={settings.agents[agent.id].model ?? ""}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    agents: {
                      ...settings.agents,
                      [agent.id]: {
                        ...settings.agents[agent.id],
                        model: event.target.value,
                      },
                    },
                  })
                }
              />
            )}
          <Button
            disabled={worker.status !== "ready"}
            onClick={() =>
              act(() =>
                rpc("dispatch", {
                  workerId: worker.id,
                  action: agent.installed ? "agent.demo" : "agent.install",
                  input: { agent: agent.id },
                }),
              )
            }
          >
            {t(agent.installed ? "testAgent" : "installAgent")}
          </Button>
        </div>
      ))}
      {settings && <Button onClick={() => save()}>{t("saveAgents")}</Button>}
      {settings && (!publicTest || worker.local) && (
        <details>
          <summary>{t("advancedActions")}</summary>
          <p className="pm-note">{t("customHint")}</p>
          <textarea
            className="pm-json-editor"
            aria-label={t("customTitle")}
            value={actionsJson}
            onChange={(event) => setActionsJson(event.target.value)}
            spellCheck={false}
          />
          <Button onClick={() => save(true)}>{t("saveActions")}</Button>
        </details>
      )}
      <p className="pm-note">{t("syntheticModelHint")}</p>
    </section>
  );
}
function WorkerDetail({ worker, rpc, act, t, onClose, onReissue, publicTest }) {
  const [workspace, setWorkspace] = useState(worker.workspace ?? ""),
    [allowShell, setAllowShell] = useState(Boolean(worker.allowShell)),
    [label, setLabel] = useState(worker.label),
    [removing, setRemoving] = useState(false);
  const manage = (action) =>
    act(async () => {
      await rpc("manage", {
        id: worker.id,
        action,
        ...(action === "rename" ? { label } : {}),
      });
      if (action === "remove") onClose();
    });
  return (
    <Modal title={worker.label} onClose={onClose} t={t}>
      <Badge status={worker.status} t={t} />
      <Field label={t("rename")}>
        <input
          value={label}
          maxLength={60}
          onChange={(e) => setLabel(e.target.value)}
        />
      </Field>
      <Button
        disabled={!label.trim() || label === worker.label}
        onClick={() => manage("rename")}
      >
        {t("apply")}
      </Button>
      <h3>{t("capabilities")}</h3>
      <div className="pm-tags">
        {(worker.actions ?? [])
          .filter(
            (action) =>
              !action.startsWith("worker.") &&
              !["agent.install", "agent.artifact"].includes(action),
          )
          .map((action) => (
            <span key={action}>{t(actions[action] ?? action)}</span>
          ))}
      </div>
      <p className="pm-note">
        {worker.local ? t("localStopHint") : t("remoteHint")}
      </p>
      <div className="pm-row">
        <Button onClick={() => manage(worker.paused ? "resume" : "pause")}>
          {t(worker.paused ? "resume" : "pause")}
        </Button>
        {worker.local && (
          <Button
            onClick={() => manage(worker.localRunning ? "stop" : "start")}
          >
            {t(worker.localRunning ? "stop" : "start")}
          </Button>
        )}
        <Button onClick={() => manage("query")}>{t("query")}</Button>
        {!worker.local && (
          <Button onClick={onReissue}>{t("updatePairing")}</Button>
        )}
      </div>
      {worker.local && (
        <section>
          <h3>{t("localAccess")}</h3>
          <Field label={t("localWorkspace")}>
            <input
              value={workspace}
              onChange={(event) => setWorkspace(event.target.value)}
              placeholder="/path/to/folder"
            />
          </Field>
          <label className="pm-row">
            <input
              type="checkbox"
              checked={allowShell}
              onChange={(event) => setAllowShell(event.target.checked)}
            />
            {t("allowShell")}
          </label>
          <Button
            disabled={!workspace.trim()}
            onClick={() =>
              act(() =>
                rpc("configureLocal", { id: worker.id, workspace, allowShell }),
              )
            }
          >
            {t("saveAccess")}
          </Button>
        </section>
      )}
      <AgentSettings
        worker={worker}
        rpc={rpc}
        act={act}
        t={t}
        publicTest={publicTest}
      />
      <details>
        <summary>{t("details")}</summary>
        <code>{worker.id}</code>
        <p>{worker.platform ?? "—"}</p>
      </details>
      <div className="pm-danger-zone">
        <p>{t("removeHint")}</p>
        {removing ? (
          <div className="pm-row">
            <span>{t("confirmRemove")}</span>
            <Button onClick={() => manage("remove")}>{t("confirmYes")}</Button>
            <Button onClick={() => setRemoving(false)}>{t("cancel")}</Button>
          </div>
        ) : (
          <Button onClick={() => setRemoving(true)}>{t("remove")}</Button>
        )}
      </div>
    </Modal>
  );
}
function TaskDetail({ task, rpc, act, t, onClose }) {
  const [continuation, setContinuation] = useState(""),
    [note, setNote] = useState(""),
    [verified, setVerified] = useState("failed"),
    [review, setReview] = useState(false);
  return (
    <Modal
      title={t(actions[task.action] ?? task.action)}
      onClose={onClose}
      t={t}
    >
      <div className="pm-row">
        <Badge status={task.status} t={t} />
        <span>{task.workerLabel}</span>
      </div>
      {["sent", "running", "stop_requested", "unknown"].includes(
        task.status,
      ) && <p className="pm-note">{t("taskHint")}</p>}
      {task.error && task.status !== "cancelled" && (
        <p className="pm-error">{task.error}</p>
      )}
      {task.progress && (
        <>
          <h3>{t("progressTitle")}</h3>
          <p>{task.progress.phase}</p>
          {task.progress.text && <pre>{task.progress.text}</pre>}
        </>
      )}
      <h3>{t("input")}</h3>
      <pre>{JSON.stringify(task.input, null, 2)}</pre>
      <h3>{t("result")}</h3>
      {task.result?.answer && (
        <p className="pm-agent-answer">{task.result.answer}</p>
      )}
      {task.result?.sessionRef && (
        <details>
          <summary>
            {t("agentTitle")} · {task.result.agent}
          </summary>
          <p className="pm-note">Session: {task.result.sessionRef}</p>
          {task.action === "agent.run" && (
            <textarea
              aria-label={t("input")}
              value={continuation}
              onChange={(event) => setContinuation(event.target.value)}
            />
          )}
          <Button
            disabled={task.action === "agent.run" && !continuation.trim()}
            onClick={() =>
              act(async () => {
                await rpc("dispatch", {
                  workerId: task.workerId,
                  action: task.action,
                  input: {
                    agent: task.result.agent,
                    sessionRef: task.result.sessionRef,
                    modelSource: task.result.modelSource,
                    ...(task.action === "agent.run"
                      ? { prompt: continuation }
                      : {}),
                  },
                });
                onClose();
              })
            }
          >
            {t(task.action === "agent.demo" ? "testAgent" : "retry")}
          </Button>
        </details>
      )}
      <pre>
        {task.result === undefined || task.result === null
          ? t("noContent")
          : JSON.stringify(task.result, null, 2)}
      </pre>
      <div className="pm-row">
        {["sent", "running", "stop_requested", "unknown"].includes(
          task.status,
        ) && (
          <>
            <Button onClick={() => act(() => rpc("cancel", { id: task.id }))}>
              {t("requestStop")}
            </Button>
            <Button
              onClick={() =>
                act(() => rpc("manage", { id: task.workerId, action: "query" }))
              }
            >
              {t("query")}
            </Button>
          </>
        )}
        {task.status === "unknown" && (
          <Button onClick={() => setReview(!review)}>{t("resolve")}</Button>
        )}
        {["succeeded", "failed", "cancelled"].includes(task.status) &&
          !["fs.write", "shell.run"].includes(task.action) &&
          !task.action.startsWith("agent.") &&
          !task.action.startsWith("custom.") && (
            <Button
              onClick={() =>
                act(async () => {
                  await rpc("dispatch", {
                    workerId: task.workerId,
                    action: task.action,
                    input: task.input,
                  });
                  onClose();
                })
              }
            >
              {t("retry")}
            </Button>
          )}
      </div>
      {review && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            act(() => rpc("resolve", { id: task.id, status: verified, note }));
            setReview(false);
          }}
        >
          <p>{t("resolveHint")}</p>
          <Field label={t("settled")}>
            <select
              value={verified}
              onChange={(e) => setVerified(e.target.value)}
            >
              {["failed", "succeeded", "cancelled"].map((status) => (
                <option key={status} value={status}>
                  {t(status)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("note")}>
            <textarea
              value={note}
              required
              minLength={5}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
          <Button primary type="submit">
            {t("save")}
          </Button>
        </form>
      )}
      {task.verification && (
        <p>
          {t("verified")} · {task.verification.note}
        </p>
      )}
      <details>
        <summary>{t("details")}</summary>
        <code>{task.id}</code>
        <p>Attempt {task.attempt}</p>
      </details>
    </Modal>
  );
}
function TryWorker({ workers, rpc, act, t, onClose }) {
  const [id, setId] = useState(workers[0]?.id ?? ""),
    [action, setAction] = useState("system.check"),
    [text, setText] = useState("Hello from Pamiya"),
    [seconds, setSeconds] = useState(10);
  return (
    <Modal title={t("preview")} onClose={onClose} t={t}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          act(async () => {
            await rpc("dispatch", {
              workerId: id,
              action,
              input:
                action === "demo.wait"
                  ? { seconds }
                  : action === "system.check"
                    ? {}
                    : { text },
            });
            onClose();
          });
        }}
      >
        <Field label={t("select")}>
          <select value={id} onChange={(e) => setId(e.target.value)}>
            {workers.map((worker) => (
              <option key={worker.id} value={worker.id}>
                {worker.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("action")}>
          <select value={action} onChange={(e) => setAction(e.target.value)}>
            {["system.check", "demo.echo", "text.stats", "demo.wait"].map(
              (value) => (
                <option key={value} value={value}>
                  {t(actions[value])}
                </option>
              ),
            )}
          </select>
        </Field>
        {action === "demo.wait" ? (
          <Field label={t("wait")}>
            <input
              type="number"
              min="1"
              max="90"
              value={seconds}
              onChange={(e) => setSeconds(Number(e.target.value))}
            />
          </Field>
        ) : (
          action !== "system.check" && (
            <Field label={t("text")}>
              <textarea
                value={text}
                maxLength={12000}
                onChange={(e) => setText(e.target.value)}
              />
            </Field>
          )
        )}
        <p className="pm-note">{t("readOnly")}</p>
        <Button primary type="submit" disabled={!id}>
          {t("run")}
        </Button>
      </form>
    </Modal>
  );
}
function Panel({ ctx, t }) {
  const [snapshot, setSnapshot] = useState(null),
    [tab, setTab] = useState("workers"),
    [error, setError] = useState(""),
    [loadError, setLoadError] = useState(false),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState("all"),
    [dialog, setDialog] = useState(null);
  const panelRef = useRef(),
    mounted = useRef(true),
    toastTimer = useRef(),
    operationRef = useRef(false);
  const rpc = async (endpoint, payload = {}) => {
    const result = await ctx.connection.rpc.call(
      "/api",
      `pamiya/${endpoint}`,
      payload,
    );
    if (!result.ok)
      throw new Error(result.error?.message ?? "Pamiya request failed");
    return result.value;
  };
  const refresh = async () => {
    const value = await rpc("snapshot");
    if (mounted.current) {
      setSnapshot(value);
      setLoadError(false);
    }
  };
  const notify = (message, isError = false) => {
    if (!mounted.current) return;
    if (isError) setError(message);
    else {
      setToast(message);
      clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(""), 4000);
    }
  };
  const act = async (operation) => {
    if (operationRef.current) return;
    operationRef.current = true;
    setBusy(true);
    setError("");
    try {
      await operation();
      await refresh();
    } catch (problem) {
      notify(problem.message, true);
    } finally {
      operationRef.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  useEffect(() => {
    mounted.current = true;
    let reading = false;
    const poll = async () => {
      if (reading) return;
      reading = true;
      try {
        await refresh();
      } catch {
        if (mounted.current) setLoadError(true);
      } finally {
        reading = false;
      }
    };
    void poll();
    const timer = setInterval(poll, 1500);
    return () => {
      mounted.current = false;
      clearInterval(timer);
      clearTimeout(toastTimer.current);
    };
  }, []);
  useEffect(() => {
    panelRef.current?.scrollTo({ top: 0 });
  }, [tab]);
  if (!snapshot)
    return (
      <section className="pamiya-panel">
        <p role="status">
          {error || t(loadError ? "hostUnavailable" : "connecting")}
        </p>
        <Button onClick={() => act(refresh)}>{t("refresh")}</Button>
      </section>
    );
  const workers = snapshot.workers.filter((worker) => !worker.revoked),
    available = workers.filter((worker) => worker.status === "ready"),
    selectedWorker =
      dialog?.id && workers.find((worker) => worker.id === dialog.id),
    selectedTask =
      dialog?.taskId &&
      snapshot.tasks.find((task) => task.id === dialog.taskId);
  const visible = workers.filter(
    (worker) =>
      worker.label.toLowerCase().includes(search.toLowerCase()) &&
      (status === "all" || worker.status === status),
  );
  const onboarding =
    !workers.length ||
    !snapshot.tasks.some((task) => task.status === "succeeded");
  return (
    <section ref={panelRef} className="pamiya-panel" aria-label="Pamiya">
      <header className="pm-header">
        <div>
          <div className="pm-eyebrow">{t("working")}</div>
          <h1>{t("title")}</h1>
          <p>{t("subtitle")}</p>
        </div>
        <Badge
          status={
            loadError
              ? "reconnecting"
              : workers.some((worker) =>
                    ["ready", "busy"].includes(worker.status),
                  )
                ? "connected"
                : snapshot.connection.status
          }
          t={t}
        />
      </header>
      <nav className="pm-tabs" aria-label="Pamiya">
        <button
          onClick={() => setTab("workers")}
          aria-current={tab === "workers" ? "page" : undefined}
        >
          {t("workers")} <span>{workers.length}</span>
        </button>
        <button
          onClick={() => setTab("runs")}
          aria-current={tab === "runs" ? "page" : undefined}
        >
          {t("runs")}
        </button>
        <button
          onClick={() => setTab("connection")}
          aria-current={tab === "connection" ? "page" : undefined}
        >
          {t("connection")}
        </button>
      </nav>
      {(error || loadError) && (
        <div className="pm-alert" role="alert">
          <span>{error || t("hostUnavailable")}</span>
          <button aria-label={t("close")} onClick={() => setError("")}>
            ×
          </button>
        </div>
      )}
      {snapshot.connection.error && (
        <p className="pm-error">{snapshot.connection.error}</p>
      )}
      {toast && (
        <div className="pm-toast" role="status">
          {toast}
        </div>
      )}
      <fieldset
        className="pm-body"
        disabled={busy || loadError}
        aria-busy={busy}
      >
        <div hidden={tab !== "workers"}>
          {onboarding && (
            <div className="pm-onboarding">
              <h2>{t("localReady")}</h2>
              <p>{t("localFirstHint")}</p>
              <div className="pm-row">
                <Button
                  primary
                  disabled={
                    !workers.some(
                      (worker) => worker.local && worker.status === "ready",
                    )
                  }
                  onClick={() =>
                    act(() =>
                      rpc("dispatch", {
                        workerId: workers.find((worker) => worker.local)?.id,
                        action: "system.check",
                        input: {},
                      }),
                    )
                  }
                >
                  {t("localFirstTest")}
                </Button>
                <Button onClick={() => setTab("connection")}>
                  {t("remoteLater")}
                </Button>
              </div>
            </div>
          )}
          <div className="pm-section-heading">
            <div>
              <h2>{t("workers")}</h2>
              <p>
                {available.length} / {workers.length} {t("online")}
              </p>
            </div>
            <div className="pm-row">
              <Button
                disabled={!available.length}
                onClick={() => setDialog({ type: "try" })}
              >
                {t("preview")}
              </Button>
              <Button
                primary
                onClick={() =>
                  snapshot.connection.status === "connected"
                    ? setDialog({ type: "add" })
                    : setTab("connection")
                }
              >
                + {t("add")}
              </Button>
            </div>
          </div>
          {!workers.length ? (
            <div className="pm-empty">
              <Icon />
              <h3>{t("noWorkers")}</h3>
              <p>{t("noWorkersHint")}</p>
              {snapshot.connection.status !== "connected" && (
                <Button onClick={() => setTab("connection")}>
                  {t("step1")}
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="pm-filter">
                <input
                  type="search"
                  aria-label={t("search")}
                  placeholder={t("search")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select
                  aria-label={t("all")}
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  {["all", "ready", "busy", "offline", "pairing", "paused"].map(
                    (value) => (
                      <option key={value} value={value}>
                        {t(value)}
                      </option>
                    ),
                  )}
                </select>
              </div>
              <div className="pm-worker-grid">
                {visible.map((worker) => (
                  <article className="pm-worker" key={worker.id}>
                    <div className="pm-row pm-between">
                      <span className="pm-node-icon">
                        <Icon />
                      </span>
                      <Badge status={worker.status} t={t} />
                    </div>
                    <button
                      className="pm-worker-title"
                      onClick={() =>
                        setDialog({ type: "worker", id: worker.id })
                      }
                    >
                      {worker.label}
                    </button>
                    <p>
                      {worker.local
                        ? t("local")
                        : (worker.platform ?? t("remote"))}
                    </p>
                    <div className="pm-tags">
                      {(worker.agents?.some((agent) => agent.installed)
                        ? worker.agents
                            .filter((agent) => agent.installed)
                            .map((agent) => agent.name)
                        : (worker.actions ?? [])
                      )
                        .slice(0, 4)
                        .map((action) => (
                          <span key={action}>
                            {t(actions[action] ?? action)}
                          </span>
                        ))}
                    </div>
                    <footer>
                      <small>
                        {worker.lastSeen
                          ? `${t("lastSeen")} · ${Math.max(0, Math.floor((Date.now() - worker.lastSeen) / 1000))}${t("seconds")}`
                          : worker.local && !worker.localRunning
                            ? t("notStarted")
                            : t("awaiting")}
                      </small>
                      <Button
                        disabled={worker.status !== "ready"}
                        onClick={() =>
                          act(() =>
                            rpc("dispatch", {
                              workerId: worker.id,
                              action: "system.check",
                              input: {},
                            }),
                          )
                        }
                      >
                        {t("test")}
                      </Button>
                    </footer>
                  </article>
                ))}
              </div>
              {!visible.length && <p>{t("noMatch")}</p>}
              <div className="pm-experience">
                <div>
                  <h3>{t("tryAll")}</h3>
                  <p>{t("tryHint")}</p>
                </div>
                <Button
                  disabled={available.length < 2}
                  onClick={() =>
                    act(async () => {
                      await Promise.all(
                        available.map((worker) =>
                          rpc("dispatch", {
                            workerId: worker.id,
                            action: "text.stats",
                            input: {
                              text: "Hello Pamiya\nOne Agent. Many workers.",
                            },
                          }),
                        ),
                      );
                      setTab("runs");
                    })
                  }
                >
                  {t("tryAll")}
                </Button>
              </div>
            </>
          )}
          <div className="pm-chat-tip">
            <p>{t("chatHint")}</p>
            <Button onClick={() => ctx.layout.selectPanel("conversation")}>
              {t("backChat")}
            </Button>
          </div>
        </div>
        <div hidden={tab !== "runs"}>
          <div className="pm-section-heading">
            <div>
              <h2>{t("runs")}</h2>
              <p>{t("recordsHint")}</p>
            </div>
            <Button
              disabled={!snapshot.tasks.length}
              onClick={() =>
                download(
                  "pamiya-activity.json",
                  JSON.stringify(snapshot.tasks, null, 2),
                )
              }
            >
              {t("export")}
            </Button>
          </div>
          {!snapshot.tasks.length ? (
            <div className="pm-empty">
              <h3>{t("noRuns")}</h3>
              <p>{t("noRunsHint")}</p>
            </div>
          ) : (
            <div className="pm-task-list">
              {snapshot.tasks.map((task) => (
                <button
                  className="pm-task-row"
                  key={task.id}
                  onClick={() => setDialog({ type: "task", taskId: task.id })}
                >
                  <span>
                    <strong>{t(actions[task.action] ?? task.action)}</strong>
                    <small>
                      {task.workerLabel} ·{" "}
                      {new Date(task.createdAt).toLocaleString()}
                    </small>
                  </span>
                  <Badge status={task.status} t={t} />
                  <span aria-hidden="true">›</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div hidden={tab !== "connection"}>
          <div className="pm-section-heading">
            <div>
              <h2>{t("connection")}</h2>
              <p>{t("publicHint")}</p>
            </div>
          </div>
          <ConnectionForm
            snapshot={snapshot}
            rpc={rpc}
            act={act}
            t={t}
            notify={notify}
          />
        </div>
      </fieldset>
      {dialog?.type === "add" && (
        <AddWorker
          snapshot={snapshot}
          rpc={rpc}
          act={act}
          t={t}
          notify={notify}
          existingInvitation={dialog.invitation}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === "worker" && selectedWorker && (
        <WorkerDetail
          publicTest={snapshot.broker.publicTest}
          worker={selectedWorker}
          rpc={rpc}
          act={act}
          t={t}
          onReissue={() =>
            act(async () => {
              const invitation = await rpc("reissue", {
                id: selectedWorker.id,
              });
              setDialog({ type: "add", invitation });
            })
          }
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === "task" && selectedTask && (
        <TaskDetail
          task={selectedTask}
          rpc={rpc}
          act={act}
          t={t}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === "try" && (
        <TryWorker
          workers={available}
          rpc={rpc}
          act={act}
          t={t}
          onClose={() => setDialog(null)}
        />
      )}
    </section>
  );
}
function ConversationTarget({ ctx, sessionId, t }) {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false),
    [open, setOpen] = useState(false);
  const changing = useRef(false),
    revision = useRef(0);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (changing.current) return;
      const requestedRevision = revision.current;
      try {
        const result = await ctx.connection.rpc.call(
          "/api",
          "pamiya/conversation",
          { sessionId },
        );
        if (!result.ok) throw new Error(result.error.message);
        if (
          active &&
          !changing.current &&
          requestedRevision === revision.current
        ) {
          setData(result.value);
          setError("");
        }
      } catch {
        if (active) setError(t("hostUnavailable"));
      }
    };
    setData(null);
    setOpen(false);
    void refresh();
    const timer = setInterval(refresh, 3000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [ctx, sessionId, t]);
  const select = async (id) => {
    if (id === "manage") {
      setOpen(false);
      ctx.layout.selectPanel("pamiya");
      return;
    }
    const workerId = id === "auto" ? null : id;
    revision.current++;
    changing.current = true;
    setSaving(true);
    try {
      const result = await ctx.connection.rpc.call(
        "/api",
        "pamiya/conversation",
        { sessionId, workerId },
      );
      if (!result.ok) throw new Error(result.error.message);
      setData(result.value);
      setError("");
      setOpen(false);
    } catch (failure) {
      setError(failure.message);
    } finally {
      changing.current = false;
      setSaving(false);
    }
  };
  const selected = data?.workers.find((worker) => worker.id === data.workerId);
  const label =
    selected?.label ??
    (data?.workerId ? t("removedTarget") : t("executionTarget"));
  const status = selected?.status ?? (data?.workerId ? "revoked" : null);
  const unavailable = error || (status && !["ready", "busy"].includes(status));
  const items = [
    { type: "label", id: "heading", text: t("executionTarget") },
    {
      id: "auto",
      icon: <IconSparkleRegular />,
      label: (
        <span className="pm-target-option">
          <span>{t("automatic")}</span>
          <small>{t("automaticHint")}</small>
        </span>
      ),
      disabled: !data || saving,
    },
    ...(data?.workers ?? []).map((worker) => ({
      id: worker.id,
      icon: (
        <span
          className="pm-target-led"
          data-status={worker.status}
          role="img"
          aria-label={t(worker.status)}
          title={t(worker.status)}
        />
      ),
      label: (
        <span className="pm-target-option">
          <span className="pm-target-option-line">
            <span className="pm-target-name">{worker.label}</span>
          </span>
          <small>
            {{ darwin: "macOS", win32: "Windows", linux: "Linux" }[
              worker.platform
            ] ||
              worker.platform ||
              t(worker.local ? "local" : "remote")}
          </small>
        </span>
      ),
      disabled: saving,
    })),
    ...(data?.workerId && !selected
      ? [{ id: data.workerId, label: t("removedTarget"), disabled: true }]
      : []),
    ...(data && !data.workers.length
      ? [{ type: "label", id: "empty", text: t("targetEmpty") }]
      : []),
    ...(error ? [{ type: "label", id: "error", text: error }] : []),
  ];
  return (
    <Menu
      open={open}
      onClose={() => setOpen(false)}
      onSelect={select}
      items={items}
      selectedId={data?.workerId ?? "auto"}
      side="top"
      portal
      autoFocus
      listClassName="pm-target-menu"
      footer={[
        {
          id: "manage",
          label: t("manageWorkers"),
          icon: <IconSettingsOutlineRegular />,
        },
        { type: "label", id: "scope", text: t("targetScope") },
      ]}
      anchor={
        <Tooltip
          label={
            error || `${t("targetHint")}${status ? ` · ${t(status)}` : ""}`
          }
          side="top"
          delayMs={500}
          disabled={open}
        >
          <button
            type="button"
            className="pm-target-trigger"
            data-unavailable={unavailable ? "true" : undefined}
            aria-label={`${t("executionTarget")}：${data?.workerId ? label : t("automatic")}${status ? ` · ${t(status)}` : ""}`}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-busy={saving || undefined}
            disabled={saving}
            onClick={() => setOpen(!open)}
          >
            <IconFollowsystemOutlineRegular size={14} />
            <span className="pm-target-trigger-label">{label}</span>
            <IconChevronDownOutlineRegular
              className="pm-target-chevron"
              size={12}
            />
          </button>
        </Tooltip>
      }
    />
  );
}
export const inject = ["slots", "locale", "connection", "layout"];
export function apply(ctx) {
  ctx.effect(
    () => ctx.locale.register("pamiya", dictionaries),
    "pamiya: locale",
  );
  ctx.effect(() => {
    const element = document.createElement("style");
    element.textContent = styles;
    document.head.append(element);
    return () => element.remove();
  }, "pamiya: styles");
  ctx.slots.inject("main", () =>
    ctx.slots.register(
      {
        name: "main",
        key: "pamiya",
        locale: "pamiya",
        inject: () => ({ ctx }),
      },
      Panel,
    ),
  );
  ctx.slots.inject("sidebar.panellist", () =>
    ctx.slots.register(
      {
        name: "sidebar.panellist",
        id: "pamiya",
        order: 25,
        label: () => ctx.locale.bind("pamiya")("title"),
      },
      Icon,
    ),
  );
  ctx.slots.inject("conversation.input.left", () =>
    ctx.slots.register(
      {
        name: "conversation.input.left",
        id: "pamiya-target",
        order: 10,
        locale: "pamiya",
        inject: (sessionId) => ({ ctx, sessionId }),
      },
      ConversationTarget,
    ),
  );
}

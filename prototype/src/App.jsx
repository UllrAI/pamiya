import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import {
  ArrowUp,
  ArrowRight,
  Plus,
  SlidersHorizontal,
  CaretDown,
  ChatCircle,
  MagnifyingGlass,
  SidebarSimple,
  NotePencil,
  DotsThree,
  SquaresFour,
  X,
  FileText,
  DownloadSimple,
  PencilSimple,
  Check,
  ArrowCounterClockwise,
  Clock,
  GearSix,
  BookOpen,
  Play,
  Pause,
  Stop,
  WarningCircle,
  Globe,
  Folder,
  Archive,
  Trash,
  ArrowsOutSimple,
  ArrowsInSimple,
  Paperclip,
} from "@phosphor-icons/react";
import {
  ACTIVE,
  BLOCKED,
  STORAGE_KEY,
  scenarios,
  uid,
  newSession,
  currentRun,
  startRun,
  tickSession,
  addInput,
  stopRun,
  retryRun,
  reconcileRun,
  dismissRun,
  initialState,
  recoverState,
  saveArtifact,
  nextOccurrence,
} from "./model.mjs";
import { IconProvider, IconButton, Modal, Spinner } from "./ui.jsx";

const formatDate = (time, zone = "Asia/Shanghai") =>
  new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: zone,
  }).format(time);
const attachmentLabel = (file) =>
  `${file.name}${file.kind === "metadata" ? " · 未解析" : file.truncated ? " · 节选" : ""}`;

function load() {
  try {
    return recoverState(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch {
    return initialState();
  }
}

export function App() {
  const [data, setData] = useState(load);
  const [activeId, setActiveId] = useState(null);
  const [homeDraft, setHomeDraft] = useState("");
  const [homeAttachments, setHomeAttachments] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 760);
  const [modal, setModal] = useState(null);
  const [more, setMore] = useState(false);
  const [scenario, setScenario] = useState("deliver");
  const [artifactId, setArtifactId] = useState(null);
  const [editBody, setEditBody] = useState(null);
  const [editVersion, setEditVersion] = useState(null);
  const [fullCanvas, setFullCanvas] = useState(false);
  const [version, setVersion] = useState(null);
  const [notice, setNotice] = useState(null);
  const [storageError, setStorageError] = useState(false);
  const fileRef = useRef(null);
  const composerRef = useRef(null);
  const endRef = useRef(null);
  const toastTimer = useRef(null);
  const session = data.sessions.find((s) => s.id === activeId);
  const run = currentRun(session);
  const artifact = session?.artifacts.find((a) => a.id === artifactId);
  const draft = session ? session.draft : homeDraft;
  const attachments = session ? session.draftAttachments : homeAttachments;
  const canSend =
    Boolean(draft.trim() || attachments.length) && run?.status !== "stopping";
  const dirty = editBody !== null && artifact && editBody !== artifact.body;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [data]);
  useEffect(() => {
    const timer = setInterval(
      () =>
        setData((old) => {
          if (!old.sessions.some((s) => ACTIVE.includes(currentRun(s)?.status)))
            return old;
          return { ...old, sessions: old.sessions.map(tickSession) };
        }),
      1900,
    );
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [session?.messages.length, run?.status]);
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setModal({ type: "search" });
      }
      if (e.key === "Escape") setMore(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const guard = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  function notify(text, undo) {
    clearTimeout(toastTimer.current);
    setNotice({ text, undo });
    toastTimer.current = setTimeout(() => setNotice(null), undo ? 10000 : 4500);
  }
  function updateSession(fn, id = activeId) {
    setData((old) => ({
      ...old,
      sessions: old.sessions.map((s) => (s.id === id ? fn(s) : s)),
    }));
  }
  function changeDraft(text) {
    if (session) updateSession((s) => ({ ...s, draft: text }));
    else setHomeDraft(text);
  }
  function changeAttachments(value) {
    if (session) updateSession((s) => ({ ...s, draftAttachments: value }));
    else setHomeAttachments(value);
  }
  function leaveEditor(action) {
    if (dirty) setModal({ type: "unsaved", action });
    else action();
  }
  function closeArtifact() {
    leaveEditor(() => {
      setArtifactId(null);
      setEditBody(null);
      setVersion(null);
      setFullCanvas(false);
    });
  }
  function selectSession(id) {
    leaveEditor(() => {
      setActiveId(id);
      setArtifactId(null);
      setEditBody(null);
      setVersion(null);
      setFullCanvas(false);
      setMore(false);
      if (window.innerWidth <= 760) setSidebarOpen(false);
    });
  }
  function newChat() {
    selectSession(null);
    setScenario("deliver");
  }
  function submit(e) {
    e.preventDefault();
    if (!canSend) return;
    const text = draft.trim() || "请根据这些文件整理一份方案。";
    if (run && [...ACTIVE, ...BLOCKED].includes(run.status)) {
      updateSession((s) => addInput(s, text, attachments));
    } else if (session) {
      updateSession((s) =>
        startRun(s, text, {
          attachments,
          connected: data.connections.workspace,
        }),
      );
    } else {
      const next = startRun(newSession(), text, {
        scenario,
        attachments,
        connected: data.connections.workspace,
      });
      setData((old) => ({ ...old, sessions: [next, ...old.sessions] }));
      setActiveId(next.id);
      setHomeDraft("");
      setHomeAttachments([]);
      setScenario("deliver");
    }
  }
  async function addFiles(files) {
    const parsed = [];
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        notify(`${file.name} 超过 5 MB，请换一个较小的文件。`);
        continue;
      }
      const isText =
        /\.(md|txt|csv|json)$/i.test(file.name) ||
        file.type.startsWith("text/");
      let source = "";
      try {
        source = isText ? await file.text() : "";
      } catch {
        notify(`无法读取 ${file.name}，请重新添加。`);
        continue;
      }
      const text = source.slice(0, 20000);
      if (source.length > 20000)
        notify(`${file.name} 已截取前 20,000 字符；请拆分文件以使用其余内容。`);
      parsed.push({
        id: uid(),
        name: file.name,
        size: file.size,
        text,
        kind: isText ? "text" : "metadata",
        truncated: source.length > 20000,
      });
    }
    changeAttachments([...attachments, ...parsed]);
    if (parsed.some((f) => f.kind === "metadata"))
      notify("已添加文件信息。此原型仅解析文本文件，未读取图片或 PDF 内容。");
    if (fileRef.current) fileRef.current.value = "";
  }
  function openArtifact(id) {
    leaveEditor(() => {
      setArtifactId(id);
      setEditBody(null);
      setVersion(null);
    });
  }
  function saveEdit(force = false) {
    if (!editBody?.trim()) {
      notify("成果内容不能为空。");
      return;
    }
    if (!force && artifact.version !== editVersion) {
      setModal({ type: "version-conflict", action: modal?.action });
      return false;
    }
    updateSession((s) => saveArtifact(s, artifactId, editBody));
    setEditBody(null);
    setVersion(null);
    notify("已保存新版本。");
    return true;
  }
  function downloadArtifact() {
    const body = version
      ? artifact.versions.find((v) => v.version === Number(version))?.body
      : artifact.body;
    const url = URL.createObjectURL(
      new Blob([body], { type: "text/markdown;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = artifact.name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("已下载 Markdown 文件。");
  }
  function connectWorkspace(connected) {
    setData((old) => ({
      ...old,
      connections: { ...old.connections, workspace: connected },
      sessions: old.sessions.map((s) => {
        const r = currentRun(s);
        if (connected && r?.status === "waiting-connection")
          return retryRun(s, true);
        if (
          !connected &&
          r?.scenario === "connection" &&
          r.status === "running"
        )
          return {
            ...s,
            runs: s.runs.map((r, i) =>
              i === s.runs.length - 1
                ? { ...r, status: "waiting-connection" }
                : r,
            ),
          };
        return s;
      }),
    }));
    notify(
      connected
        ? "演示工作区已连接，等待中的工作会继续。"
        : "已断开演示工作区。",
    );
  }
  function archiveSession(id) {
    updateSession((s) => ({ ...s, archived: true }), id);
    if (activeId === id) selectSession(null);
    notify("对话已归档，可在搜索中找回。", () =>
      updateSession((s) => ({ ...s, archived: false }), id),
    );
    setModal(null);
  }
  function startScenario(key) {
    leaveEditor(() => {
      setActiveId(null);
      setArtifactId(null);
      setEditBody(null);
      setHomeDraft(scenarios[key].prompt);
      setHomeAttachments([]);
      setScenario(key);
      setModal(null);
      if (window.innerWidth < 761) setSidebarOpen(false);
      requestAnimationFrame(() => composerRef.current?.focus());
    });
  }
  function scheduleTrigger(schedule) {
    if (!schedule.enabled) return;
    const previous = data.sessions.find((s) => s.id === schedule.lastRunId);
    if (
      previous &&
      [...ACTIVE, ...BLOCKED].includes(currentRun(previous)?.status)
    ) {
      selectSession(previous.id);
      setModal(null);
      notify("上次工作仍未结束，已回到原对话，没有重复触发。");
      return;
    }
    const fresh = startRun(newSession(schedule.name), schedule.goal, {
      connected: data.connections.workspace,
    });
    fresh.title = schedule.name;
    setData((old) => ({
      ...old,
      sessions: [fresh, ...old.sessions],
      schedules: old.schedules.map((s) =>
        s.id === schedule.id
          ? { ...s, lastRunId: fresh.id, lastRunAt: Date.now() }
          : s,
      ),
    }));
    selectSession(fresh.id);
    setModal(null);
    notify("已模拟触发一次，不会建立真实后台定时器。");
  }

  const activityLabels = {
    running:
      (run?.scenario === "uncertain"
        ? ["正在整理演示通知", "正在提交演示通知", "正在等待演示回执"]
        : [
            "正在阅读目标与上下文",
            "正在整理核心体验",
            "正在完善交付内容",
            "正在保存成果",
          ])[run?.step] || "正在推进",
    stopping: "正在停止…",
    stopped: "已停止",
    completed: "本轮已完成",
    "waiting-input": "需要你补充信息",
    "waiting-connection": "需要连接演示工作区",
    failed: "读取资料失败",
    reconciling: "提交结果待核对",
    interrupted: "演示执行已中断",
  };
  const isOpenRun = run && [...ACTIVE, ...BLOCKED].includes(run.status);

  return (
    <IconProvider notice={notice} onDismissNotice={() => setNotice(null)}>
      <div
        className={`app-shell ${sidebarOpen ? "" : "sidebar-collapsed"} ${artifact ? "has-artifact" : ""} ${fullCanvas ? "full-canvas" : ""}`}
      >
        {sidebarOpen && (
          <>
            <aside className="sidebar" aria-label="主导航">
              <div className="brand-row">
                <button className="wordmark" onClick={newChat}>
                  Pamiya
                </button>
                <IconButton
                  icon={SidebarSimple}
                  label="收起侧栏"
                  onClick={() => setSidebarOpen(false)}
                />
              </div>
              <button className="new-chat" onClick={newChat}>
                <NotePencil size={23} />
                <span>新对话</span>
              </button>
              <button
                className="nav-tools"
                onClick={() => setModal({ type: "tools" })}
              >
                <SquaresFour />
                <span>工具与连接</span>
              </button>
              <div className="history-heading">
                <span>对话</span>
                <div>
                  <IconButton
                    icon={MagnifyingGlass}
                    label="搜索对话"
                    onClick={() => setModal({ type: "search" })}
                  />
                  <IconButton
                    icon={Plus}
                    label="开始新对话"
                    onClick={newChat}
                  />
                </div>
              </div>
              <nav className="history-list" aria-label="对话历史">
                {data.sessions
                  .filter((s) => !s.archived)
                  .sort((a, b) => b.updatedAt - a.updatedAt)
                  .map((s, i) => (
                    <div
                      className={`history-row ${activeId === s.id || (!activeId && i === 0) ? "selected" : ""}`}
                      key={s.id}
                    >
                      <button
                        onClick={() => selectSession(s.id)}
                        aria-current={activeId === s.id ? "page" : undefined}
                      >
                        <ChatCircle />
                        <span>{s.title}</span>
                        {ACTIVE.includes(currentRun(s)?.status) && <Spinner />}
                      </button>
                      <IconButton
                        icon={DotsThree}
                        label={`管理对话：${s.title}`}
                        className="row-menu"
                        onClick={() =>
                          setModal({ type: "conversation", id: s.id })
                        }
                      />
                    </div>
                  ))}
              </nav>
              <div className="sidebar-footer">
                <button
                  className="more-button"
                  onClick={() => setMore(!more)}
                  aria-expanded={more}
                >
                  <DotsThree />
                  <span>更多</span>
                </button>
              </div>
              {more && (
                <>
                  <button
                    className="popover-dismiss"
                    aria-label="关闭更多菜单"
                    onClick={() => setMore(false)}
                  />
                  <div className="more-menu" role="menu">
                    {[
                      [Play, "体验演示", "demo"],
                      [Clock, "持续安排", "schedules"],
                      [BookOpen, "记忆", "memory"],
                      [GearSix, "设置", "settings"],
                    ].map(([Icon, name, type]) => (
                      <button
                        key={type}
                        role="menuitem"
                        onClick={() => {
                          setMore(false);
                          setModal({ type });
                        }}
                      >
                        <Icon />
                        {name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </aside>
            <button
              className="mobile-shade"
              aria-label="关闭侧栏"
              onClick={() => setSidebarOpen(false)}
            />
          </>
        )}
        <main className={`main ${session ? "conversation" : "home"}`}>
          <header className="topbar">
            {!sidebarOpen && (
              <IconButton
                icon={SidebarSimple}
                label="展开侧栏"
                onClick={() => setSidebarOpen(true)}
              />
            )}
            {session && (
              <>
                <button
                  className="conversation-title"
                  onClick={() =>
                    setModal({ type: "conversation", id: session.id })
                  }
                >
                  {session.title}
                  <CaretDown size={13} />
                </button>
                <div className="topbar-actions">
                  {session.artifacts.length > 0 && (
                    <IconButton
                      icon={FileText}
                      label="查看成果"
                      onClick={() => openArtifact(session.artifacts.at(-1).id)}
                    />
                  )}
                  <IconButton
                    icon={Clock}
                    label="安排持续工作"
                    onClick={() => setModal({ type: "schedule-edit" })}
                  />
                </div>
              </>
            )}
          </header>
          {storageError && (
            <div className="storage-warning" role="alert">
              浏览器存储空间不足，最新修改尚未保存。请先下载成果，或在设置中导出演示数据。
            </div>
          )}
          {!session ? (
            <section className="welcome" aria-label="开始与 Pamiya 协作">
              <h1>有什么想交给我？</h1>
              {renderComposer(true)}
            </section>
          ) : (
            <>
              <div className="messages" aria-label="对话内容">
                {session.messages.map((message) => (
                  <div key={message.id} className={`message ${message.role}`}>
                    {message.role === "assistant" && (
                      <span className="assistant-label">Pamiya</span>
                    )}
                    <div className="message-text">
                      <Markdown>{message.text}</Markdown>
                    </div>
                    {message.attachments?.length > 0 && (
                      <div className="attachment-list">
                        {message.attachments.map((file) => (
                          <span className="file-chip" key={file.id}>
                            <FileText size={16} />
                            <span>{attachmentLabel(file)}</span>
                          </span>
                        ))}
                      </div>
                    )}
                    {message.runId && (
                      <RunActivity
                        run={session.runs.find((r) => r.id === message.runId)}
                        current={run?.id === message.runId}
                        label={activityLabels[run?.status]}
                        onRetry={() =>
                          updateSession((s) =>
                            retryRun(s, data.connections.workspace),
                          )
                        }
                        onConnect={() => setModal({ type: "tools" })}
                        onVerify={() => updateSession(reconcileRun)}
                        onDismiss={() => updateSession(dismissRun)}
                        onAnswer={(text) =>
                          updateSession((s) => addInput(s, text))
                        }
                      />
                    )}
                    {message.artifactId && (
                      <button
                        className="artifact-link"
                        onClick={() => openArtifact(message.artifactId)}
                      >
                        <FileText size={25} />
                        <span>
                          <strong>
                            {
                              session.artifacts.find(
                                (a) => a.id === message.artifactId,
                              )?.name
                            }
                          </strong>
                          <small>可查看、编辑和下载</small>
                        </span>
                        <ArrowRight size={18} />
                      </button>
                    )}
                  </div>
                ))}
                <div ref={endRef} />
              </div>
              <div className="conversation-composer">
                {renderComposer(false)}
                <p className="composer-hint">
                  演示模式 · 无真实模型、工具调用或消息发送
                </p>
              </div>
            </>
          )}
          <button
            className="preview-label"
            onClick={() => setModal({ type: "demo" })}
          >
            原型预览
          </button>
        </main>
        {artifact && (
          <section className="artifact-panel" aria-label="成果区">
            <header className="artifact-header">
              <div>
                <FileText />
                <span>
                  {artifact.name}
                  <small>版本 {artifact.version}</small>
                </span>
              </div>
              <div className="artifact-actions">
                <IconButton
                  icon={fullCanvas ? ArrowsInSimple : ArrowsOutSimple}
                  label={fullCanvas ? "退出全屏成果" : "展开成果"}
                  onClick={() => setFullCanvas(!fullCanvas)}
                />
                <IconButton icon={X} label="关闭成果" onClick={closeArtifact} />
              </div>
            </header>
            <div className="artifact-toolbar">
              <select
                aria-label="成果版本"
                value={version || ""}
                disabled={editBody !== null}
                onChange={(e) => setVersion(e.target.value || null)}
              >
                <option value="">当前版本 {artifact.version}</option>
                {[...artifact.versions].reverse().map((v) => (
                  <option key={v.version} value={v.version}>
                    历史版本 {v.version}
                  </option>
                ))}
              </select>
              <div>
                {editBody !== null ? (
                  <>
                    <button
                      className="text-button"
                      onClick={() => leaveEditor(() => setEditBody(null))}
                    >
                      取消
                    </button>
                    <button
                      className="primary compact"
                      onClick={() => saveEdit()}
                      disabled={!editBody.trim()}
                    >
                      保存
                    </button>
                  </>
                ) : (
                  <>
                    <IconButton
                      icon={PencilSimple}
                      label="编辑成果"
                      disabled={!!version}
                      onClick={() => {
                        setEditBody(artifact.body);
                        setEditVersion(artifact.version);
                      }}
                    />
                    <IconButton
                      icon={DownloadSimple}
                      label="下载成果"
                      onClick={downloadArtifact}
                    />
                  </>
                )}
              </div>
            </div>
            {version && (
              <p className="version-notice">
                正在查看历史版本，当前成果未被替换。
              </p>
            )}
            {editBody !== null ? (
              <textarea
                className="document-editor"
                aria-label="编辑成果内容"
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
              />
            ) : (
              <article className="document">
                <Markdown>
                  {version
                    ? artifact.versions.find(
                        (v) => v.version === Number(version),
                      )?.body
                    : artifact.body}
                </Markdown>
              </article>
            )}
            {editBody === null && (
              <footer className="artifact-foot">
                <span>在对话中补充方向，继续完善这份成果。</span>
                <button
                  className="text-button"
                  onClick={() => {
                    setFullCanvas(false);
                    if (window.innerWidth <= 1150) setArtifactId(null);
                    requestAnimationFrame(() => composerRef.current?.focus());
                  }}
                >
                  继续交流
                  <ArrowRight size={15} />
                </button>
              </footer>
            )}
          </section>
        )}
        <input
          ref={fileRef}
          type="file"
          multiple
          hidden
          onChange={(e) => addFiles(e.target.files)}
        />
        {notice && !modal && (
          <div className="toast" role="status">
            <Check size={16} />
            <span>{notice.text}</span>
            {notice.undo && (
              <button
                onClick={() => {
                  notice.undo();
                  setNotice(null);
                }}
              >
                撤销
              </button>
            )}
            <IconButton
              icon={X}
              label="关闭提示"
              onClick={() => setNotice(null)}
            />
          </div>
        )}
        {modal && renderModal()}
      </div>
    </IconProvider>
  );

  function renderComposer(isHome) {
    return (
      <form
        className={`composer ${isHome ? "home-composer" : ""}`}
        onSubmit={submit}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          addFiles(e.dataTransfer.files);
        }}
      >
        {attachments.length > 0 && (
          <div className="attachment-list composer-files">
            {attachments.map((a) => (
              <span className="file-chip" key={a.id}>
                <FileText size={16} />
                <span>{attachmentLabel(a)}</span>
                <IconButton
                  icon={X}
                  label={`移除文件：${a.name}`}
                  onClick={() =>
                    changeAttachments(attachments.filter((f) => f.id !== a.id))
                  }
                  type="button"
                />
              </span>
            ))}
          </div>
        )}
        <textarea
          ref={composerRef}
          aria-label="消息"
          placeholder={
            isHome
              ? "描述你的目标，或用 @ 引用文件与对话"
              : run?.status === "waiting-input"
                ? "补充关键信息，继续推进…"
                : isOpenRun
                  ? "补充想法，随时调整方向…"
                  : "继续交流，或提出新的目标…"
          }
          value={draft || ""}
          onChange={(e) => {
            changeDraft(e.target.value);
            if (e.target.value.endsWith("@")) setModal({ type: "context" });
          }}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              submit(e);
            }
          }}
          rows={isHome ? 3 : 2}
        />
        <div className="composer-bottom">
          <div>
            <IconButton
              icon={Plus}
              className="add-button"
              label="添加文件"
              onClick={() => fileRef.current?.click()}
              type="button"
            />
            <button
              className="tool-selector"
              type="button"
              onClick={() => setModal({ type: "tools" })}
            >
              <SlidersHorizontal size={18} />
              <span>工具与连接</span>
              <CaretDown size={12} />
            </button>
          </div>
          <div>
            {run?.status === "running" || run?.status === "stopping" ? (
              <>
                <IconButton
                  icon={Stop}
                  label={run.status === "stopping" ? "正在停止" : "停止执行"}
                  className="stop-button"
                  type="button"
                  disabled={run.status === "stopping"}
                  onClick={() => updateSession(stopRun)}
                />
                {canSend && (
                  <button
                    className="send-button"
                    type="submit"
                    aria-label="补充方向"
                  >
                    <ArrowUp size={22} />
                  </button>
                )}
              </>
            ) : (
              <button
                className="send-button"
                type="submit"
                aria-label="发送消息"
                disabled={!canSend}
              >
                <ArrowUp size={23} />
              </button>
            )}
          </div>
        </div>
      </form>
    );
  }

  function renderModal() {
    const close = () => setModal(null);
    if (modal.type === "version-conflict")
      return (
        <Modal title="成果已有新版本" onClose={close}>
          <div className="modal-body">
            <p>
              Agent
              在你编辑期间更新了成果。你的修改还在；保存后会成为新版本，Agent
              的版本也会保留在历史中。
            </p>
          </div>
          <div className="modal-footer">
            <button className="text-button" onClick={close}>
              继续编辑
            </button>
            <button
              className="primary"
              onClick={() => {
                saveEdit(true);
                close();
                modal.action?.();
              }}
            >
              保存为新版本
            </button>
          </div>
        </Modal>
      );
    if (modal.type === "unsaved")
      return (
        <Modal title="保存成果修改？" onClose={close}>
          <div className="modal-body">
            <p>这份成果还有未保存的修改。</p>
          </div>
          <div className="modal-footer">
            <button className="text-button" onClick={close}>
              继续编辑
            </button>
            <button
              className="secondary"
              onClick={() => {
                const action = modal.action;
                setModal(null);
                setEditBody(null);
                action();
              }}
            >
              放弃修改
            </button>
            <button
              className="primary"
              disabled={!editBody?.trim()}
              onClick={() => {
                const action = modal.action;
                if (!saveEdit()) return;
                setModal(null);
                action();
              }}
            >
              保存并继续
            </button>
          </div>
        </Modal>
      );
    if (modal.type === "search")
      return (
        <SearchModal
          sessions={data.sessions}
          onClose={close}
          onSelect={(id) => {
            close();
            selectSession(id);
          }}
        />
      );
    if (modal.type === "conversation") {
      const target = data.sessions.find((s) => s.id === modal.id);
      return (
        <ConversationModal
          session={target}
          onClose={close}
          onRename={(title) => {
            updateSession((s) => ({ ...s, title }), target.id);
            close();
          }}
          onArchive={() => {
            if (
              ACTIVE.includes(currentRun(target)?.status) ||
              currentRun(target)?.status === "reconciling"
            ) {
              close();
              notify("请先停止执行或核对提交结果，再归档这段对话。");
              return;
            }
            leaveEditor(() => archiveSession(target.id));
          }}
          onRestore={() => {
            updateSession((s) => ({ ...s, archived: false }), target.id);
            close();
          }}
        />
      );
    }
    if (modal.type === "tools")
      return (
        <Modal title="工具与连接" onClose={close}>
          <div className="modal-body">
            <p className="muted">
              按目标自动选择可用工具。此原型的连接与调用均为模拟。
            </p>
            <div className="resource-row">
              <Globe size={23} />
              <div>
                <strong>网页检索</strong>
                <small>使用演示资料，不会访问真实网页</small>
              </div>
              <span className="quiet-badge">演示内置</span>
            </div>
            <div className="resource-row">
              <FileText size={23} />
              <div>
                <strong>文档与文件</strong>
                <small>可添加本地文本文件，生成和编辑成果</small>
              </div>
              <span className="quiet-badge">可用</span>
            </div>
            <div className="resource-row">
              <Folder size={23} />
              <div>
                <strong>演示工作区</strong>
                <small>
                  {data.connections.workspace
                    ? "已连接 · 仅可读取演示资料"
                    : "仅连接示例目录，不会访问你的电脑"}
                </small>
              </div>
              <button
                className={
                  data.connections.workspace
                    ? "secondary compact"
                    : "primary compact"
                }
                onClick={() => connectWorkspace(!data.connections.workspace)}
              >
                {data.connections.workspace ? "断开" : "连接"}
              </button>
            </div>
            <p className="small-note">
              真实产品中，电脑、企业网络或设备只在相关工作需要时接入；在线状态与能力是否可用分别展示。
            </p>
          </div>
        </Modal>
      );
    if (modal.type === "demo")
      return (
        <Modal title="体验 Pamiya" onClose={close}>
          <div className="modal-body">
            <p className="muted">
              这是可操作的交互原型：执行由本地脚本模拟，不调用真实模型、外部服务或设备。文件只留在当前浏览器。选择一个场景开始。
            </p>
            <div className="scenario-list">
              {Object.entries(scenarios).map(([key, s]) => (
                <button key={key} onClick={() => startScenario(key)}>
                  <span>
                    <strong>{s.name}</strong>
                    <small>{s.description}</small>
                  </span>
                  <ArrowRight size={18} />
                </button>
              ))}
            </div>
            <button
              className="text-button"
              onClick={() => setModal({ type: "schedules" })}
            >
              体验持续安排
              <ArrowRight size={16} />
            </button>
          </div>
        </Modal>
      );
    if (modal.type === "context")
      return (
        <Modal title="引用上下文" onClose={close}>
          <div className="modal-body">
            <p className="muted">只把你选择的内容加入这次交流。</p>
            <button
              className="context-file"
              onClick={() => {
                close();
                fileRef.current?.click();
              }}
            >
              <Paperclip />
              添加本地文件
            </button>
            <div className="scenario-list">
              {data.sessions
                .filter((s) => s.id !== activeId && !s.archived)
                .map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      const context = {
                        id: uid(),
                        name: `${s.title}（对话）`,
                        kind: "text",
                        text: s.messages
                          .map((m) => `${m.role}: ${m.text}`)
                          .join("\n")
                          .slice(0, 20000),
                      };
                      changeAttachments([...attachments, context]);
                      changeDraft((draft || "").replace(/@$/, ""));
                      close();
                    }}
                  >
                    <ChatCircle />
                    <span>{s.title}</span>
                    <Plus size={17} />
                  </button>
                ))}
            </div>
          </div>
        </Modal>
      );
    if (modal.type === "schedules")
      return (
        <Modal title="持续安排" onClose={close}>
          <div className="modal-body">
            <p className="muted">
              把希望定期承担的事交给
              Pamiya。原型只保存安排，用“模拟触发”体验执行，不在后台自动运行。
            </p>
            {!data.schedules.length && (
              <div className="empty-state">
                <Clock size={30} />
                <h3>把一件事持续交给我</h3>
                <p>例如，每周一整理阅读资料。</p>
              </div>
            )}
            {data.schedules.map((s) => (
              <div className="schedule-item" key={s.id}>
                <div className="schedule-top">
                  <strong>{s.name}</strong>
                  <button
                    className="text-button"
                    onClick={() =>
                      setModal({ type: "schedule-edit", schedule: s })
                    }
                  >
                    编辑
                  </button>
                </div>
                <p>
                  {s.enabled
                    ? `下一次：${formatDate(nextOccurrence(s), s.timezone)}`
                    : "已暂停后续触发"}{" "}
                  · {s.timezone}
                </p>
                {s.lastRunId && (
                  <button
                    className="text-button"
                    onClick={() => {
                      close();
                      selectSession(s.lastRunId);
                    }}
                  >
                    查看最近一次执行
                    <ArrowRight size={14} />
                  </button>
                )}
                <div className="button-row">
                  <button
                    className="secondary compact"
                    disabled={!s.enabled}
                    onClick={() => scheduleTrigger(s)}
                  >
                    <Play size={15} />
                    模拟触发
                  </button>
                  <button
                    className="text-button"
                    onClick={() =>
                      setData((old) => ({
                        ...old,
                        schedules: old.schedules.map((item) =>
                          item.id === s.id
                            ? { ...item, enabled: !item.enabled }
                            : item,
                        ),
                      }))
                    }
                  >
                    {s.enabled ? <Pause size={15} /> : <Play size={15} />}
                    {s.enabled ? "暂停安排" : "恢复安排"}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="modal-footer">
            <button
              className="primary"
              onClick={() => setModal({ type: "schedule-edit" })}
            >
              <Plus size={17} />
              添加安排
            </button>
          </div>
        </Modal>
      );
    if (modal.type === "schedule-edit")
      return (
        <ScheduleForm
          schedule={modal.schedule}
          goal={session?.messages.find((m) => m.role === "user")?.text || ""}
          onClose={close}
          onSave={(schedule) => {
            setData((old) => ({
              ...old,
              schedules: modal.schedule
                ? old.schedules.map((s) =>
                    s.id === schedule.id ? schedule : s,
                  )
                : [...old.schedules, schedule],
            }));
            setModal({ type: "schedules" });
            notify("安排已保存在本地，原型不会自动触发。");
          }}
          onDelete={(id) => {
            const item = data.schedules.find((s) => s.id === id);
            setData((old) => ({
              ...old,
              schedules: old.schedules.filter((s) => s.id !== id),
            }));
            setModal({ type: "schedules" });
            notify("已移除安排。", () =>
              setData((old) => ({
                ...old,
                schedules: [...old.schedules, item],
              })),
            );
          }}
        />
      );
    if (modal.type === "memory")
      return (
        <MemoryModal
          memories={data.memories}
          onClose={close}
          onSave={(memory) =>
            setData((old) => ({
              ...old,
              memories: old.memories.some((m) => m.id === memory.id)
                ? old.memories.map((m) => (m.id === memory.id ? memory : m))
                : [...old.memories, memory],
            }))
          }
          onDelete={(id) => {
            const item = data.memories.find((m) => m.id === id);
            setData((old) => ({
              ...old,
              memories: old.memories.filter((m) => m.id !== id),
            }));
            notify("已删除这条记忆。", () =>
              setData((old) => ({ ...old, memories: [...old.memories, item] })),
            );
          }}
        />
      );
    if (modal.type === "settings")
      return (
        <Modal title="设置" onClose={close}>
          <div className="modal-body">
            <h3>简单、可控的协作</h3>
            <p className="muted">
              记忆由你主动添加和管理。已有授权覆盖的普通操作直接推进；超出范围时才请求具体授权。
            </p>
            <div className="setting-row">
              <span>
                <strong>本地演示数据</strong>
                <small>对话、成果和安排保存在当前浏览器</small>
              </span>
              <button
                className="secondary compact"
                onClick={() => {
                  const url = URL.createObjectURL(
                    new Blob([JSON.stringify(data, null, 2)], {
                      type: "application/json",
                    }),
                  );
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "pamiya-demo-data.json";
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                }}
              >
                导出
              </button>
            </div>
            <p className="small-note">
              刷新会保留内容，但正在进行的模拟执行需要手动继续。此原型没有账号、云同步或真实凭据；不要把浏览器本地存储当作生产备份。
            </p>
            <button
              className="text-button"
              onClick={() => setModal({ type: "demo" })}
            >
              查看可体验场景
              <ArrowRight size={15} />
            </button>
          </div>
        </Modal>
      );
    return null;
  }
}

function RunActivity({
  run,
  current,
  label,
  onRetry,
  onConnect,
  onVerify,
  onDismiss,
  onAnswer,
}) {
  const [expanded, setExpanded] = useState(false);
  if (!run) return null;
  const status = run.status;
  const labels = {
    completed: "本轮已完成",
    stopped: "已停止",
    interrupted: "演示执行已中断",
  };
  return (
    <div
      className={`run-activity ${BLOCKED.includes(status) ? "needs-attention" : ""}`}
    >
      <button
        className="activity-toggle"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        {ACTIVE.includes(status) ? (
          <Spinner />
        ) : BLOCKED.includes(status) ? (
          <WarningCircle size={17} />
        ) : (
          <Check size={17} />
        )}
        <span>{current ? label : labels[status] || "本轮记录"}</span>
        <CaretDown size={13} className={expanded ? "rotate" : ""} />
      </button>
      {expanded && (
        <ol className="activity-details">
          {run.activity.map((a, i) => (
            <li key={i}>
              <Check size={14} />
              {a}
            </li>
          ))}
          {!run.activity.length && <li>尚未开始工具执行。</li>}
          <li className="muted">演示执行 · 第 {run.attempt} 次尝试</li>
        </ol>
      )}
      {current && (
        <>
          {status === "waiting-input" && (
            <div className="run-help">
              <p>主要给谁看？</p>
              <div className="button-row">
                {["新用户", "团队成员", "投资人"].map((t) => (
                  <button
                    className="secondary compact"
                    key={t}
                    onClick={() => onAnswer(`主要给${t}看。`)}
                  >
                    {t}
                  </button>
                ))}
                <button className="text-button" onClick={onDismiss}>
                  结束本轮
                </button>
              </div>
            </div>
          )}
          {status === "waiting-connection" && (
            <div className="run-help">
              <p>只需要读取演示工作区。其他对话仍可继续。</p>
              <button className="secondary compact" onClick={onConnect}>
                连接工作区
                <ArrowRight size={15} />
              </button>
              <button className="text-button" onClick={onDismiss}>
                结束本轮
              </button>
            </div>
          )}
          {status === "failed" && (
            <div className="run-help">
              <p>
                演示资料暂时无法读取，已完成的整理会保留。重试只会重新读取资料。
              </p>
              <button className="secondary compact" onClick={onRetry}>
                <ArrowCounterClockwise size={15} />
                重试读取
              </button>
              <button className="text-button" onClick={onDismiss}>
                结束本轮
              </button>
            </div>
          )}
          {status === "interrupted" && (
            <div className="run-help">
              <p>
                页面刷新结束了本地模拟。对话和已有成果仍在，可以继续这一轮。
              </p>
              <button className="secondary compact" onClick={onRetry}>
                <Play size={15} />
                继续演示
              </button>
              <button className="text-button" onClick={onDismiss}>
                结束本轮
              </button>
            </div>
          )}
          {status === "reconciling" && (
            <div className="run-help">
              <p>
                演示通知已经提交，但回执尚未确认。先查询结果，避免重复提交。
              </p>
              <button className="secondary compact" onClick={onVerify}>
                核对演示回执
                <ArrowRight size={15} />
              </button>
              <small>仅这次提交等待核对，其他对话不受影响。</small>
            </div>
          )}
          {status === "stopping" && (
            <p className="small-note">
              已停止安排新操作，正在等待当前操作退出。
            </p>
          )}
          {status === "stopped" && (
            <p className="small-note">
              本轮已停止；已有内容保留。可以发送新消息继续。
            </p>
          )}
        </>
      )}
    </div>
  );
}

function SearchModal({ sessions, onClose, onSelect }) {
  const [query, setQuery] = useState("");
  const [archived, setArchived] = useState(false);
  const list = sessions.filter(
    (s) =>
      (!s.archived || archived) &&
      `${s.title}\n${s.messages.map((m) => m.text).join("\n")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <Modal title="搜索对话" onClose={onClose}>
      <div className="modal-body">
        <div className="search-input">
          <MagnifyingGlass />
          <input
            autoFocus
            aria-label="搜索标题或内容"
            placeholder="搜索标题或内容…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) => setArchived(e.target.checked)}
          />
          包含已归档对话
        </label>
        <div className="scenario-list">
          {list.map((s) => (
            <button key={s.id} onClick={() => onSelect(s.id)}>
              <ChatCircle />
              <span>
                <strong>{s.title}</strong>
                <small>
                  {s.archived ? "已归档 · " : ""}
                  {s.messages.at(-1)?.text.slice(0, 52) || "暂无消息"}
                </small>
              </span>
              <ArrowRight size={17} />
            </button>
          ))}
          {!list.length && (
            <div className="empty-state">
              <p>没有找到相关对话，换个关键词试试。</p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function ConversationModal({
  session,
  onClose,
  onRename,
  onArchive,
  onRestore,
}) {
  const [title, setTitle] = useState(session.title);
  return (
    <Modal title="对话设置" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim()) onRename(title.trim());
        }}
      >
        <div className="modal-body">
          <label className="field">
            对话名称
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              required
            />
          </label>
          <p className="small-note">
            {session.messages.length} 条消息 · {session.artifacts.length} 份成果
          </p>
        </div>
        <div className="modal-footer">
          <button
            type="button"
            className="text-button"
            onClick={session.archived ? onRestore : onArchive}
          >
            <Archive size={16} />
            {session.archived ? "恢复对话" : "归档对话"}
          </button>
          <button className="primary" disabled={!title.trim()}>
            保存名称
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ScheduleForm({ schedule, goal, onClose, onSave, onDelete }) {
  const [value, setValue] = useState(
    schedule || {
      id: uid(),
      name: "",
      goal,
      frequency: "weekly",
      weekday: "1",
      time: "09:00",
      timezone: "Asia/Shanghai",
      enabled: true,
    },
  );
  const set = (key, next) => setValue((old) => ({ ...old, [key]: next }));
  return (
    <Modal title={schedule ? "编辑安排" : "添加持续安排"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (value.name.trim() && value.goal.trim() && value.time)
            onSave({
              ...value,
              name: value.name.trim(),
              goal: value.goal.trim(),
            });
        }}
      >
        <div className="modal-body form-stack">
          <label className="field">
            名称
            <input
              autoFocus
              placeholder="例如：每周阅读整理"
              value={value.name}
              required
              maxLength={60}
              onChange={(e) => set("name", e.target.value)}
            />
          </label>
          <label className="field">
            希望 Pamiya 做什么
            <textarea
              rows={3}
              required
              value={value.goal}
              placeholder="整理本周新增的阅读资料，形成一份摘要。"
              onChange={(e) => set("goal", e.target.value)}
            />
          </label>
          <div className="form-columns">
            <label className="field">
              重复
              <select
                value={value.frequency}
                onChange={(e) => set("frequency", e.target.value)}
              >
                <option value="daily">每天</option>
                <option value="weekly">每周</option>
              </select>
            </label>
            {value.frequency === "weekly" && (
              <label className="field">
                日期
                <select
                  value={value.weekday}
                  onChange={(e) => set("weekday", e.target.value)}
                >
                  {["日", "一", "二", "三", "四", "五", "六"].map((day, i) => (
                    <option value={i} key={day}>
                      周{day}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="field">
              时间
              <input
                type="time"
                required
                value={value.time}
                onChange={(e) => set("time", e.target.value)}
              />
            </label>
          </div>
          <label className="field">
            时区
            <select
              value={value.timezone}
              onChange={(e) => set("timezone", e.target.value)}
            >
              <option>Asia/Shanghai</option>
              <option>UTC</option>
            </select>
          </label>
          {value.time && (
            <p className="schedule-preview">
              下一次：{formatDate(nextOccurrence(value), value.timezone)} ·{" "}
              {value.timezone}
            </p>
          )}
          <p className="small-note">
            暂停只影响后续触发，不会停止已经运行的对话。错过的触发跳过，不补跑。原型不执行真实定时任务。
          </p>
        </div>
        <div className="modal-footer">
          {schedule && (
            <button
              type="button"
              className="text-button danger"
              onClick={() => onDelete(schedule.id)}
            >
              <Trash size={16} />
              移除安排
            </button>
          )}
          <button
            className="primary"
            disabled={!value.name.trim() || !value.goal.trim() || !value.time}
          >
            保存安排
          </button>
        </div>
      </form>
    </Modal>
  );
}

function MemoryModal({ memories, onClose, onSave, onDelete }) {
  const [text, setText] = useState("");
  const [editingId, setEditingId] = useState(null);
  return (
    <Modal title="记忆" onClose={onClose}>
      <div className="modal-body">
        <p className="muted">
          保存希望 Pamiya
          长期参考的偏好。此原型只演示管理；不会静默提取记忆，也不会调用模型。
        </p>
        {memories.length ? (
          memories.map((m) => (
            <div className="memory-row" key={m.id}>
              <div>
                <p>{m.text}</p>
                <small>来源：你主动添加</small>
              </div>
              <IconButton
                icon={PencilSimple}
                label={`编辑记忆：${m.text}`}
                onClick={() => {
                  setEditingId(m.id);
                  setText(m.text);
                }}
              />
              <IconButton
                icon={Trash}
                label={`删除记忆：${m.text}`}
                onClick={() => {
                  onDelete(m.id);
                  if (editingId === m.id) {
                    setEditingId(null);
                    setText("");
                  }
                }}
              />
            </div>
          ))
        ) : (
          <p className="empty-copy">还没有保存的记忆。</p>
        )}
        <form
          className="memory-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) {
              onSave({ id: editingId || uid(), text: text.trim() });
              setText("");
              setEditingId(null);
            }
          }}
        >
          <label className="field">
            {editingId ? "编辑这条记忆" : "添加一条偏好"}
            <textarea
              value={text}
              rows={2}
              maxLength={500}
              placeholder="例如：默认用中文，先给结论。"
              onChange={(e) => setText(e.target.value)}
            />
          </label>
          <div className="button-row">
            {editingId && (
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setText("");
                  setEditingId(null);
                }}
              >
                取消
              </button>
            )}
            <button className="primary compact" disabled={!text.trim()}>
              {editingId ? "保存修改" : "添加记忆"}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

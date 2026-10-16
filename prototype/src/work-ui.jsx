import { useState } from "react";
import { ArrowRight, Paperclip } from "@phosphor-icons/react";
import { Modal } from "./ui.jsx";
import { isOpen, currentRun } from "./model.mjs";

export function MessageTreatment({ message, onResolve }) {
  const labels = {
    accepted: "已记下，待应用",
    applied: "已应用",
    answered: "已回答，未改变目标",
    queued: "已排在之后",
    held: "已暂存",
    withdrawn: "已撤回",
  };
  return message.treatments
    ?.filter((t) => t.kind !== "start")
    .map((t) =>
      t.state === "needs-choice" ? (
        <div className="message-choice" key={t.id}>
          <p>这条“{t.text}”要怎样处理？</p>
          <div className="button-row">
            {[
              ["steer", "补充当前"],
              ["question", "只问问题"],
              ["queue", "排在之后"],
              ["replace", "替换目标"],
            ].map(([kind, label]) => (
              <button
                className="text-button"
                key={kind}
                onClick={() => onResolve(t.id, kind)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : labels[t.state] ? (
        <small className="message-treatment" key={t.id}>
          {t.text} · {labels[t.state]}
        </small>
      ) : null,
    );
}

export function FollowUps({ session, onWithdraw, onContinue }) {
  const requests = session.requests.filter((r) =>
    ["pending", "held"].includes(r.status),
  );
  if (!requests.length) return null;
  return (
    <div className="follow-ups" aria-label="后续请求">
      <p>后续请求 · {requests.length}</p>
      {requests.map((r) => (
        <div className="follow-up" id={`request-${r.id}`} key={r.id}>
          <div>
            <span>{r.text}</span>
            <small>
              {r.status === "held"
                ? r.reason || "已暂存"
                : "当前工作完成后开始"}
            </small>
          </div>
          <div className="button-row">
            {r.status === "held" && (
              <button
                className="text-button"
                disabled={isOpen(currentRun(session))}
                onClick={() => onContinue(r.id)}
              >
                继续后续
              </button>
            )}
            <button className="text-button" onClick={() => onWithdraw(r.id)}>
              撤回
            </button>
          </div>
        </div>
      ))}
      {requests.some((r) => r.status === "held") &&
        isOpen(currentRun(session)) && (
          <small>
            先完成当前工作的停止、恢复或核对，再继续后续；可随时撤回。
          </small>
        )}
    </div>
  );
}

export function AttentionModal({ items, onClose, onOpen }) {
  return (
    <Modal title="待处理" onClose={onClose}>
      <div className="modal-body attention-list">
        {!items.length && (
          <p className="muted">当前没有需要处理的事项或未读结果。</p>
        )}
        {[
          ["action", "需要你处理"],
          ["result", "有新结果"],
        ].map(([group, label]) => {
          const entries = items.filter((item) => item.group === group);
          return entries.length ? (
            <section key={group} aria-label={label}>
              <h3>{label}</h3>
              {entries.map((item) => (
                <button
                  className="attention-item"
                  key={item.id}
                  onClick={() => onOpen(item)}
                >
                  <span>
                    <strong>{item.goal}</strong>
                    {item.actions.map((action, i) => (
                      <small key={i}>{action.label}</small>
                    ))}
                    {item.latestResult && (
                      <small>
                        {item.latestResult.kind === "incomplete"
                          ? "本轮未完成"
                          : item.latestResult.kind === "stopped"
                            ? "停止结果未读"
                            : item.latestResult.artifactVersion > 1
                              ? `成果更新至第 ${item.latestResult.artifactVersion} 版`
                              : "有未读结果"}
                      </small>
                    )}
                    <span className="attention-action">
                      {group === "action" ? "回到原处处理" : "查看结果"}
                    </span>
                  </span>
                  <ArrowRight size={17} />
                </button>
              ))}
            </section>
          ) : null;
        })}
      </div>
    </Modal>
  );
}

export function MaterialModal({
  attachments,
  onChooseFile,
  onSubmit,
  onClose,
}) {
  const [text, setText] = useState("");
  const usable = Boolean(
    text.trim() || attachments.some((a) => a.text?.trim()),
  );
  return (
    <Modal title="换资料" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (usable) onSubmit(text);
        }}
      >
        <div className="modal-body">
          <p className="muted">
            用这里的消息或已添加的文本文件替代演示工作区，继续同一件事。
          </p>
          <label className="field">
            替代资料
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              autoFocus
              placeholder="粘贴可用于整理报告的资料…"
            />
          </label>
          <button className="text-button" type="button" onClick={onChooseFile}>
            <Paperclip size={17} />
            添加文件
          </button>
          {attachments.map((a) => (
            <p className="small-note" key={a.id}>
              {a.name}
              {!a.text?.trim() ? " · 未解析，不能解除资料缺失" : " · 可用"}
            </p>
          ))}
        </div>
        <div className="modal-footer">
          <button type="button" className="text-button" onClick={onClose}>
            返回
          </button>
          <button className="primary" disabled={!usable}>
            使用这些资料并继续
          </button>
        </div>
      </form>
    </Modal>
  );
}

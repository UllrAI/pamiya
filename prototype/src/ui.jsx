import { createContext, useContext, useEffect, useRef } from "react";
import { IconContext, X, CircleNotch } from "@phosphor-icons/react";

const NoticeContext = createContext(null);

export function IconProvider({ children, notice, onDismissNotice }) {
  return (
    <IconContext.Provider
      value={{ size: 20, weight: "regular", "aria-hidden": true }}
    >
      <NoticeContext.Provider value={{ notice, onDismissNotice }}>
        {children}
      </NoticeContext.Provider>
    </IconContext.Provider>
  );
}

export function IconButton({ icon: Icon, label, className = "", ...props }) {
  return (
    <button
      className={`icon-button ${className}`}
      title={label}
      aria-label={label}
      {...props}
    >
      <Icon />
    </button>
  );
}

export function Modal({ title, children, onClose, wide = false }) {
  const ref = useRef(null);
  const feedback = useContext(NoticeContext);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="dialog-title"
    >
      <div className="modal-header">
        <h2 id="dialog-title">{title}</h2>
        <IconButton icon={X} label="关闭弹窗" onClick={onClose} />
      </div>
      {children}
      {feedback?.notice && (
        <div className="dialog-toast" role="status">
          <span>{feedback.notice.text}</span>
          {feedback.notice.undo && (
            <button
              className="text-button"
              onClick={() => {
                feedback.notice.undo();
                feedback.onDismissNotice();
              }}
            >
              撤销
            </button>
          )}
          <IconButton
            icon={X}
            label="关闭提示"
            onClick={feedback.onDismissNotice}
          />
        </div>
      )}
    </dialog>
  );
}

export function Spinner() {
  return <CircleNotch className="spinner" />;
}

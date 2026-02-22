import { useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useFocusTrap } from "../../hooks/useFocusTrap";

interface LogoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmLogout: () => void;
}

export function LogoutModal({
  isOpen,
  onClose,
  onConfirmLogout,
}: LogoutModalProps) {
  const logoutModalRef = useRef<HTMLDivElement>(null);
  const closeModal = useCallback(() => {
    onClose();
  }, [onClose]);

  useFocusTrap(logoutModalRef, isOpen, closeModal);

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        ref={logoutModalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-title"
        className="p-6 max-w-md w-full mx-4"
        style={{
          background: "var(--bg-panel)",
          border: "1px solid var(--border-primary)",
        }}
      >
        <h3
          id="logout-title"
          className="font-bebas text-[22px] tracking-[0.08em] mb-2"
          style={{ color: "var(--color-primary)" }}
        >
          Log Out?
        </h3>
        <p
          className="font-mono text-[14px] mb-6"
          style={{ color: "var(--color-meta)" }}
        >
          Are you sure you want to log out of this session?
        </p>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={closeModal}
            className="px-4 py-2 font-bebas text-[14px] tracking-[0.10em] transition-colors"
            style={{
              border: "1px solid var(--border-dim)",
              color: "var(--color-text)",
              background: "transparent",
            }}
          >
            CANCEL
          </button>
          <button
            type="button"
            onClick={() => {
              closeModal();
              onConfirmLogout();
            }}
            className="px-4 py-2 font-bebas text-[14px] tracking-[0.10em] transition-colors"
            style={{
              background: "#ff4444",
              color: "#000",
              border: "1px solid #ff4444",
            }}
          >
            LOG OUT
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

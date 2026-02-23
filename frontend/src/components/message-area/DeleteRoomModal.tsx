import type { RefObject } from "react";

interface DeleteRoomModalProps {
  open: boolean;
  displayRoomName: string;
  deleting: boolean;
  deleteError: string;
  modalRef: RefObject<HTMLDivElement | null>;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteRoomModal({
  open,
  displayRoomName,
  deleting,
  deleteError,
  modalRef,
  onCancel,
  onConfirm,
}: DeleteRoomModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-room-title"
        className="p-6 max-w-md w-full mx-4"
        style={{
          background: "var(--bg-panel)",
          border: "1px solid var(--border-primary)",
        }}
      >
        <h3
          id="delete-room-title"
          className="font-bebas text-[22px] tracking-[0.08em] mb-2"
          style={{ color: "var(--color-primary)" }}
        >
          Delete Room?
        </h3>
        <p className="font-mono text-[14px] mb-6" style={{ color: "var(--color-meta)" }}>
          Are you sure you want to delete{" "}
          <span style={{ color: "var(--color-primary)" }}>
            {displayRoomName}
          </span>
          ? This will permanently delete all messages. This action cannot be undone.
        </p>
        {deleteError && (
          <p className="text-sm mb-4" style={{ color: "#ff4444" }}>{deleteError}</p>
        )}
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="px-4 py-2 font-bebas text-[14px] tracking-[0.10em] transition-colors disabled:opacity-50"
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
            onClick={onConfirm}
            disabled={deleting}
            className="px-4 py-2 font-bebas text-[14px] tracking-[0.10em] transition-colors disabled:opacity-50"
            style={{
              background: "#ff4444",
              color: "#000",
              border: "1px solid #ff4444",
            }}
          >
            {deleting ? "DELETING..." : "DELETE ROOM"}
          </button>
        </div>
      </div>
    </div>
  );
}

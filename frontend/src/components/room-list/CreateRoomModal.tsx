import { useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import type { FormEvent } from "react";
import { useFocusTrap } from "../../hooks/useFocusTrap";

interface CreateRoomModalProps {
  isOpen: boolean;
  roomName: string;
  creating: boolean;
  createError: string;
  onRoomNameChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}

export function CreateRoomModal({
  isOpen,
  roomName,
  creating,
  createError,
  onRoomNameChange,
  onClose,
  onSubmit,
}: CreateRoomModalProps) {
  const createModalRef = useRef<HTMLDivElement>(null);
  const closeModal = useCallback(() => {
    onClose();
  }, [onClose]);

  useFocusTrap(createModalRef, isOpen, closeModal);

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        ref={createModalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-room-title"
        className="p-6 max-w-md w-full mx-4"
        style={{
          background: "var(--bg-panel)",
          border: "1px solid var(--border-primary)",
        }}
      >
        <h3
          id="create-room-title"
          className="font-bebas text-[22px] tracking-[0.08em] mb-4"
          style={{ color: "var(--color-primary)" }}
        >
          Create New Room
        </h3>

        <form onSubmit={onSubmit}>
          <div className="mb-4">
            <label
              htmlFor="roomName"
              className="block font-pixel text-[8px] tracking-[0.2em] mb-2"
              style={{ color: "var(--color-meta)" }}
            >
              ROOM NAME
            </label>
            <input
              id="roomName"
              type="text"
              value={roomName}
              onChange={(event) => {
                onRoomNameChange(event.target.value);
              }}
              placeholder="e.g., General Discussion"
              autoFocus
              disabled={creating}
              className="w-full px-3 py-2 font-mono text-[14px] focus:outline-none disabled:opacity-50"
              style={{
                background: "var(--bg-app)",
                color: "var(--color-primary)",
                border: "1px solid var(--border-primary)",
                borderRadius: "2px",
              }}
              onFocus={(event) => {
                event.currentTarget.style.boxShadow = "var(--glow-primary)";
              }}
              onBlur={(event) => {
                event.currentTarget.style.boxShadow = "none";
              }}
            />
            {createError && (
              <p className="mt-2 text-sm" style={{ color: "#ff4444" }}>
                {createError}
              </p>
            )}
            <p
              className="mt-2 font-pixel text-[7px] tracking-[0.12em]"
              style={{ color: "var(--color-meta)" }}
            >
              ROOM NAMES MUST BE 3-50 CHARACTERS
            </p>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={closeModal}
              disabled={creating}
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
              type="submit"
              disabled={creating || !roomName.trim()}
              className="px-4 py-2 font-bebas text-[14px] tracking-[0.10em] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                border: "1px solid var(--color-primary)",
                color: "#000",
                background: "var(--color-primary)",
              }}
            >
              {creating ? "CREATING..." : "CREATE ROOM"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

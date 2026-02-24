import type { RefObject } from "react";

interface EditRoomMetadataModalProps {
  open: boolean;
  roomName: string;
  roomDescription: string;
  saving: boolean;
  saveError: string;
  modalRef: RefObject<HTMLDivElement | null>;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}

export function EditRoomMetadataModal({
  open,
  roomName,
  roomDescription,
  saving,
  saveError,
  modalRef,
  onNameChange,
  onDescriptionChange,
  onCancel,
  onSave,
}: EditRoomMetadataModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-room-title"
        className="p-6 max-w-md w-full mx-4"
        style={{
          background: "var(--bg-panel)",
          border: "1px solid var(--border-primary)",
        }}
      >
        <h3
          id="edit-room-title"
          className="font-bebas text-[22px] tracking-[0.08em] mb-4"
          style={{ color: "var(--color-primary)" }}
        >
          Edit Room Details
        </h3>

        <div className="space-y-4">
          <label className="block">
            <span
              className="block font-pixel text-[8px] tracking-[0.12em] mb-2"
              style={{ color: "var(--color-meta)" }}
            >
              ROOM NAME
            </span>
            <input
              type="text"
              value={roomName}
              onChange={(event) => onNameChange(event.target.value)}
              disabled={saving}
              maxLength={50}
              className="w-full px-3 py-2 font-mono text-[14px] outline-none disabled:opacity-60"
              style={{
                background: "var(--bg-app)",
                border: "1px solid var(--border-dim)",
                color: "var(--color-text)",
              }}
            />
          </label>

          <label className="block">
            <span
              className="block font-pixel text-[8px] tracking-[0.12em] mb-2"
              style={{ color: "var(--color-meta)" }}
            >
              DESCRIPTION (OPTIONAL)
            </span>
            <input
              type="text"
              value={roomDescription}
              onChange={(event) => onDescriptionChange(event.target.value)}
              disabled={saving}
              maxLength={255}
              className="w-full px-3 py-2 font-mono text-[14px] outline-none disabled:opacity-60"
              style={{
                background: "var(--bg-app)",
                border: "1px solid var(--border-dim)",
                color: "var(--color-text)",
              }}
              aria-describedby="room-description-help"
            />
          </label>

          <p
            id="room-description-help"
            className="font-mono text-[11px]"
            style={{ color: "var(--color-meta)" }}
          >
            Plain text only, max 255 characters.
          </p>
        </div>

        {saveError && (
          <p className="text-sm mt-3" style={{ color: "#ff4444" }}>
            {saveError}
          </p>
        )}

        <div className="flex gap-3 justify-end mt-6">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
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
            onClick={onSave}
            disabled={saving}
            className="px-4 py-2 font-bebas text-[14px] tracking-[0.10em] transition-colors disabled:opacity-50"
            style={{
              background: "var(--color-primary)",
              color: "#000",
              border: "1px solid var(--color-primary)",
            }}
          >
            {saving ? "SAVING..." : "SAVE"}
          </button>
        </div>
      </div>
    </div>
  );
}

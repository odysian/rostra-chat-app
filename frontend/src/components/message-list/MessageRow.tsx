import { useEffect, useRef, type KeyboardEvent } from "react";
import { getUserColorPalette } from "../../utils/userColors";
import type { Message } from "../../types";

interface MessageRowProps {
  message: Message;
  isGrouped: boolean;
  isComfortableDensity: boolean;
  theme: "neon" | "amber";
  isHighlighted: boolean;
  headerTime: string;
  hoverTime: string;
  fullDateTime: string;
  editedHoverTime: string;
  editedFullDateTime: string;
  canEdit: boolean;
  canDelete: boolean;
  isEditing: boolean;
  isDeleting: boolean;
  isSavingEdit: boolean;
  editDraft: string;
  editError: string;
  onStartEdit: (messageId: number, content: string) => void;
  onEditDraftChange: (value: string) => void;
  onEditKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDeleteMessage: (messageId: number) => void;
}

export function MessageRow({
  message,
  isGrouped,
  isComfortableDensity,
  theme,
  isHighlighted,
  headerTime,
  hoverTime,
  fullDateTime,
  editedHoverTime,
  editedFullDateTime,
  canEdit,
  canDelete,
  isEditing,
  isDeleting,
  isSavingEdit,
  editDraft,
  editError,
  onStartEdit,
  onEditDraftChange,
  onEditKeyDown,
  onCancelEdit,
  onSaveEdit,
  onDeleteMessage,
}: MessageRowProps) {
  // Keep amber visuals cohesive by using per-user hues only in neon mode.
  const userColors = theme === "neon" ? getUserColorPalette(message.username) : null;
  const isDeleted = Boolean(message.deleted_at);
  const isEdited = Boolean(message.edited_at);
  const editTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!isEditing) return;

    const textarea = editTextareaRef.current;
    if (!textarea) return;

    const cursorAtEnd = textarea.value.length;
    textarea.focus();
    textarea.setSelectionRange(cursorAtEnd, cursorAtEnd);
  }, [isEditing]);

  return (
    <div
      data-chat-message="true"
      data-message-id={message.id}
      className={`group flex items-start hover:bg-white/[0.02] transition-colors ${
        isComfortableDensity ? "gap-3 px-2" : "gap-2.5 px-1.5"
      } ${
        isGrouped
          ? isComfortableDensity
            ? "mt-0.5 py-0.5"
            : "mt-0 py-0.5"
          : isComfortableDensity
            ? "mt-3.5 py-0.5"
            : "mt-2.5 py-0.5"
      }`}
      style={{
        animation: "slide-in 0.2s ease-out",
        background: isHighlighted ? "rgba(0, 240, 255, 0.10)" : undefined,
        borderLeft: isHighlighted
          ? "2px solid var(--color-primary)"
          : "2px solid transparent",
      }}
    >
      <div
        className={`shrink-0 select-none flex justify-center ${
          isComfortableDensity ? "w-11" : "w-9"
        }`}
      >
        {!isGrouped ? (
          <div
            className={`rounded-full flex items-center justify-center font-bebas ${
              isComfortableDensity ? "w-11 h-11 text-[16px]" : "w-9 h-9 text-[14px]"
            }`}
            style={{
              background: userColors?.backgroundColor ?? "var(--bg-app)",
              border: `1px solid ${userColors?.borderColor ?? "var(--border-primary)"}`,
              color: userColors?.textColor ?? "var(--color-primary)",
              boxShadow: userColors?.glowColor ?? "none",
            }}
          >
            {message.username.substring(0, 2).toUpperCase()}
          </div>
        ) : (
          <span
            className={`block font-mono pt-1 text-center w-full whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 ${
              isComfortableDensity ? "text-[12px]" : "text-[11px]"
            }`}
            style={{ color: "var(--color-meta)" }}
            title={fullDateTime}
          >
            {hoverTime}
          </span>
        )}
      </div>

      <div className="flex flex-col min-w-0 flex-1">
        {!isGrouped && (
          <div className="flex items-baseline gap-2">
            <span
              className="font-mono font-semibold text-[14px] tracking-[0.06em]"
              style={{ color: userColors?.textColor ?? "var(--color-primary)" }}
            >
              {message.username}
            </span>
            <span
              className={`font-mono tracking-[0.08em] ${
                isComfortableDensity ? "text-[12px]" : "text-[11px]"
              }`}
              style={{ color: "var(--color-meta)" }}
              title={fullDateTime}
            >
              {headerTime}
            </span>
            {isEdited && !isEditing && (
              <span
                className="font-mono text-[10px] tracking-[0.08em]"
                style={{ color: "var(--color-meta)" }}
                title={editedFullDateTime}
                aria-label={`Edited at ${editedHoverTime}`}
              >
                (edited)
              </span>
            )}
          </div>
        )}

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {isEditing ? (
              <div className={`${isGrouped ? "" : isComfortableDensity ? "mt-1" : "mt-0.5"}`}>
                <textarea
                  ref={editTextareaRef}
                  value={editDraft}
                  onChange={(event) => onEditDraftChange(event.target.value)}
                  onKeyDown={onEditKeyDown}
                  className="w-full resize-none font-mono text-[14px] leading-normal px-2 py-1 border rounded-none"
                  style={{
                    color: "var(--color-msg-text)",
                    background: "var(--bg-panel)",
                    borderColor: "var(--border-dim)",
                  }}
                  rows={Math.max(2, editDraft.split("\n").length)}
                  aria-label="Edit message content"
                />
                {editError && (
                  <p
                    className="mt-1 font-mono text-[11px]"
                    style={{ color: "#ff4444" }}
                    role="alert"
                  >
                    {editError}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onSaveEdit}
                    disabled={isSavingEdit}
                    className="font-mono text-[10px] tracking-[0.08em] px-2 py-1 border"
                    style={{
                      color: "var(--color-meta)",
                      borderColor: "var(--border-dim)",
                      background: "transparent",
                    }}
                    aria-label={isSavingEdit ? "Saving edit" : "Save message edit"}
                  >
                    {isSavingEdit ? "SAVING" : "SAVE"}
                  </button>
                  <button
                    type="button"
                    onClick={onCancelEdit}
                    disabled={isSavingEdit}
                    className="font-mono text-[10px] tracking-[0.08em] px-2 py-1 border"
                    style={{
                      color: "var(--color-meta)",
                      borderColor: "var(--border-dim)",
                      background: "transparent",
                    }}
                    aria-label="Cancel message edit"
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div
                  className={`font-mono break-words ${
                    isDeleted
                      ? isComfortableDensity
                        ? "text-[13px] leading-normal"
                        : "text-[12px] leading-normal"
                      : isComfortableDensity
                        ? "text-[18px] leading-relaxed"
                        : "text-[15px] leading-normal"
                  } ${isGrouped ? "" : isComfortableDensity ? "mt-1" : "mt-0.5"}`}
                  style={{ color: isDeleted ? "var(--color-meta)" : "var(--color-msg-text)" }}
                >
                  {isDeleted ? "(deleted)" : message.content}
                </div>
                {isGrouped && isEdited && (
                  <span
                    className="mt-0.5 inline-block font-mono text-[10px] tracking-[0.08em]"
                    style={{ color: "var(--color-meta)" }}
                    title={editedFullDateTime}
                    aria-label={`Edited at ${editedHoverTime}`}
                  >
                    (edited)
                  </span>
                )}
              </>
            )}
          </div>
          {!isEditing && (canEdit || canDelete) && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              {canEdit && (
                <button
                  type="button"
                  onClick={() => onStartEdit(message.id, message.content)}
                  className="font-mono text-[10px] tracking-[0.08em] px-2 py-1 border"
                  style={{
                    color: "var(--color-meta)",
                    borderColor: "var(--border-dim)",
                    background: "transparent",
                  }}
                  aria-label="Edit message"
                >
                  EDIT
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  onClick={() => onDeleteMessage(message.id)}
                  disabled={isDeleting}
                  className="font-mono text-[10px] tracking-[0.08em] px-2 py-1 border"
                  style={{
                    color: "var(--color-meta)",
                    borderColor: "rgba(255, 68, 68, 0.35)",
                    background: "transparent",
                  }}
                  aria-label={isDeleting ? "Deleting message" : "Delete message"}
                >
                  {isDeleting ? "DELETING" : "DELETE"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Ellipsis } from "lucide-react";
import { getUserColorPalette } from "../../utils/userColors";
import type { Message, ReactionEmoji } from "../../types";
import { REACTION_ALLOWLIST, sortReactions } from "./reactionConfig";

const LONG_PRESS_MS = 350;
const LONG_PRESS_MOVE_THRESHOLD = 10;

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
  canReact: boolean;
  isEditing: boolean;
  isDeleting: boolean;
  isSavingEdit: boolean;
  editDraft: string;
  editError: string;
  pendingReactionKeys: string[];
  onStartEdit: (messageId: number, content: string) => void;
  onEditDraftChange: (value: string) => void;
  onEditKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDeleteMessage: (messageId: number) => void;
  onToggleReaction: (messageId: number, emoji: ReactionEmoji, reactedByMe: boolean) => void;
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  return Boolean(
    target.closest(
      "button, a, input, textarea, select, [role='button'], [contenteditable='true']",
    ),
  );
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
  canReact,
  isEditing,
  isDeleting,
  isSavingEdit,
  editDraft,
  editError,
  pendingReactionKeys,
  onStartEdit,
  onEditDraftChange,
  onEditKeyDown,
  onCancelEdit,
  onSaveEdit,
  onDeleteMessage,
  onToggleReaction,
}: MessageRowProps) {
  // Keep amber visuals cohesive by using per-user hues only in neon mode.
  const userColors = theme === "neon" ? getUserColorPalette(message.username) : null;
  const isDeleted = Boolean(message.deleted_at);
  const isEdited = Boolean(message.edited_at);
  const reactions = sortReactions(message.reactions ?? []);
  const visibleReactions = reactions.slice(0, 5);
  const overflowReactionsCount = Math.max(0, reactions.length - visibleReactions.length);
  const editTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const actionTriggerRef = useRef<HTMLButtonElement | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressOriginRef = useRef<{ x: number; y: number } | null>(null);

  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);
  const [desktopShelfPlacement, setDesktopShelfPlacement] = useState<"below" | "above">(
    "below",
  );

  const getReactionKey = (emoji: ReactionEmoji): string => `${message.id}:${emoji}`;
  const hasActionControls = !isEditing && !isDeleted && (canEdit || canDelete || canReact);
  const actionMenuVisible = actionMenuOpen && hasActionControls;
  const mobileActionSheetVisible = actionMenuVisible && isCoarsePointer;
  const desktopActionShelfVisible = actionMenuVisible && !isCoarsePointer;

  useEffect(() => {
    if (!isEditing) return;

    const textarea = editTextareaRef.current;
    if (!textarea) return;

    const cursorAtEnd = textarea.value.length;
    textarea.focus();
    textarea.setSelectionRange(cursorAtEnd, cursorAtEnd);
  }, [isEditing]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const coarsePointerQuery = window.matchMedia("(pointer: coarse)");
    const updatePointerMode = () => {
      setIsCoarsePointer(coarsePointerQuery.matches);
    };

    updatePointerMode();

    coarsePointerQuery.addEventListener("change", updatePointerMode);
    return () => {
      coarsePointerQuery.removeEventListener("change", updatePointerMode);
    };
  }, []);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current == null) return;

    window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
    longPressOriginRef.current = null;
  };

  useEffect(() => clearLongPressTimer, []);

  useEffect(() => {
    if (!actionMenuVisible) return;

    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setActionMenuOpen(false);
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [actionMenuVisible]);

  const closeActionMenu = () => {
    setActionMenuOpen(false);
  };

  const handleLongPressPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isCoarsePointer || !hasActionControls) return;
    if (event.pointerType === "mouse") return;
    if (isInteractiveTarget(event.target)) return;

    clearLongPressTimer();
    longPressOriginRef.current = { x: event.clientX, y: event.clientY };

    longPressTimerRef.current = window.setTimeout(() => {
      setActionMenuOpen(true);
      longPressTimerRef.current = null;
      longPressOriginRef.current = null;
    }, LONG_PRESS_MS);
  };

  const handleLongPressPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (longPressTimerRef.current == null || longPressOriginRef.current == null) return;

    const deltaX = Math.abs(event.clientX - longPressOriginRef.current.x);
    const deltaY = Math.abs(event.clientY - longPressOriginRef.current.y);

    // Let users scroll naturally without accidentally triggering the long-press action sheet.
    if (deltaX > LONG_PRESS_MOVE_THRESHOLD || deltaY > LONG_PRESS_MOVE_THRESHOLD) {
      clearLongPressTimer();
    }
  };

  const handleLongPressCancel = () => {
    clearLongPressTimer();
  };

  const handleReactionSelection = (emoji: ReactionEmoji, reactedByMe: boolean) => {
    onToggleReaction(message.id, emoji, reactedByMe);
    closeActionMenu();
  };

  const handleStartEdit = () => {
    onStartEdit(message.id, message.content);
    closeActionMenu();
  };

  const handleDelete = () => {
    onDeleteMessage(message.id);
    closeActionMenu();
  };

  const resolveDesktopShelfPlacement = () => {
    const trigger = actionTriggerRef.current;
    if (!trigger) return;

    const triggerRect = trigger.getBoundingClientRect();
    const estimatedShelfHeight = 280;
    const spaceBelow = window.innerHeight - triggerRect.bottom;
    const spaceAbove = triggerRect.top;

    if (spaceBelow < estimatedShelfHeight && spaceAbove > spaceBelow) {
      setDesktopShelfPlacement("above");
      return;
    }

    setDesktopShelfPlacement("below");
  };

  const actionTriggerClass =
    "h-8 w-8 flex items-center justify-center border transition-colors opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-1";

  const quickReactionButtons = (
    <div className="flex items-center gap-1 flex-nowrap">
      {REACTION_ALLOWLIST.map((emoji) => {
        const matchingReaction = reactions.find((reaction) => reaction.emoji === emoji);
        const reactedByMe = matchingReaction?.reacted_by_me ?? false;
        const reactionPending = pendingReactionKeys.includes(getReactionKey(emoji));

        return (
          <button
            key={emoji}
            type="button"
            disabled={reactionPending}
            onClick={() => handleReactionSelection(emoji, reactedByMe)}
            className="h-8 w-8 shrink-0 font-mono text-[14px] border"
            style={{
              color: reactedByMe ? "var(--color-primary)" : "var(--color-text)",
              borderColor: reactedByMe ? "var(--color-primary)" : "var(--border-dim)",
              background: reactedByMe
                ? "color-mix(in srgb, var(--color-primary) 10%, transparent)"
                : "transparent",
              opacity: reactionPending ? 0.55 : 1,
            }}
            aria-label={reactedByMe ? `Remove ${emoji} reaction` : `Add ${emoji} reaction`}
          >
            {emoji}
          </button>
        );
      })}
    </div>
  );

  const actionMenuContent = (
    <>
      <p
        className="font-pixel text-[8px] tracking-[0.16em] mb-2"
        style={{ color: "var(--color-text)" }}
      >
        MESSAGE ACTIONS
      </p>

      {canReact && (
        <div className="mb-3">
          <p
            className="font-mono text-[11px] mb-1"
            style={{ color: "var(--color-text)" }}
          >
            Quick reactions
          </p>
          {quickReactionButtons}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {canEdit && (
          <button
            type="button"
            onClick={handleStartEdit}
            className="w-full min-h-10 font-mono text-[12px] tracking-[0.08em] px-3 py-2 border text-left"
            style={{
              color: "var(--color-text)",
              borderColor: "var(--border-dim)",
              background: "transparent",
            }}
            aria-label="Edit message"
          >
            EDIT MESSAGE
          </button>
        )}
        {canDelete && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="w-full min-h-10 font-mono text-[12px] tracking-[0.08em] px-3 py-2 border text-left"
            style={{
              color: "var(--color-text)",
              borderColor: "rgba(255, 68, 68, 0.35)",
              background: "transparent",
              opacity: isDeleting ? 0.55 : 1,
            }}
            aria-label={isDeleting ? "Deleting message" : "Delete message"}
          >
            {isDeleting ? "DELETING MESSAGE" : "DELETE MESSAGE"}
          </button>
        )}
        <button
          type="button"
          onClick={closeActionMenu}
          className="w-full min-h-10 font-mono text-[12px] tracking-[0.08em] px-3 py-2 border text-left"
          style={{
            color: "var(--color-text)",
            borderColor: "var(--border-dim)",
            background: "transparent",
          }}
          aria-label="Cancel message actions"
        >
          CANCEL
        </button>
      </div>
    </>
  );

  return (
    <>
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

          <div className="relative min-w-0 flex-1">
            <div
              className="min-w-0"
              onPointerDown={isEditing ? undefined : handleLongPressPointerDown}
              onPointerMove={isEditing ? undefined : handleLongPressPointerMove}
              onPointerUp={isEditing ? undefined : handleLongPressCancel}
              onPointerCancel={isEditing ? undefined : handleLongPressCancel}
              onPointerLeave={isEditing ? undefined : handleLongPressCancel}
            >
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
                  {reactions.length > 0 && (
                    <div className="mt-2 flex items-center gap-1 flex-wrap">
                      {visibleReactions.map((reaction) => (
                        <button
                          key={reaction.emoji}
                          type="button"
                          disabled={pendingReactionKeys.includes(getReactionKey(reaction.emoji))}
                          onClick={() =>
                            onToggleReaction(
                              message.id,
                              reaction.emoji,
                              reaction.reacted_by_me,
                            )
                          }
                          className="font-mono text-[10px] px-2 py-0.5 border transition-colors"
                          style={{
                            color: reaction.reacted_by_me
                              ? "var(--color-primary)"
                              : "var(--color-meta)",
                            borderColor: reaction.reacted_by_me
                              ? "var(--color-primary)"
                              : "var(--border-dim)",
                            background: reaction.reacted_by_me
                              ? "color-mix(in srgb, var(--color-primary) 10%, transparent)"
                              : "transparent",
                          }}
                          aria-label={`Toggle ${reaction.emoji} reaction`}
                        >
                          {reaction.emoji} {reaction.count}
                        </button>
                      ))}
                      {overflowReactionsCount > 0 && (
                        <span
                          className="font-mono text-[10px] px-2 py-0.5 border"
                          style={{
                            color: "var(--color-meta)",
                            borderColor: "var(--border-dim)",
                          }}
                          aria-label={`${overflowReactionsCount} more reactions`}
                        >
                          +{overflowReactionsCount}
                        </span>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {!isCoarsePointer && hasActionControls && (
              <div className="absolute right-0 top-0 z-10">
                <button
                  ref={actionTriggerRef}
                  type="button"
                  onClick={() => {
                    if (!actionMenuOpen) {
                      resolveDesktopShelfPlacement();
                    }
                    setActionMenuOpen((prev) => !prev);
                  }}
                  className={actionTriggerClass}
                  style={{
                    color: "var(--color-text)",
                    borderColor: "var(--border-dim)",
                    background: "var(--bg-panel)",
                  }}
                  aria-label={desktopActionShelfVisible ? "Close message actions" : "More message actions"}
                  title="Message actions"
                >
                  <Ellipsis size={14} aria-hidden="true" />
                </button>
              </div>
            )}

            {desktopActionShelfVisible && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-20"
                  style={{ background: "transparent" }}
                  onClick={closeActionMenu}
                  aria-label="Close message actions"
                />
                <div
                  role="dialog"
                  aria-label="Message actions"
                  className={`absolute right-0 z-30 w-[17rem] border p-2 ${
                    desktopActionShelfVisible && desktopShelfPlacement === "above"
                      ? "bottom-9"
                      : "top-9"
                  }`}
                  style={{
                    background: "var(--bg-panel)",
                    borderColor: "var(--border-dim)",
                    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.35)",
                    maxHeight: "min(18rem, calc(100vh - 1rem))",
                    overflowY: "auto",
                  }}
                >
                  {actionMenuContent}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {mobileActionSheetVisible && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0, 0, 0, 0.65)" }}
            onClick={closeActionMenu}
            aria-label="Close message actions"
          />
          <div
            role="dialog"
            aria-label="Message actions"
            className="fixed inset-x-0 bottom-0 z-50 border-t px-3 pb-4 pt-3"
            style={{
              background: "var(--bg-panel)",
              borderColor: "var(--border-dim)",
              boxShadow: "0 -8px 24px rgba(0, 0, 0, 0.35)",
            }}
          >
            {actionMenuContent}
          </div>
        </>
      )}
    </>
  );
}

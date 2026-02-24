import { useCallback, useEffect, useRef, useState } from "react";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import type {
  Message,
  MessageContextResponse,
  Room,
  WSDeletedMessagePayload,
  WSEditedMessagePayload,
} from "../types";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { deleteRoom } from "../services/api";
import { logError } from "../utils/logger";
import { formatRoomNameForDisplay } from "../utils/roomNames";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { MessageAreaHeader } from "./message-area/MessageAreaHeader";
import { DeleteRoomModal } from "./message-area/DeleteRoomModal";

interface MessageAreaProps {
  selectedRoom: Room | null;
  roomOpenLastReadSnapshot?: string | null;
  density: "compact" | "comfortable";
  messageViewMode?: "normal" | "context";
  messageContext?: MessageContextResponse | null;
  hasOtherUnreadRooms?: boolean;
  incomingMessages: Message[];
  onIncomingMessagesProcessed: () => void;
  incomingMessageDeletions?: WSDeletedMessagePayload[];
  onIncomingMessageDeletionsProcessed?: () => void;
  incomingMessageEdits?: WSEditedMessagePayload[];
  onIncomingMessageEditsProcessed?: () => void;
  onToggleUsers: () => void;
  onToggleSearch: () => void;
  onRoomDeleted: () => void;
  onLeaveRoom: () => void;
  onBackToRooms: () => void;
  typingUsernames: string[];
  wsError?: string | null;
  onDismissWsError?: () => void;
  onExitContextMode?: () => void;
}

export default function MessageArea({
  selectedRoom,
  roomOpenLastReadSnapshot = null,
  density,
  messageViewMode = "normal",
  messageContext = null,
  hasOtherUnreadRooms = false,
  incomingMessages,
  onIncomingMessagesProcessed,
  incomingMessageDeletions = [],
  onIncomingMessageDeletionsProcessed = () => {},
  incomingMessageEdits = [],
  onIncomingMessageEditsProcessed = () => {},
  onToggleUsers,
  onToggleSearch,
  onRoomDeleted,
  onLeaveRoom,
  onBackToRooms,
  typingUsernames,
  wsError,
  onDismissWsError,
  onExitContextMode = () => {},
}: MessageAreaProps) {
  const { user, token } = useAuth();
  const { theme } = useTheme();
  const [showRoomMenu, setShowRoomMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Inline error message for failed room deletion (avoid disruptive alerts)
  const [deleteError, setDeleteError] = useState("");
  // Incrementing this counter lets MessageList react to local sends and jump to latest.
  const [scrollToLatestSignal, setScrollToLatestSignal] = useState(0);
  const deleteModalRef = useRef<HTMLDivElement>(null);
  const closeDeleteModal = useCallback(() => {
    setDeleteError("");
    setShowDeleteModal(false);
  }, []);

  // Keyboard users should be able to dismiss the room options menu with Escape.
  useEffect(() => {
    if (!showRoomMenu) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowRoomMenu(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [showRoomMenu]);

  useFocusTrap(deleteModalRef, showDeleteModal, closeDeleteModal);

  // Keep tab flow optimized for send-first workflows:
  // input -> send -> back -> room menu -> search -> users.
  useEffect(() => {
    const handleTabOrder = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      if (!(event.target instanceof HTMLElement)) return;

      const selectors = [
        "[data-tab-focus='message-input']",
        "[data-tab-focus='send-button']",
        "[data-tab-focus='back-button']",
        "[data-tab-focus='room-menu-button']",
        "[data-tab-focus='search-button']",
        "[data-tab-focus='users-button']",
      ];

      const tabStops = selectors
        .map((selector) => document.querySelector<HTMLElement>(selector))
        .filter((element): element is HTMLElement => element !== null);

      const currentIndex = tabStops.indexOf(event.target);
      if (currentIndex === -1) return;

      const direction = event.shiftKey ? -1 : 1;
      let nextIndex = currentIndex + direction;

      while (nextIndex >= 0 && nextIndex < tabStops.length) {
        const nextStop = tabStops[nextIndex];
        nextStop.focus();
        if (document.activeElement === nextStop) {
          event.preventDefault();
          return;
        }
        nextIndex += direction;
      }
    };

    window.addEventListener("keydown", handleTabOrder);
    return () => window.removeEventListener("keydown", handleTabOrder);
  }, []);

  if (!selectedRoom) {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        style={{ background: "var(--bg-app)" }}
      >
        <div
          className="text-center px-8 py-7 mx-4 max-w-xl"
          style={{
            border: "1px solid var(--border-dim)",
            background: "var(--bg-panel)",
          }}
        >
          {theme === "neon" ? (
            <h2
              className="font-bebas text-[36px] tracking-[0.06em] mb-2 gradient-text"
              style={{
                backgroundImage:
                  "linear-gradient(90deg, var(--color-primary), var(--color-secondary))",
              }}
            >
              Welcome to Rostra
            </h2>
          ) : (
            <h2
              className="font-bebas text-[36px] tracking-[0.06em] mb-2"
              style={{
                color: "var(--color-primary)",
                textShadow: "var(--glow-primary)",
              }}
            >
              Welcome to Rostra
            </h2>
          )}
          <p className="font-mono text-[15px]" style={{ color: "var(--color-meta)" }}>
            Select a room from the sidebar to start chatting
          </p>
        </div>
      </div>
    );
  }

  const isRoomOwner = user?.id === selectedRoom.created_by;
  const displayRoomName = formatRoomNameForDisplay(selectedRoom.name);

  // Format typing indicator text based on number of users
  const formatTypingText = (usernames: string[]): string => {
    if (usernames.length === 0) return "";
    if (usernames.length === 1) return `${usernames[0]} is typing`;
    if (usernames.length === 2)
      return `${usernames[0]} and ${usernames[1]} are typing`;
    if (usernames.length === 3)
      return `${usernames[0]}, ${usernames[1]}, and ${usernames[2]} are typing`;
    return `${usernames[0]}, ${usernames[1]}, and ${usernames.length - 2} others are typing`;
  };

  const handleDeleteRoom = async () => {
    if (!token) return;

    setDeleting(true);
    setDeleteError("");
    try {
      await deleteRoom(selectedRoom.id, token);
      setShowDeleteModal(false);
      setShowRoomMenu(false);
      onRoomDeleted();
    } catch (err) {
      logError("Failed to delete room:", err);
      setDeleteError(
        err instanceof Error
          ? err.message
          : "Failed to delete room. Please try again.",
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden"
      style={{ background: "var(--bg-app)" }}
    >
      <MessageAreaHeader
        displayRoomName={displayRoomName}
        theme={theme}
        showRoomMenu={showRoomMenu}
        hasOtherUnreadRooms={hasOtherUnreadRooms}
        isRoomOwner={isRoomOwner}
        onBackToRooms={onBackToRooms}
        onToggleRoomMenu={() => setShowRoomMenu((prev) => !prev)}
        onCloseRoomMenu={() => setShowRoomMenu(false)}
        onLeaveRoom={() => {
          setShowRoomMenu(false);
          onLeaveRoom();
        }}
        onRequestDeleteRoom={() => {
          setShowRoomMenu(false);
          setDeleteError("");
          setShowDeleteModal(true);
        }}
        onToggleSearch={onToggleSearch}
        onToggleUsers={onToggleUsers}
      />

      <DeleteRoomModal
        open={showDeleteModal}
        displayRoomName={displayRoomName}
        deleting={deleting}
        deleteError={deleteError}
        modalRef={deleteModalRef}
        onCancel={closeDeleteModal}
        onConfirm={handleDeleteRoom}
      />

      <MessageList
        key={selectedRoom.id}
        roomId={selectedRoom.id}
        roomCreatorId={selectedRoom.created_by}
        density={density}
        messageViewMode={messageViewMode}
        messageContext={messageContext}
        lastReadAtSnapshot={roomOpenLastReadSnapshot}
        incomingMessages={incomingMessages}
        onIncomingMessagesProcessed={onIncomingMessagesProcessed}
        incomingMessageDeletions={incomingMessageDeletions}
        onIncomingMessageDeletionsProcessed={onIncomingMessageDeletionsProcessed}
        incomingMessageEdits={incomingMessageEdits}
        onIncomingMessageEditsProcessed={onIncomingMessageEditsProcessed}
        scrollToLatestSignal={scrollToLatestSignal}
        onExitContextMode={onExitContextMode}
      />

      {/* Typing indicator — always rendered to reserve space and avoid layout shift */}
      <div
        className="h-7 shrink-0 flex items-center gap-1"
        style={{ padding: "0 20px" }}
      >
        {typingUsernames.length > 0 && (
          <>
            <span
              className="font-mono text-[11px] tracking-[0.10em]"
              style={{ color: "var(--color-meta)" }}
            >
              {formatTypingText(typingUsernames)}
            </span>
            {/* Animated dots */}
            <span className="flex gap-0.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="inline-block w-1 h-1 rounded-full"
                  style={{
                    background: "var(--color-accent2)",
                    animation: `dot-blink 1.4s infinite ${i * 0.4}s`,
                  }}
                />
              ))}
            </span>
          </>
        )}
      </div>

      {/* Ephemeral WS error (e.g. rate limit) — auto-clears after 4s */}
      {wsError && (
        <div
          className="shrink-0 px-4 py-2 font-mono text-[12px] flex items-center justify-between gap-2"
          style={{
            background: "rgba(255, 68, 68, 0.08)",
            borderTop: "1px solid rgba(255, 68, 68, 0.2)",
            color: "#ff4444",
          }}
        >
          <span>{wsError}</span>
          <button
            type="button"
            onClick={onDismissWsError}
            className="icon-button-focus"
            style={{ color: "#ff4444" }}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      <MessageInput
        roomId={selectedRoom.id}
        roomName={displayRoomName}
        onMessageSent={() => setScrollToLatestSignal((prev) => prev + 1)}
      />
    </div>
  );
}

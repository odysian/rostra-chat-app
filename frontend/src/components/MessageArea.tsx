import { useState } from "react";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import type { Message, Room } from "../types";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { deleteRoom } from "../services/api";
import { logError } from "../utils/logger";
import { formatRoomNameForDisplay } from "../utils/roomNames";

interface MessageAreaProps {
  selectedRoom: Room | null;
  incomingMessages: Message[];
  onIncomingMessagesProcessed: () => void;
  onToggleUsers: () => void;
  onToggleSearch: () => void;
  onRoomDeleted: () => void;
  onLeaveRoom: () => void;
  onBackToRooms: () => void;
  isMobile: boolean;
  typingUsernames: string[];
  wsError?: string | null;
  onDismissWsError?: () => void;
}

export default function MessageArea({
  selectedRoom,
  incomingMessages,
  onIncomingMessagesProcessed,
  onToggleUsers,
  onToggleSearch,
  onRoomDeleted,
  onLeaveRoom,
  onBackToRooms,
  typingUsernames,
  wsError,
  onDismissWsError,
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

  if (!selectedRoom) {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        style={{ background: "var(--bg-app)" }}
      >
        <div className="text-center">
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
          <p className="font-mono text-[14px]" style={{ color: "var(--color-meta)" }}>
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
      {/* Room Header */}
      <div
        className="shrink-0 flex items-center justify-between gap-2 px-3 sm:px-5 min-w-0"
        style={{
          borderBottom: "1px solid var(--border-dim)",
          padding: "12px 20px",
        }}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {/* Back button - mobile only */}
          <button
            onClick={onBackToRooms}
            className="shrink-0 transition-colors md:hidden"
            style={{ color: "var(--color-meta)" }}
            title="Back to rooms"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>

          <div className="min-w-0 flex-1 overflow-hidden">
            {/* Room name — gradient for neon, solid glow for amber */}
            {theme === "neon" ? (
              <h2
                className="inline-block max-w-full font-bebas text-[22px] tracking-[0.12em] truncate gradient-text"
                title={`#${displayRoomName}`}
                style={{
                  backgroundImage:
                    "linear-gradient(90deg, var(--color-primary), var(--color-secondary))",
                  filter: "drop-shadow(0 0 6px rgba(0, 240, 255, 0.27))",
                }}
              >
                #{displayRoomName}
              </h2>
            ) : (
              <h2
                className="inline-block max-w-full font-bebas text-[22px] tracking-[0.12em] truncate"
                title={`#${displayRoomName}`}
                style={{
                  color: "var(--color-primary)",
                  textShadow: "var(--glow-primary)",
                }}
              >
                #{displayRoomName}
              </h2>
            )}
          </div>

          {/* Room Options Menu */}
          <div className="relative shrink-0">
            <button
              onClick={() => setShowRoomMenu(!showRoomMenu)}
              className="transition-colors p-1"
              style={{ color: "var(--color-meta)" }}
              title="Room options"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {showRoomMenu && (
              <>
                <div
                  className="fixed inset-0 z-10 cursor-pointer"
                  onClick={() => setShowRoomMenu(false)}
                />
                <div
                  className="absolute right-0 mt-2 w-48 shadow-lg py-1 z-20"
                  style={{
                    background: "var(--bg-panel)",
                    border: "1px solid var(--border-primary)",
                  }}
                >
                  <button
                    onClick={() => {
                      setShowRoomMenu(false);
                      onLeaveRoom();
                    }}
                    className="w-full px-4 py-2 text-left font-mono text-[12px] transition-colors"
                    style={{ color: "var(--color-text)" }}
                  >
                    Leave Room
                  </button>

                  {isRoomOwner && (
                    <>
                      <div style={{ borderTop: "1px solid var(--border-dim)", margin: "4px 0" }} />
                      <button
                        onClick={() => {
                          setShowRoomMenu(false);
                          setDeleteError("");
                          setShowDeleteModal(true);
                        }}
                        className="w-full px-4 py-2 text-left font-mono text-[12px] transition-colors"
                        style={{ color: "#ff4444" }}
                      >
                        Delete Room
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Search toggle */}
        <button
          onClick={onToggleSearch}
          className="shrink-0 transition-colors"
          style={{ color: "var(--color-meta)" }}
          title="Search messages"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </button>

        <button
          onClick={onToggleUsers}
          className="shrink-0 transition-colors"
          style={{ color: "var(--color-meta)" }}
          title="Toggle users panel"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div
            className="p-6 max-w-md w-full mx-4"
            style={{
              background: "var(--bg-panel)",
              border: "1px solid var(--border-primary)",
            }}
          >
            <h3
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
                onClick={() => {
                  setDeleteError("");
                  setShowDeleteModal(false);
                }}
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
                onClick={handleDeleteRoom}
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
      )}

      <MessageList
        key={selectedRoom.id}
        roomId={selectedRoom.id}
        incomingMessages={incomingMessages}
        onIncomingMessagesProcessed={onIncomingMessagesProcessed}
        scrollToLatestSignal={scrollToLatestSignal}
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

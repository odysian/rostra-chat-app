import { useState } from "react";
import { Crown } from "lucide-react";
import type { OnlineUser, User } from "../types";
import { useWebSocketContext } from "../context/useWebSocketContext";
import { useTheme } from "../context/ThemeContext";
import { getUserColorPalette } from "../utils/userColors";

interface UsersPanelProps {
  // Panel visibility
  isOpen: boolean;
  onClose: () => void; // For mobile backdrop click

  // User data (currentUser used to highlight "you" in online list)
  currentUser: User | null;
  onlineUsers: OnlineUser[];
  /** User id of the room creator/owner; show crown next to them in the list */
  roomOwnerId: number | null;
}

/**
 * UsersPanel Component
 *
 * Responsibility: Right panel showing connection status and online users in the current room.
 * - Identity and logout live in the sidebar (room list); this panel is "who is in this room" only.
 * - Mobile: overlays with backdrop; Desktop: static sidebar.
 */
export default function UsersPanel({
  isOpen,
  onClose,
  currentUser,
  onlineUsers,
  roomOwnerId,
}: UsersPanelProps) {
  const [onlineUsersExpanded, setOnlineUsersExpanded] = useState(true);
  const { connectionStatus } = useWebSocketContext();
  const { theme } = useTheme();

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case "connected":
        return "var(--color-accent2)";
      case "connecting":
      case "reconnecting":
        return "var(--color-accent)";
      case "error":
        return "#ff4444";
      default:
        return "var(--color-meta)";
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case "connected":
        return "Connected";
      case "connecting":
        return "Connecting...";
      case "reconnecting":
        return "Reconnecting...";
      case "error":
        return "Connection Error";
      default:
        return "Disconnected";
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Mobile backdrop - click to close */}
      <div
        data-testid="users-panel-backdrop"
        className="fixed inset-0 bg-black/50 z-40 md:hidden cursor-pointer"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="w-[190px] flex flex-col md:relative fixed inset-y-0 right-0 z-50 md:z-auto overflow-y-auto"
        style={{
          background: "var(--bg-panel)",
          borderLeft: "1px solid var(--border-secondary)",
        }}
      >
        {/* Online Users Header */}
        <div style={{ borderBottom: "1px solid var(--border-dim)" }}>
          <button
            onClick={() => setOnlineUsersExpanded(!onlineUsersExpanded)}
            className="w-full px-3.5 py-3 flex items-center justify-between transition-colors"
          >
            <h3
              className="font-bebas text-[13px] tracking-[0.10em]"
              style={{ color: "var(--color-secondary)" }}
            >
              ONLINE — {onlineUsers.length}
            </h3>
            <svg
              className={`w-4 h-4 transition-transform ${
                onlineUsersExpanded ? "rotate-180" : ""
              }`}
              style={{ color: "var(--color-meta)" }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        </div>

        {/* Online Users List */}
        {onlineUsersExpanded && (
          <div className="flex-1 overflow-y-auto">
            {onlineUsers.length === 0 ? (
              <p
                className="font-mono text-[12px] italic p-3.5"
                style={{ color: "var(--color-meta)" }}
              >
                No one here yet...
              </p>
            ) : (
              onlineUsers.map((user) => {
                const isCurrentUser = currentUser?.id === user.id;
                const isRoomOwner = roomOwnerId != null && user.id === roomOwnerId;
                // Keep amber visuals cohesive by using per-user hues only in neon mode.
                const userColors =
                  theme === "neon" ? getUserColorPalette(user.username) : null;
                return (
                  <div
                    key={user.id}
                    className="flex items-center gap-2"
                    style={{
                      padding: "9px 14px",
                      borderBottom: "1px solid var(--border-dim)",
                    }}
                  >
                    {/* Online dot */}
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{
                        background: isCurrentUser
                          ? getConnectionStatusColor()
                          : "var(--color-accent2)",
                        boxShadow: isCurrentUser ? undefined : "var(--glow-accent2)",
                        animation: isCurrentUser ? undefined : "breathe 2.8s ease-in-out infinite",
                      }}
                      title={isCurrentUser ? getConnectionStatusText() : "Online"}
                    />

                    <span
                      className="font-mono font-semibold text-[15px] tracking-[0.05em] truncate flex items-center gap-1.5 min-w-0 flex-1"
                      style={{
                        color: userColors?.textColor ?? "var(--color-text)",
                        opacity: 0.92,
                      }}
                    >
                      {user.username}
                      {isRoomOwner && (
                        <span title="Room owner">
                          <Crown
                            className="w-4 h-4 shrink-0"
                            style={{ color: "var(--color-primary)" }}
                            aria-hidden
                          />
                        </span>
                      )}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </>
  );
}

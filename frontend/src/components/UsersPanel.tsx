import { useState } from "react";
import { Crown } from "lucide-react";
import type { User } from "../types";
import { useWebSocketContext } from "../context/useWebSocketContext";

interface OnlineUser {
  id: number;
  username: string;
}

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

  // Helper to get user initials for avatar (and to highlight current user in list)
  const getUserInitials = (username: string) => {
    return username.substring(0, 2).toUpperCase();
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case "connected":
        return "bg-emerald-500";
      case "connecting":
      case "reconnecting":
        return "bg-amber-500";
      case "error":
        return "bg-red-500";
      default:
        return "bg-zinc-600";
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
        className="fixed inset-0 bg-black/50 z-40 md:hidden"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`
          w-60 bg-zinc-900 border-l border-zinc-800 flex flex-col
          md:relative md:border-l
          fixed inset-y-0 right-0 z-50 md:z-auto
        `}
      >
        {/* Online Users Header */}
        <div className="border-b border-zinc-800">
          <button
            onClick={() => setOnlineUsersExpanded(!onlineUsersExpanded)}
            className="w-full h-12 px-4 flex items-center justify-between hover:bg-zinc-800/50 transition-colors"
          >
            <h3 className="text-zinc-400 text-sm font-semibold uppercase tracking-wide">
              Online — {onlineUsers.length}
            </h3>
            <svg
              className={`w-4 h-4 text-zinc-400 transition-transform ${
                onlineUsersExpanded ? "rotate-180" : ""
              }`}
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
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {onlineUsers.length === 0 ? (
              <p className="text-zinc-600 text-sm italic">No one here yet...</p>
            ) : (
              onlineUsers.map((user) => {
                const isCurrentUser = currentUser?.id === user.id;
                const isRoomOwner = roomOwnerId != null && user.id === roomOwnerId;
                return (
                  <div key={user.id} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-amber-500 font-cinzel text-xs border border-zinc-700">
                      {getUserInitials(user.username)}
                    </div>
                    <span
                      className={`text-sm truncate flex items-center gap-1.5 min-w-0 flex-1 ${isCurrentUser ? "text-amber-500 font-semibold" : "text-zinc-300 font-medium"}`}
                    >
                      {user.username}
                      {isRoomOwner && (
                        <span title="Room owner">
                          <Crown
                            className="w-3.5 h-3.5 text-amber-500 shrink-0"
                            aria-hidden
                          />
                        </span>
                      )}
                    </span>
                    <div
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        isCurrentUser ? getConnectionStatusColor() : "bg-emerald-500"
                      }`}
                      title={isCurrentUser ? getConnectionStatusText() : "Online"}
                    />
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

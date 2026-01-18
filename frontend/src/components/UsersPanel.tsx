import { useState } from "react";
import type { User } from "../types";

interface OnlineUser {
  id: number;
  username: string;
}

interface UsersPanelProps {
  // Panel visibility
  isOpen: boolean;
  onClose: () => void; // For mobile backdrop click

  // User data
  currentUser: User | null;
  onlineUsers: OnlineUser[];

  // Actions
  onLogout: () => void;
}

/**
 * UsersPanel Component
 *
 * Responsibility: Right panel showing current user and online users
 * - Displays current user with dropdown menu
 * - Shows list of online users (collapsible)
 * - Mobile: overlays with backdrop
 * - Desktop: static sidebar
 *
 * Internal State:
 * - showUserMenu: controls dropdown visibility
 * - onlineUsersExpanded: controls online users list collapse
 *
 *
 */
export default function UsersPanel({
  isOpen,
  onClose,
  currentUser,
  onlineUsers,
  onLogout,
}: UsersPanelProps) {
  // Internal UI state - only affects this component
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [onlineUsersExpanded, setOnlineUsersExpanded] = useState(true);

  // Helper to get user initials for avatar
  const getUserInitials = (username: string) => {
    return username.substring(0, 2).toUpperCase();
  };

  const handleLogout = () => {
    setShowUserMenu(false);
    onLogout();
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
        {/* Current User Section */}
        <div className="h-14 border-b border-zinc-800 flex items-center px-4">
          <div className="relative w-full">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-full flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                {/* User avatar */}
                <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-amber-500 font-cinzel text-xs border border-zinc-700">
                  {currentUser ? getUserInitials(currentUser.username) : "US"}
                </div>
                {/* Username */}
                <span className="text-zinc-300 text-sm font-medium truncate">
                  {currentUser?.username || "Username"}
                </span>
              </div>
              {/* Dropdown arrow */}
              <svg
                className={`w-4 h-4 text-zinc-400 group-hover:text-amber-500 transition-all ${
                  showUserMenu ? "rotate-180" : ""
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

            {/* Dropdown Menu */}
            {showUserMenu && (
              <>
                {/* Backdrop to close menu */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowUserMenu(false)}
                />
                {/* Menu content */}
                <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-800 rounded-lg shadow-lg border border-zinc-700 py-1 z-20">
                  <button
                    onClick={handleLogout}
                    className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-zinc-700 transition-colors flex items-center gap-2"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                      />
                    </svg>
                    Logout
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

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
              onlineUsers.map((user) => (
                <div key={user.id} className="flex items-center gap-3">
                  {/* User avatar */}
                  <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-amber-500 font-cinzel text-xs border border-zinc-700">
                    {getUserInitials(user.username)}
                  </div>
                  {/* Username */}
                  <span className="text-zinc-300 text-sm font-medium truncate">
                    {user.username}
                  </span>
                  {/* Online indicator */}
                  <div className="w-2 h-2 rounded-full bg-emerald-500 ml-auto"></div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </>
  );
}

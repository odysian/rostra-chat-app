import { useState, useEffect } from "react";
import RoomList from "./RoomList";
import MessageArea from "./MessageArea";
import { useWebSocket } from "../hooks/useWebSocket";
import type { Room } from "../types";
import { useAuth } from "../context/AuthContext";

interface OnlineUser {
  id: number;
  username: string;
}

export default function ChatLayout() {
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [usersPanelOpen, setUsersPanelOpen] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [onlineUsersExpanded, setOnlineUsersExpanded] = useState(true);
  const [mobileView, setMobileView] = useState<"rooms" | "chat">("rooms");

  const { connected, lastMessage, subscribe, unsubscribe } = useWebSocket();

  const { user, logout } = useAuth();

  const handleLogout = () => {
    if (selectedRoom) {
      unsubscribe(selectedRoom.id);
    }

    setSelectedRoom(null);
    setOnlineUsers([]);
    setShowUserMenu(false);

    logout();
  };

  const handleSelectRoom = (room: Room) => {
    setSelectedRoom(room);
    setMobileView("chat");
  };

  const handleBackToRooms = () => {
    setMobileView("rooms");
  };

  const handleRoomDeleted = () => {
    setSelectedRoom(null);
    setOnlineUsers([]);
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleLeaveRoom = () => {
    if (selectedRoom) {
      unsubscribe(selectedRoom.id);
    }
    setSelectedRoom(null);
    setOnlineUsers([]);
  };

  useEffect(() => {
    if (selectedRoom && connected) {
      subscribe(selectedRoom.id);
      return () => {
        setOnlineUsers([]);
        unsubscribe(selectedRoom.id);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoom, connected]);

  useEffect(() => {
    if (!lastMessage || !selectedRoom) return;

    const msgRoomId =
      lastMessage.type === "new_message"
        ? lastMessage.message.room_id
        : "room_id" in lastMessage
          ? lastMessage.room_id
          : null;

    if (msgRoomId !== selectedRoom.id) return;

    switch (lastMessage.type) {
      case "subscribed":
        setOnlineUsers(lastMessage.online_users);
        break;
      case "user_joined":
        setOnlineUsers((prev) => {
          const exists = prev.some((u) => u.id === lastMessage.user.id);
          return exists ? prev : [...prev, lastMessage.user];
        });
        break;
      case "user_left":
        setOnlineUsers((prev) =>
          prev.filter((u) => u.id !== lastMessage.user.id),
        );
        break;
    }
  }, [lastMessage, selectedRoom]);

  return (
    <div className="flex h-screen bg-zinc-950">
      {/* Sidebar - Hide on mobile when in chat view */}
      <div
        className={`
        ${sidebarOpen ? "w-64" : "w-16"}
        bg-zinc-900 border-r border-zinc-800 flex-col transition-all duration-300
        ${mobileView === "rooms" ? "flex" : "hidden md:flex"}
      `}
      >
        <div className="h-14 border-b border-zinc-800 flex items-center px-4">
          {sidebarOpen ? (
            <button
              onClick={() => setSidebarOpen(false)}
              className="w-full flex items-center justify-between group"
              title="Collapse sidebar"
            >
              <h1 className="text-2xl font-cinzel font-bold text-amber-500 tracking-wide">
                ROSTRA
              </h1>
              <svg
                className="w-5 h-5 text-zinc-400 group-hover:text-amber-500 transition-colors"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 19l-7-7 7-7"
                />
              </svg>
            </button>
          ) : (
            <button
              onClick={() => setSidebarOpen(true)}
              className="w-full flex justify-center hover:scale-110 transition-transform"
              title="Expand sidebar"
            >
              <span className="text-3xl font-cinzel font-bold text-amber-500">
                R
              </span>
            </button>
          )}
        </div>

        <RoomList
          selectedRoom={selectedRoom}
          onSelectRoom={handleSelectRoom}
          sidebarOpen={sidebarOpen}
          refreshTrigger={refreshTrigger}
        />
      </div>

      {/* Main Area - Show on mobile when chat view, always show on desktop */}
      <div
        className={`
      flex-1 flex-col
      ${mobileView === "chat" ? "flex" : "hidden md:flex"}
    `}
      >
        <MessageArea
          selectedRoom={selectedRoom}
          lastMessage={lastMessage}
          // sidebarOpen={sidebarOpen}
          onToggleUsers={() => setUsersPanelOpen(!usersPanelOpen)}
          onRoomDeleted={handleRoomDeleted}
          onLeaveRoom={handleLeaveRoom}
          onBackToRooms={handleBackToRooms}
          isMobile={true}
        />
      </div>

      {/* Users Panel - Overlay on mobile, sidebar on desktop */}
      {usersPanelOpen && (
        <div
          className={`
          w-60 bg-zinc-900 border-l border-zinc-800 flex flex-col
          md:relative md:border-l
          fixed inset-y-0 right-0 z-50 md:z-auto
        `}
        >
          {/* Backdrop for mobile - click to close */}
          <div
            className="fixed inset-0 bg-black/50 -z-10 md:hidden"
            onClick={() => setUsersPanelOpen(false)}
          />

          {/* Current User Section */}
          <div className="h-14 border-b border-zinc-800 flex items-center px-4">
            <div className="relative w-full">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="w-full flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-amber-500 font-cinzel text-xs border border-zinc-700">
                    {user?.username.substring(0, 2).toUpperCase() || "US"}
                  </div>
                  <span className="text-zinc-300 text-sm font-medium truncate">
                    {user?.username || "Username"}
                  </span>
                </div>
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

              {showUserMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowUserMenu(false)}
                  />
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

          {/* Online Users Section */}
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

          {onlineUsersExpanded && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {onlineUsers.length === 0 ? (
                <p className="text-zinc-600 text-sm italic">
                  No one here yet...
                </p>
              ) : (
                onlineUsers.map((user) => (
                  <div key={user.id} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-amber-500 font-cinzel text-xs border border-zinc-700">
                      {user.username.substring(0, 2).toUpperCase()}
                    </div>
                    <span className="text-zinc-300 text-sm font-medium truncate">
                      {user.username}
                    </span>
                    <div className="w-2 h-2 rounded-full bg-emerald-500 ml-auto"></div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

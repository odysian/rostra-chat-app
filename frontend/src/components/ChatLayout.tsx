import { useState, useEffect } from "react";
import RoomList from "./RoomList";
import MessageArea from "./MessageArea";
import { useWebSocket } from "../hooks/useWebSocket";
import type { Room } from "../types";

// Define a simplified user type for the UI list
interface OnlineUser {
  id: number;
  username: string;
}

export default function ChatLayout() {
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  // UI State
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [usersPanelOpen, setUsersPanelOpen] = useState(true);

  // Data State
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  const { connected, lastMessage, subscribe, unsubscribe } = useWebSocket();

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
          prev.filter((u) => u.id !== lastMessage.user.id)
        );
        break;
    }
  }, [lastMessage, selectedRoom]);

  return (
    <div className="flex h-screen bg-zinc-950">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? "w-64" : "w-16"
        } bg-zinc-900 border-r border-zinc-800 flex flex-col transition-all duration-300`}
      >
        <div className="p-4 border-b border-zinc-800 flex items-center justify-center">
          {sidebarOpen ? (
            <h1 className="text-2xl font-cinzel font-bold text-amber-500 tracking-wide">
              ROSTRA
            </h1>
          ) : (
            <span className="text-3xl font-cinzel font-bold text-amber-500">
              R
            </span>
          )}
        </div>
        <RoomList
          selectedRoom={selectedRoom}
          onSelectRoom={setSelectedRoom}
          sidebarOpen={sidebarOpen}
        />
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col">
        <MessageArea
          selectedRoom={selectedRoom}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onToggleUsers={() => setUsersPanelOpen(!usersPanelOpen)}
        />
      </div>

      {/* Users Panel */}
      {usersPanelOpen && (
        <div className="w-60 bg-zinc-900 border-l border-zinc-800 flex flex-col">
          <div className="p-4 border-b border-zinc-800">
            <h3 className="text-zinc-400 text-sm font-semibold">
              Online — {onlineUsers.length}
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {onlineUsers.length === 0 ? (
              <p className="text-zinc-600 text-sm italic">No one here yet...</p>
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
        </div>
      )}
    </div>
  );
}

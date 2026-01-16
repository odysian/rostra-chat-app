import { useState } from "react";
import RoomList from "./RoomList";
import MessageArea from "./MessageArea";
import type { Room } from "../types";

export default function ChatLayout() {
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [usersPanelOpen, setUsersPanelOpen] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState<
    Array<{ id: number; username: string }>
  >([]);

  return (
    <div className="flex h-screen bg-zinc-950">
      {/* Sidebar - will make collapsible next */}
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

      {/* Users Panel - will build this next */}
      {usersPanelOpen && (
        <div className="w-60 bg-zinc-900 border-l border-zinc-800 p-4">
          <h3 className="text-zinc-400 text-sm font-semibold mb-2">
            Online Users
          </h3>
          {/* User list will go here */}
        </div>
      )}
    </div>
  );
}

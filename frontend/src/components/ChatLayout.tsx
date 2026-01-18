import { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import MessageArea from "./MessageArea";
import UsersPanel from "./UsersPanel";
import { useWebSocket } from "../hooks/useWebSocket";
import { useAuth } from "../context/AuthContext";
import type { Room } from "../types";

interface OnlineUser {
  id: number;
  username: string;
}

/**
 * ChatLayout Component
 *
 * Responsibility: Orchestrate the chat interface
 * - Manage all shared state (selected room, online users, mobile view)
 * - Handle WebSocket connection lifecycle
 * - Coordinate between Sidebar, MessageArea, and UsersPanel
 *
 * This component should NOT contain complex UI - just coordinate children
 */
export default function ChatLayout() {
  // STATE
  // Room state
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Panel visibility
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [usersPanelOpen, setUsersPanelOpen] = useState(true);

  // Mobile navigation
  const [mobileView, setMobileView] = useState<"rooms" | "chat">("rooms");

  // Online users (from WebSocket)
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  // HOOKS
  const { connected, lastMessage, subscribe, unsubscribe } = useWebSocket();
  const { user, logout } = useAuth();

  // HANDLERS
  const handleSelectRoom = (room: Room) => {
    setSelectedRoom(room);
    setMobileView("chat"); // Switch to chat view on mobile
  };

  const handleBackToRooms = () => {
    setMobileView("rooms"); // Back to room list on mobile
  };

  const handleRoomDeleted = () => {
    setSelectedRoom(null);
    setOnlineUsers([]);
    setRefreshTrigger((prev) => prev + 1); // Force room list refresh
  };

  const handleLeaveRoom = () => {
    if (selectedRoom) {
      unsubscribe(selectedRoom.id);
    }
    setSelectedRoom(null);
    setOnlineUsers([]);
  };

  const handleLogout = () => {
    // Cleanup before logout
    if (selectedRoom) {
      unsubscribe(selectedRoom.id);
    }
    setSelectedRoom(null);
    setOnlineUsers([]);
    logout();
  };

  // EFFECTS
  // Subscribe to room when selected
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

  // Handle WebSocket messages - update online users
  useEffect(() => {
    if (!lastMessage || !selectedRoom) return;

    // Get room ID from message
    const msgRoomId =
      lastMessage.type === "new_message"
        ? lastMessage.message.room_id
        : "room_id" in lastMessage
          ? lastMessage.room_id
          : null;

    // Ignore messages from other rooms
    if (msgRoomId !== selectedRoom.id) return;

    // Update online users based on message type
    switch (lastMessage.type) {
      case "subscribed":
        setOnlineUsers(lastMessage.online_users);
        break;

      case "user_joined":
        setOnlineUsers((prev) => {
          // Avoid duplicates
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

  // RENDER
  return (
    <div className="flex h-screen bg-zinc-950">
      {/* Left panel - Room list */}
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        selectedRoom={selectedRoom}
        onSelectRoom={handleSelectRoom}
        refreshTrigger={refreshTrigger}
        visible={mobileView === "rooms"}
      />

      {/* Center panel - Messages */}
      <div
        className={`
          flex-1 flex-col
          ${mobileView === "chat" ? "flex" : "hidden md:flex"}
        `}
      >
        <MessageArea
          selectedRoom={selectedRoom}
          lastMessage={lastMessage}
          onToggleUsers={() => setUsersPanelOpen(!usersPanelOpen)}
          onRoomDeleted={handleRoomDeleted}
          onLeaveRoom={handleLeaveRoom}
          onBackToRooms={handleBackToRooms}
          isMobile={true}
        />
      </div>

      {/* Right panel - Online users */}
      <UsersPanel
        isOpen={usersPanelOpen}
        onClose={() => setUsersPanelOpen(false)}
        currentUser={user}
        onlineUsers={onlineUsers}
        onLogout={handleLogout}
      />
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import Sidebar from "./Sidebar";
import MessageArea from "./MessageArea";
import UsersPanel from "./UsersPanel";
import { useWebSocketContext } from "../context/useWebSocketContext";
import { type WebSocketMessage } from "../context/WebSocketContext";
import { useAuth } from "../context/AuthContext";
import { markRoomRead } from "../services/api";
import type { Message, Room } from "../types";

const MAX_SUBSCRIPTIONS = 10;
const INITIAL_AUTO_SUBSCRIBE_COUNT = 5;

interface OnlineUser {
  id: number;
  username: string;
}

/**
 * ChatLayout Component
 *
 * Responsibility: Orchestrate the chat interface
 * - Manage all shared state (selected room, online users, panel visibility, unread counts)
 * - Multi-room WebSocket subscriptions (up to MAX_SUBSCRIPTIONS, LRU eviction)
 * - Coordinate between Sidebar, MessageArea, and UsersPanel
 */
export default function ChatLayout() {
  // ============================================================================
  // STATE
  // ============================================================================

  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [usersPanelOpen, setUsersPanelOpen] = useState(false);
  /** Online users per room; updated from subscribed / user_joined / user_left (so we have data even before a room is selected) */
  const [onlineUsersByRoom, setOnlineUsersByRoom] = useState<Record<number, OnlineUser[]>>({});
  /** Derived: online users for the currently selected room (for sidebar) */
  const onlineUsers = selectedRoom ? (onlineUsersByRoom[selectedRoom.id] ?? []) : [];

  /** Room IDs we're subscribed to (order = LRU for eviction) */
  const [subscribedRoomIds, setSubscribedRoomIds] = useState<number[]>([]);
  /** Unread count per room (updated from API + WebSocket) */
  const [unreadCounts, setUnreadCounts] = useState<Record<number, number>>({});
  /** New messages for the selected room delivered via WebSocket (each processed then cleared so none are dropped) */
  const [incomingMessagesForRoom, setIncomingMessagesForRoom] = useState<Message[]>([]);

  const selectedRoomRef = useRef<Room | null>(null);
  const subscribedRoomIdsRef = useRef<number[]>([]);
  const hasInitialSubscriptionsDoneRef = useRef(false);
  const tokenRef = useRef<string | null>(null);
  useEffect(() => {
    selectedRoomRef.current = selectedRoom;
    subscribedRoomIdsRef.current = subscribedRoomIds;
  });

  // ============================================================================
  // HOOKS
  // ============================================================================

  const {
    connected,
    subscribe,
    unsubscribe,
    registerMessageHandler,
  } = useWebSocketContext();
  const { user, logout, token } = useAuth();
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    const handleMessage = (msg: WebSocketMessage) => {
      const msgRoomId =
        msg.type === "new_message"
          ? msg.message.room_id
          : "room_id" in msg
            ? msg.room_id
            : null;

      if (msg.type === "new_message" && msgRoomId != null) {
        if (msgRoomId === selectedRoomRef.current?.id) {
          setIncomingMessagesForRoom((prev) => [...prev, msg.message]);
          const t = tokenRef.current;
          if (t) {
            markRoomRead(msgRoomId, t).catch(() => {});
          }
        } else if (subscribedRoomIdsRef.current.includes(msgRoomId)) {
          setUnreadCounts((prev) => ({
            ...prev,
            [msgRoomId]: (prev[msgRoomId] ?? 0) + 1,
          }));
        }
        return;
      }

      if (msgRoomId == null) return;

      switch (msg.type) {
        case "subscribed":
          setOnlineUsersByRoom((prev) => ({
            ...prev,
            [msgRoomId]: msg.online_users,
          }));
          break;
        case "user_joined":
          setOnlineUsersByRoom((prev) => {
            const list = prev[msgRoomId] ?? [];
            const exists = list.some((u) => u.id === msg.user.id);
            return {
              ...prev,
              [msgRoomId]: exists ? list : [...list, msg.user],
            };
          });
          break;
        case "user_left":
          setOnlineUsersByRoom((prev) => ({
            ...prev,
            [msgRoomId]: (prev[msgRoomId] ?? []).filter((u) => u.id !== msg.user.id),
          }));
          break;
      }
    };
    registerMessageHandler(handleMessage);
    return () => registerMessageHandler(undefined);
  }, [registerMessageHandler]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleSelectRoom = async (room: Room) => {
    setSelectedRoom(room);
    setIncomingMessagesForRoom([]);
    setSidebarOpen(false);

    if (token) {
      try {
        await markRoomRead(room.id, token);
      } catch {
        // Non-blocking; unread will sync on next load
      }
    }
    setUnreadCounts((prev) => ({ ...prev, [room.id]: 0 }));

    setSubscribedRoomIds((prev) => {
      if (prev.includes(room.id)) return prev;
      let next = [...prev, room.id];
      if (next.length > MAX_SUBSCRIPTIONS) {
        const [evict] = next;
        unsubscribe(evict);
        next = next.slice(1);
      }
      return next;
    });
  };

  const handleBackToRooms = () => {
    setSidebarOpen(true);
  };

  const handleRoomDeleted = () => {
    const deletedRoomId = selectedRoom?.id;
    if (deletedRoomId == null) return;
    setSubscribedRoomIds((prev) => prev.filter((id) => id !== deletedRoomId));
    unsubscribe(deletedRoomId);
    setSelectedRoom(null);
    setIncomingMessagesForRoom([]);
    setOnlineUsersByRoom((prev) => {
      const next = { ...prev };
      delete next[deletedRoomId];
      return next;
    });
    setUnreadCounts((prev) => {
      const next = { ...prev };
      delete next[deletedRoomId];
      return next;
    });
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleLeaveRoom = () => {
    if (selectedRoom) {
      unsubscribe(selectedRoom.id);
      setSubscribedRoomIds((prev) => prev.filter((id) => id !== selectedRoom.id));
    }
    setSelectedRoom(null);
    setIncomingMessagesForRoom([]);
  };

  const handleLogout = () => {
    subscribedRoomIds.forEach((id) => unsubscribe(id));
    setSubscribedRoomIds([]);
    setSelectedRoom(null);
    setOnlineUsersByRoom({});
    setUnreadCounts({});
    logout(true);
  };

  const handleUnreadCountsLoaded = (counts: Record<number, number>) => {
    setUnreadCounts((prev) => ({ ...prev, ...counts }));
  };

  /** Called once when room list first loads; auto-subscribe to first N rooms for real-time unread. */
  const handleInitialRoomsLoaded = (rooms: Room[]) => {
    if (hasInitialSubscriptionsDoneRef.current || rooms.length === 0) return;
    hasInitialSubscriptionsDoneRef.current = true;
    const firstIds = rooms.slice(0, INITIAL_AUTO_SUBSCRIBE_COUNT).map((r) => r.id);
    setSubscribedRoomIds(firstIds);
  };

  const handleIncomingMessagesProcessed = () => {
    setIncomingMessagesForRoom([]);
  };

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Subscribe to all rooms in subscribedRoomIds when connected
  useEffect(() => {
    if (connected && subscribedRoomIds.length > 0) {
      subscribedRoomIds.forEach((id) => subscribe(id));
    }
  }, [connected, subscribedRoomIds, subscribe]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="flex h-screen bg-zinc-950">
      {/* Left panel - Room list */}
      <Sidebar
        isOpen={sidebarOpen || !selectedRoom}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        selectedRoom={selectedRoom}
        onSelectRoom={handleSelectRoom}
        refreshTrigger={refreshTrigger}
        unreadCounts={unreadCounts}
        onUnreadCountsLoaded={handleUnreadCountsLoaded}
        onInitialRoomsLoaded={handleInitialRoomsLoaded}
        visible={true}
      />

      {/* Center panel - Messages (always visible, sidebar overlays on mobile) */}
      <div className="flex-1 flex-col flex min-w-0">
        <MessageArea
          selectedRoom={selectedRoom}
          incomingMessages={incomingMessagesForRoom}
          onIncomingMessagesProcessed={handleIncomingMessagesProcessed}
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

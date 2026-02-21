import { useState, useEffect, useRef } from "react";
import Sidebar from "./Sidebar";
import MessageArea from "./MessageArea";
import UsersPanel from "./UsersPanel";
import SearchPanel from "./SearchPanel";
import { useWebSocketContext } from "../context/useWebSocketContext";
import { type WebSocketMessage } from "../context/WebSocketContext";
import { useAuth } from "../context/AuthContext";
import { markRoomRead, leaveRoom } from "../services/api";
import type { Message, OnlineUser, Room } from "../types";

const MAX_SUBSCRIPTIONS = 10;
const INITIAL_AUTO_SUBSCRIBE_COUNT = 5;

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
  const [rightPanel, setRightPanel] = useState<"none" | "users" | "search">("none");
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
  /** Error message when leave room fails (e.g. creator cannot leave) */
  const [leaveError, setLeaveError] = useState<string | null>(null);
  /** Ephemeral WS error message (e.g. rate limit), auto-clears after a few seconds */
  const [wsError, setWsError] = useState<string | null>(null);
  /** Typing users per room: roomId → userId → {username, timeout} */
  const [typingUsersByRoom, setTypingUsersByRoom] = useState<
    Record<number, Record<number, { username: string; timeout: ReturnType<typeof setTimeout> }>>
  >({});

  const selectedRoomRef = useRef<Room | null>(null);
  const subscribedRoomIdsRef = useRef<number[]>([]);
  /** Room IDs we've already sent subscribe for (avoids re-subscribing when effect re-runs or list grows) */
  const subscribedSentRef = useRef<Set<number>>(new Set());
  /** Tracks prior WS connection state so we can detect reconnect transitions. */
  const prevConnectedRef = useRef(false);
  /** Distinguish first-ever connect from later reconnects. */
  const hasConnectedOnceRef = useRef(false);
  const hasInitialSubscriptionsDoneRef = useRef(false);
  const tokenRef = useRef<string | null>(null);
  /** Track all active typing timeouts for cleanup on unmount */
  const typingTimeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
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
      // Show WS errors (e.g. rate limit) as an ephemeral banner that auto-clears
      if (msg.type === "error") {
        setWsError(msg.message);
        setTimeout(() => setWsError(null), 4000);
        return;
      }

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

        // Clear typing indicator for the sender (they finished composing)
        setTypingUsersByRoom((prev) => {
          const roomTyping = prev[msgRoomId];
          if (!roomTyping || !roomTyping[msg.message.user_id]) return prev;
          clearTimeout(roomTyping[msg.message.user_id].timeout);
          typingTimeoutsRef.current.delete(roomTyping[msg.message.user_id].timeout);
          const updated = { ...roomTyping };
          delete updated[msg.message.user_id];
          return { ...prev, [msgRoomId]: updated };
        });

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
        case "typing_indicator":
          {
            const { room_id, user } = msg;

            setTypingUsersByRoom((prev) => {
              // Clone the relevant room's typing map (or start fresh)
              const roomTyping = { ...(prev[room_id] ?? {}) };

              // Clear existing timeout for this user (they're still typing)
              if (roomTyping[user.id]) {
                clearTimeout(roomTyping[user.id].timeout);
                typingTimeoutsRef.current.delete(roomTyping[user.id].timeout);
              }

              // Set a 3s auto-clear timeout
              const timeout = setTimeout(() => {
                setTypingUsersByRoom((current) => {
                  const updated = { ...(current[room_id] ?? {}) };
                  delete updated[user.id];
                  return { ...current, [room_id]: updated };
                });
                typingTimeoutsRef.current.delete(timeout);
              }, 3000);

              // Track timeout for cleanup
              typingTimeoutsRef.current.add(timeout);

              roomTyping[user.id] = { username: user.username, timeout };
              return { ...prev, [room_id]: roomTyping };
            });
          }
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
    setLeaveError(null);
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

  const handleLeaveRoom = async () => {
    if (!selectedRoom || !token) {
      setSelectedRoom(null);
      setIncomingMessagesForRoom([]);
      return;
    }

    const roomId = selectedRoom.id;
    setLeaveError(null);

    try {
      await leaveRoom(roomId, token);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to leave room";
      setLeaveError(
        message.includes("creator") || message.includes("cannot leave")
          ? message
          : "Failed to leave room. Please try again."
      );
      // Still clear selection and unsubscribe so the user isn't stuck
    }

    // Unsubscribe from WebSocket and remove from local subscription list
    unsubscribe(roomId);
    setSubscribedRoomIds((prev) => prev.filter((id) => id !== roomId));
    setSelectedRoom(null);
    setIncomingMessagesForRoom([]);
    setOnlineUsersByRoom((prev) => {
      const next = { ...prev };
      delete next[roomId];
      return next;
    });
    setUnreadCounts((prev) => {
      const next = { ...prev };
      delete next[roomId];
      return next;
    });
    // Refresh room list so the left room disappears from the sidebar
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleLogout = () => {
    subscribedRoomIds.forEach((id) => unsubscribe(id));
    subscribedSentRef.current.clear();
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

  // Subscribe only to rooms we haven't sent subscribe for yet (avoids duplicate subscribe on re-run or when list grows)
  useEffect(() => {
    let refreshTimeoutId: number | undefined;

    // Server subscription state is reset on reconnect; clear local sent-cache so rooms are re-subscribed.
    if (!prevConnectedRef.current && connected) {
      subscribedSentRef.current.clear();
      // Pull fresh unread counts after reconnect because messages may have arrived while disconnected.
      if (hasConnectedOnceRef.current) {
        refreshTimeoutId = window.setTimeout(() => {
          setRefreshTrigger((prev) => prev + 1);
        }, 0);
      }
      hasConnectedOnceRef.current = true;
    }
    prevConnectedRef.current = connected;

    return () => {
      if (refreshTimeoutId) {
        clearTimeout(refreshTimeoutId);
      }
    };
  }, [connected]);

  useEffect(() => {
    if (!connected || subscribedRoomIds.length === 0) return;

    subscribedRoomIds.forEach((id) => {
      if (!subscribedSentRef.current.has(id)) {
        subscribe(id);
        subscribedSentRef.current.add(id);
      }
    });

    // Drop ref entries for rooms no longer in the list (unsubscribed elsewhere)
    const idSet = new Set(subscribedRoomIds);
    subscribedSentRef.current.forEach((id) => {
      if (!idSet.has(id)) subscribedSentRef.current.delete(id);
    });
  }, [connected, subscribedRoomIds, subscribe]);

  // Clean up all typing timeouts on unmount
  useEffect(() => {
    // Copy ref to local variable to satisfy eslint exhaustive-deps
    const timeouts = typingTimeoutsRef.current;
    return () => {
      timeouts.forEach(clearTimeout);
      timeouts.clear();
    };
  }, []);

  // ============================================================================
  // RENDER
  // ============================================================================

  // Derive typing usernames for the selected room
  const typingUsernames = selectedRoom
    ? Object.values(typingUsersByRoom[selectedRoom.id] ?? {}).map((t) => t.username)
    : [];

  return (
    <div className="flex h-dvh" style={{ background: "var(--bg-app)" }}>
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
        onLogout={handleLogout}
        visible={true}
      />

      {/* Center panel - Messages (always visible, sidebar overlays on mobile). min-w-0 + overflow-hidden prevent layout break on narrow screens. */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {leaveError && (
          <div
            className="shrink-0 px-4 py-2 font-mono text-[12px] flex items-center justify-between gap-2"
            style={{
              background: "rgba(255, 68, 68, 0.08)",
              borderBottom: "1px solid rgba(255, 68, 68, 0.2)",
              color: "#ff4444",
            }}
          >
            <span>{leaveError}</span>
            <button
              type="button"
              onClick={() => setLeaveError(null)}
              style={{ color: "#ff4444" }}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}
        <MessageArea
          selectedRoom={selectedRoom}
          incomingMessages={incomingMessagesForRoom}
          onIncomingMessagesProcessed={handleIncomingMessagesProcessed}
          onToggleUsers={() => setRightPanel((prev) => prev === "users" ? "none" : "users")}
          onToggleSearch={() => setRightPanel((prev) => prev === "search" ? "none" : "search")}
          onRoomDeleted={handleRoomDeleted}
          onLeaveRoom={handleLeaveRoom}
          onBackToRooms={handleBackToRooms}
          typingUsernames={typingUsernames}
          wsError={wsError}
          onDismissWsError={() => setWsError(null)}
        />
      </div>

      {/* Right panel - Online users (mutually exclusive with search) */}
      <UsersPanel
        isOpen={rightPanel === "users"}
        onClose={() => setRightPanel("none")}
        currentUser={user}
        onlineUsers={onlineUsers}
        roomOwnerId={selectedRoom?.created_by ?? null}
      />

      {/* Right panel - Search (mutually exclusive with users) */}
      {selectedRoom && token && (
        <SearchPanel
          isOpen={rightPanel === "search"}
          onClose={() => setRightPanel("none")}
          roomId={selectedRoom.id}
          token={token}
        />
      )}
    </div>
  );
}

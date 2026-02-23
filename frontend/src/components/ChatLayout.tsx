import { useState, useEffect, useRef } from "react";
import Sidebar from "./Sidebar";
import MessageArea from "./MessageArea";
import UsersPanel from "./UsersPanel";
import SearchPanel from "./SearchPanel";
import { useWebSocketContext } from "../context/useWebSocketContext";
import { useAuth } from "../context/AuthContext";
import { markRoomRead, leaveRoom } from "../services/api";
import { formatRoomNameForDisplay } from "../utils/roomNames";
import { useChatLayoutMessageHandler } from "../hooks/useChatLayoutMessageHandler";
import { useChatLayoutSubscriptions } from "../hooks/useChatLayoutSubscriptions";
import {
  clearRoomScopedState,
  resetSelectedRoomState,
} from "./chat-layout/chatLayoutRoomState";
import type { Message, MessageContextResponse, OnlineUser, Room } from "../types";

const MAX_SUBSCRIPTIONS = 10;
const INITIAL_AUTO_SUBSCRIBE_COUNT = 5;
type UiDensity = "compact" | "comfortable";
type MessageViewMode = "normal" | "context";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest("input, textarea, select, [contenteditable='true']"),
  );
}

function parseIsoTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function getFreshestReadMarker(
  cachedMarker: string | null | undefined,
  serverMarker: string | null | undefined,
): string | null {
  const cachedTs = parseIsoTimestamp(cachedMarker);
  const serverTs = parseIsoTimestamp(serverMarker);

  if (cachedTs == null && serverTs == null) return null;
  if (cachedTs == null) return serverMarker ?? null;
  if (serverTs == null) return cachedMarker ?? null;

  // Prefer server marker on ties so multi-tab/device updates win over stale local cache.
  return serverTs >= cachedTs ? (serverMarker ?? null) : (cachedMarker ?? null);
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
  const [rightPanel, setRightPanel] = useState<"none" | "users" | "search">("none");
  /** Online users per room; updated from subscribed / user_joined / user_left (so we have data even before a room is selected) */
  const [onlineUsersByRoom, setOnlineUsersByRoom] = useState<Record<number, OnlineUser[]>>({});
  /** Derived: online users for the currently selected room (for sidebar) */
  const onlineUsers = selectedRoom ? (onlineUsersByRoom[selectedRoom.id] ?? []) : [];

  /** Room IDs we're subscribed to (order = LRU for eviction) */
  const [subscribedRoomIds, setSubscribedRoomIds] = useState<number[]>([]);
  /** Unread count per room (updated from API + WebSocket) */
  const [unreadCounts, setUnreadCounts] = useState<Record<number, number>>({});
  /** Latest known read marker per room from successful mark-read responses. */
  const [lastReadAtByRoomId, setLastReadAtByRoomId] = useState<Record<number, string | null>>({});
  /** New messages for the selected room delivered via WebSocket (each processed then cleared so none are dropped) */
  const [incomingMessagesForRoom, setIncomingMessagesForRoom] = useState<Message[]>([]);
  /** Snapshot of selected room's last_read_at at room-open time (used for stable new-message divider placement). */
  const [roomOpenLastReadSnapshot, setRoomOpenLastReadSnapshot] = useState<string | null>(null);
  /** Error message when leave room fails (e.g. creator cannot leave) */
  const [leaveError, setLeaveError] = useState<string | null>(null);
  /** Ephemeral WS error message (e.g. rate limit), auto-clears after a few seconds */
  const [wsError, setWsError] = useState<string | null>(null);
  const [density, setDensity] = useState<UiDensity>(() => {
    const stored = localStorage.getItem("rostra-density");
    return stored === "comfortable" ? "comfortable" : "compact";
  });
  const [searchFocusSignal, setSearchFocusSignal] = useState(0);
  const [openCommandPaletteSignal, setOpenCommandPaletteSignal] = useState(0);
  const [closeCommandPaletteSignal, setCloseCommandPaletteSignal] = useState(0);
  /** Typing users per room: roomId → userId → {username, timeout} */
  const [typingUsersByRoom, setTypingUsersByRoom] = useState<
    Record<number, Record<number, { username: string; timeout: ReturnType<typeof setTimeout> }>>
  >({});
  const [messageViewMode, setMessageViewMode] = useState<MessageViewMode>("normal");
  const [messageContext, setMessageContext] = useState<MessageContextResponse | null>(null);

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
    localStorage.setItem("rostra-density", density);
  }, [density]);

  useEffect(() => {
    if (!selectedRoom) {
      document.title = "Rostra";
      return;
    }

    const roomName = formatRoomNameForDisplay(selectedRoom.name);
    document.title = `#${roomName} - Rostra`;
  }, [selectedRoom]);

  useEffect(() => {
    const handleGlobalShortcuts = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();
        setOpenCommandPaletteSignal((prev) => prev + 1);
        return;
      }

      if (isTypingTarget(event.target)) return;

      if (
        event.key === "/" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        selectedRoom
      ) {
        event.preventDefault();
        setRightPanel("search");
        setSearchFocusSignal((prev) => prev + 1);
        return;
      }

      if (event.key === "Escape") {
        setRightPanel("none");
        setCloseCommandPaletteSignal((prev) => prev + 1);
      }
    };

    window.addEventListener("keydown", handleGlobalShortcuts);
    return () => window.removeEventListener("keydown", handleGlobalShortcuts);
  }, [selectedRoom]);

  useChatLayoutMessageHandler({
    registerMessageHandler,
    selectedRoomRef,
    subscribedRoomIdsRef,
    tokenRef,
    typingTimeoutsRef,
    setIncomingMessagesForRoom,
    setUnreadCounts,
    setLastReadAtByRoomId,
    setOnlineUsersByRoom,
    setTypingUsersByRoom,
    setWsError,
  });

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const resetSelectionState = () => {
    resetSelectedRoomState({
      setSelectedRoom,
      setMessageViewMode,
      setMessageContext,
      setRoomOpenLastReadSnapshot,
      setIncomingMessagesForRoom,
    });
  };

  const cleanupRoomState = (roomId: number) => {
    clearRoomScopedState({
      roomId,
      setOnlineUsersByRoom,
      setLastReadAtByRoomId,
      setUnreadCounts,
      setTypingUsersByRoom,
    });
  };

  const unsubscribeRoom = (roomId: number) => {
    unsubscribe(roomId);
    setSubscribedRoomIds((prev) => prev.filter((id) => id !== roomId));
  };

  const handleSelectRoom = async (room: Room) => {
    setLeaveError(null);
    setSelectedRoom(room);
    setMessageViewMode("normal");
    setMessageContext(null);
    const hasCachedReadMarker = Object.prototype.hasOwnProperty.call(lastReadAtByRoomId, room.id);
    const cachedReadMarker = hasCachedReadMarker
      ? lastReadAtByRoomId[room.id]
      : undefined;
    setRoomOpenLastReadSnapshot(
      getFreshestReadMarker(cachedReadMarker, room.last_read_at ?? null),
    );
    setIncomingMessagesForRoom([]);
    setSidebarOpen(false);

    if (token) {
      try {
        const response = await markRoomRead(room.id, token);
        setLastReadAtByRoomId((prev) => ({
          ...prev,
          [room.id]: response.last_read_at,
        }));
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
    unsubscribeRoom(deletedRoomId);
    resetSelectionState();
    cleanupRoomState(deletedRoomId);
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleLeaveRoom = async () => {
    if (!selectedRoom || !token) {
      resetSelectionState();
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

    unsubscribeRoom(roomId);
    resetSelectionState();
    cleanupRoomState(roomId);
    // Refresh room list so the left room disappears from the sidebar
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleLogout = () => {
    subscribedRoomIds.forEach((id) => unsubscribe(id));
    subscribedSentRef.current.clear();
    setSubscribedRoomIds([]);
    setSelectedRoom(null);
    setMessageViewMode("normal");
    setMessageContext(null);
    setRoomOpenLastReadSnapshot(null);
    setOnlineUsersByRoom({});
    setLastReadAtByRoomId({});
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

  const handleOpenMessageContext = (context: MessageContextResponse) => {
    setMessageContext(context);
    setMessageViewMode("context");
  };

  const handleExitContextMode = () => {
    setMessageViewMode("normal");
    setMessageContext(null);
  };

  // ============================================================================
  // EFFECTS
  // ============================================================================

  useChatLayoutSubscriptions({
    connected,
    subscribedRoomIds,
    subscribe,
    setRefreshTrigger,
    subscribedSentRef,
    prevConnectedRef,
    hasConnectedOnceRef,
  });

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
  const hasOtherUnreadRooms = Object.entries(unreadCounts).some(
    ([roomId, unreadCount]) =>
      unreadCount > 0 && Number(roomId) !== selectedRoom?.id,
  );

  return (
    <div className="flex h-dvh" style={{ background: "var(--bg-app)" }}>
      {/* Left panel - Room list */}
      <Sidebar
        isOpen={sidebarOpen || !selectedRoom}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        density={density}
        openCommandPaletteSignal={openCommandPaletteSignal}
        closeCommandPaletteSignal={closeCommandPaletteSignal}
        onToggleDensity={() =>
          setDensity((prev) =>
            prev === "compact" ? "comfortable" : "compact",
          )
        }
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
          roomOpenLastReadSnapshot={roomOpenLastReadSnapshot}
          density={density}
          messageViewMode={messageViewMode}
          messageContext={messageContext}
          hasOtherUnreadRooms={hasOtherUnreadRooms}
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
          onExitContextMode={handleExitContextMode}
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
          focusSignal={searchFocusSignal}
          onOpenMessageContext={handleOpenMessageContext}
        />
      )}
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../context/AuthContext";
import { getRooms, createRoom } from "../services/api";
import { RoomDiscoveryModal } from "./RoomDiscoveryModal";
import { Compass } from "lucide-react";
import type { Room } from "../types";

interface RoomListProps {
  selectedRoom: Room | null;
  onSelectRoom: (room: Room) => void;
  sidebarOpen: boolean;
  refreshTrigger?: number;
  unreadCounts: Record<number, number>;
  onUnreadCountsLoaded: (counts: Record<number, number>) => void;
  onInitialRoomsLoaded?: (rooms: Room[]) => void;
}

export default function RoomList({
  selectedRoom,
  onSelectRoom,
  sidebarOpen,
  refreshTrigger,
  unreadCounts,
  onUnreadCountsLoaded,
  onInitialRoomsLoaded,
}: RoomListProps) {
  const { token, user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [timeoutError, setTimeoutError] = useState(false);
  // Local retry counter so the effect can refetch when user clicks "Retry"
  const [retryCount, setRetryCount] = useState(0);
  const hasReportedInitialRoomsRef = useRef(false);

  // Room modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Discovery modal state
  const [showDiscovery, setShowDiscovery] = useState(false);
  const prevSidebarOpenRef = useRef(sidebarOpen);

  // When sidebar transitions from open to closed (e.g. user taps message area on mobile), close discovery modal to avoid stray content. Do not close when sidebar is already collapsed and user opens discovery from the compass.
  useEffect(() => {
    if (prevSidebarOpenRef.current && !sidebarOpen && showDiscovery) {
      setShowDiscovery(false);
    }
    prevSidebarOpenRef.current = sidebarOpen;
  }, [sidebarOpen, showDiscovery]);

  useEffect(() => {
    let timeoutId: number;

    async function fetchRooms() {
      if (!token) return;

      // Reset timeout error state
      setTimeoutError(false);
      setLoading(true);
      setError("");

      // 5-second timeout for local testing
      timeoutId = window.setTimeout(() => {
        setTimeoutError(true);
        setError("Loading is taking longer than expected. The server may be waking up.");
        setLoading(false);
      }, 5000);

      try {
        const fetchedRooms = await getRooms(token, { includeUnread: true });
        clearTimeout(timeoutId);
        setRooms(fetchedRooms);
        const counts: Record<number, number> = {};
        fetchedRooms.forEach((r) => {
          if (r.unread_count != null) counts[r.id] = r.unread_count;
        });
        onUnreadCountsLoaded(counts);
        if (!hasReportedInitialRoomsRef.current && onInitialRoomsLoaded) {
          hasReportedInitialRoomsRef.current = true;
          onInitialRoomsLoaded(fetchedRooms);
        }
        setTimeoutError(false);
      } catch (err) {
        clearTimeout(timeoutId);
        setError(err instanceof Error ? err.message : "Failed to load rooms");
        setTimeoutError(false);
      } finally {
        if (!timeoutError) {
          setLoading(false);
        }
      }
    }

    fetchRooms();

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [token, refreshTrigger, retryCount]);

  const handleRetry = () => {
    setLoading(true);
    setError("");
    setTimeoutError(false);
    // Bump local retry counter so the effect above refetches rooms
    setRetryCount((prev) => prev + 1);
  };

  // Function to reload rooms (used by discovery modal)
  const loadRooms = async () => {
    if (!token) return;
    try {
      const fetchedRooms = await getRooms(token, { includeUnread: true });
      setRooms(fetchedRooms);
      const counts: Record<number, number> = {};
      fetchedRooms.forEach((r) => {
        if (r.unread_count != null) counts[r.id] = r.unread_count;
      });
      onUnreadCountsLoaded(counts);
    } catch (err) {
      console.error('Error loading rooms:', err);
    }
  };



  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) return;

    // Validate
    const trimmedName = newRoomName.trim();
    if (trimmedName.length < 3) {
      setCreateError("Room name must be at least 3 characters");
      return;
    }

    if (trimmedName.length > 50) {
      setCreateError("Room name must be less than 50 characters");
      return;
    }

    setCreating(true);
    setCreateError("");

    try {
      const newRoom = await createRoom(trimmedName, token);

      setRooms([...rooms, newRoom]);
      onSelectRoom(newRoom);

      setShowCreateModal(false);
      setNewRoomName("");
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Failed to create room",
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      {/* Room List Area */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center p-4">
            <p className="text-zinc-400">Loading rooms...</p>
          </div>
        ) : error ? (
          <div className="p-4">
            <div className="bg-red-900/20 text-red-400 p-3 rounded text-sm border border-red-900">
              {error}
              <button
                onClick={handleRetry}
                className="mt-2 block w-full py-1 px-2 bg-red-600/20 hover:bg-red-600/30 rounded text-xs transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        ) : rooms.length === 0 ? (
          <div className="flex items-center justify-center p-4">
            <p className="text-zinc-400 text-sm text-center">
              No rooms yet. Create one below!
            </p>
          </div>
        ) : (
          rooms.map((room) => {
            const isSelected = selectedRoom?.id === room.id;
            const unreadCount = unreadCounts[room.id] ?? 0;
            const hasUnread = unreadCount > 0 && !isSelected;
            return (
              <button
                key={room.id}
                onClick={() => onSelectRoom(room)}
                className={`w-full text-left px-4 py-3 hover:bg-zinc-800 transition-colors border-l-4 flex items-center justify-between gap-2 ${
                  isSelected
                    ? "bg-amber-500/10 border-l-amber-500"
                    : "border-l-transparent"
                } ${hasUnread ? "bg-amber-500/5" : ""}`}
              >
                {sidebarOpen ? (
                  <>
                    <div
                      className={`font-medium truncate min-w-0 ${
                        isSelected ? "text-amber-500" : "text-zinc-100"
                      } ${hasUnread ? "font-semibold" : ""}`}
                    >
                      {room.name}
                    </div>
                    {hasUnread && (
                      <span className="shrink-0 bg-amber-500 text-zinc-900 rounded-full min-w-5 h-5 px-1.5 flex items-center justify-center text-xs font-bold">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </>
                ) : (
                  <div className="flex justify-center w-full relative">
                    <span
                      className={`text-sm font-medium ${
                        isSelected ? "text-amber-500" : "text-zinc-400"
                      }`}
                    >
                      {room.name.charAt(0).toUpperCase()}
                    </span>
                    {hasUnread && (
                      <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-amber-500" />
                    )}
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Browse Rooms and Create Room Buttons - ALWAYS RENDERS */}
      <div className="border-t border-zinc-800">
        {/* Browse Rooms Button */}
        <div className="px-3 py-2">
          <button
            onClick={() => setShowDiscovery(true)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:text-amber-500 hover:bg-zinc-800 rounded transition-colors"
            title="Browse public rooms"
          >
            <Compass className="w-4 h-4" />
            {sidebarOpen && <span>Browse Rooms</span>}
          </button>
        </div>

        {/* Create Room Button */}
        <div className="px-3 pb-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-full py-2 bg-amber-500 text-zinc-900 font-medium rounded hover:bg-amber-600 transition-colors flex items-center justify-center gap-2"
            title="Create new room"
          >
            {sidebarOpen ? (
              <>
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                <span>Create Room</span>
              </>
            ) : (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Create Room Modal - rendered via portal to escape sidebar constraints */}
      {showCreateModal &&
        createPortal(
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-zinc-800 rounded-lg p-6 max-w-md w-full mx-4 border border-zinc-700">
              <h3 className="text-xl font-semibold text-zinc-100 mb-4">
                Create New Room
              </h3>

              <form onSubmit={handleCreateRoom}>
                <div className="mb-4">
                  <label
                    htmlFor="roomName"
                    className="block text-sm font-medium text-zinc-300 mb-2"
                  >
                    Room Name
                  </label>
                  <input
                    id="roomName"
                    type="text"
                    value={newRoomName}
                    onChange={(e) => {
                      setNewRoomName(e.target.value);
                      setCreateError(""); // Clear error on input
                    }}
                    placeholder="e.g., General Discussion"
                    autoFocus
                    disabled={creating}
                    className="w-full px-4 py-2 bg-zinc-900 text-zinc-100 rounded border border-zinc-700 focus:outline-none focus:border-amber-500 disabled:opacity-50"
                  />
                  {createError && (
                    <p className="mt-2 text-sm text-red-400">{createError}</p>
                  )}
                  <p className="mt-2 text-xs text-zinc-500">
                    Room names must be 3-50 characters
                  </p>
                </div>

                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setNewRoomName("");
                      setCreateError("");
                    }}
                    disabled={creating}
                    className="px-4 py-2 bg-zinc-700 text-zinc-200 rounded hover:bg-zinc-600 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating || !newRoomName.trim()}
                    className="px-4 py-2 bg-amber-500 text-zinc-900 font-medium rounded hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {creating ? "Creating..." : "Create Room"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* Room Discovery Modal - portal to body so it stays on top and backdrop click works on mobile */}
      {showDiscovery &&
        token &&
        user &&
        createPortal(
          <RoomDiscoveryModal
            isOpen={showDiscovery}
            onClose={() => setShowDiscovery(false)}
            onRoomJoined={() => {
              loadRooms();
              // setShowDiscovery(false);
            }}
            currentUserId={user.id}
            joinedRoomIds={new Set(rooms.map((r) => r.id))}
            token={token}
          />,
          document.body
        )}
    </>
  );
}

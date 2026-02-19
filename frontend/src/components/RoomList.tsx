import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { getRooms, createRoom } from "../services/api";
import { RoomDiscoveryModal } from "./RoomDiscoveryModal";
import type { Room } from "../types";

interface RoomListProps {
  selectedRoom: Room | null;
  onSelectRoom: (room: Room) => void;
  sidebarOpen: boolean;
  refreshTrigger?: number;
  unreadCounts: Record<number, number>;
  onUnreadCountsLoaded: (counts: Record<number, number>) => void;
  onInitialRoomsLoaded?: (rooms: Room[]) => void;
  onLogout: () => void;
  /** When sidebar is collapsed, clicking the user avatar calls this to expand (same as header "R" button) */
  onExpandSidebar?: () => void;
}

function getUserInitials(username: string): string {
  return username.substring(0, 2).toUpperCase();
}

export default function RoomList({
  selectedRoom,
  onSelectRoom,
  sidebarOpen,
  refreshTrigger,
  unreadCounts,
  onUnreadCountsLoaded,
  onInitialRoomsLoaded,
  onLogout,
  onExpandSidebar,
}: RoomListProps) {
  const { token, user } = useAuth();
  const { theme } = useTheme();
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
  const [showLogoutModal, setShowLogoutModal] = useState(false);
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

  const roomActiveBackground = theme === "neon" ? "#00f0ff0a" : "#ffbf000a";
  const roomHoverBackground = theme === "neon" ? "#00f0ff06" : "#ffbf0006";
  const primaryButtonHoverBackground =
    theme === "neon" ? "rgba(0, 240, 255, 0.07)" : "rgba(255, 191, 0, 0.07)";
  const secondaryButtonHoverBackground =
    theme === "neon" ? "rgba(255, 0, 204, 0.07)" : "rgba(255, 136, 0, 0.07)";

  return (
    <>
      {/* Section label */}
      {sidebarOpen && (
        <div
          className="font-pixel text-[7px] tracking-[0.15em]"
          style={{ color: "var(--color-meta)", padding: "8px 14px 4px" }}
        >
          ROOMS
        </div>
      )}

      {/* Room List Area */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center p-4">
            <p className="font-mono text-[12px]" style={{ color: "var(--color-meta)" }}>
              Loading rooms...
            </p>
          </div>
        ) : error ? (
          <div className="p-4">
            <div
              className="p-3 text-sm"
              style={{
                background: "rgba(255, 0, 0, 0.05)",
                color: "#ff4444",
                border: "1px solid rgba(255, 0, 0, 0.2)",
              }}
            >
              {error}
              <button
                onClick={handleRetry}
                className="mt-2 block w-full py-1 px-2 text-xs transition-colors"
                style={{
                  background: "rgba(255, 0, 0, 0.1)",
                  color: "#ff4444",
                }}
              >
                Retry
              </button>
            </div>
          </div>
        ) : rooms.length === 0 ? (
          <div className="flex items-center justify-center p-4">
            <p className="font-mono text-[12px] text-center" style={{ color: "var(--color-meta)" }}>
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
                className="w-full text-left flex items-center justify-between gap-2 transition-all duration-150"
                style={{
                  padding: "10px 12px 10px 14px",
                  borderBottom: "1px solid var(--border-dim)",
                  borderLeft: isSelected
                    ? "2px solid var(--color-primary)"
                    : "2px solid transparent",
                  background: isSelected ? roomActiveBackground : "transparent",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.transform = "translateX(2px)";
                    e.currentTarget.style.borderLeftColor = "var(--border-primary)";
                    e.currentTarget.style.background = roomHoverBackground;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.transform = "translateX(0)";
                    e.currentTarget.style.borderLeftColor = "transparent";
                    e.currentTarget.style.background = "transparent";
                  }
                }}
              >
                {sidebarOpen ? (
                  <>
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{
                          background: "var(--color-accent2)",
                          boxShadow: "var(--glow-accent2)",
                          animation: "breathe 2.8s ease-in-out infinite",
                        }}
                      />
                      <div
                        className="font-bebas text-[17px] tracking-[0.08em] truncate min-w-0 flex-1"
                        style={{
                          color: isSelected
                            ? "var(--color-primary)"
                            : "var(--color-text)",
                        }}
                      >
                        {room.name}
                      </div>
                    </div>
                    {hasUnread && (
                      <span
                        className="shrink-0 font-mono text-[10px] px-1.5 py-px"
                        style={{
                          background: "var(--color-secondary)",
                          color: "#000",
                          borderRadius: "2px",
                          boxShadow: "var(--glow-secondary)",
                        }}
                      >
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </>
                ) : (
                  <div className="flex justify-center w-full relative">
                    <span
                      className="font-bebas text-[17px]"
                      style={{
                        color: isSelected
                          ? "var(--color-primary)"
                          : "var(--color-text)",
                      }}
                    >
                      {room.name.charAt(0).toUpperCase()}
                    </span>
                    {hasUnread && (
                      <span
                        className="absolute top-0 right-0 w-2 h-2 rounded-full"
                        style={{
                          background: "var(--color-secondary)",
                          boxShadow: "var(--glow-secondary)",
                        }}
                      />
                    )}
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Action buttons + User block */}
      <div style={{ borderTop: "1px solid var(--border-dim)" }}>
        {/* CREATE ROOM + DISCOVER buttons */}
        {sidebarOpen ? (
          <div className="flex gap-1.5" style={{ padding: "10px 8px 14px" }}>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex-1 font-bebas text-[14px] tracking-[0.10em] py-2.5 px-1.5 transition-all duration-150"
              style={{
                background: "transparent",
                border: "1px solid var(--color-primary)",
                color: "var(--color-primary)",
              }}
              title="Create new room"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = primaryButtonHoverBackground;
                e.currentTarget.style.boxShadow = "var(--glow-primary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              CREATE ROOM
            </button>
            <button
              onClick={() => setShowDiscovery(true)}
              className="flex-1 font-bebas text-[14px] tracking-[0.10em] py-2.5 px-1.5 transition-all duration-150"
              style={{
                background: "transparent",
                border: "1px solid var(--color-secondary)",
                color: "var(--color-secondary)",
              }}
              title="Discover rooms"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = secondaryButtonHoverBackground;
                e.currentTarget.style.boxShadow = "var(--glow-secondary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              DISCOVER
            </button>
          </div>
        ) : (
          <div className="px-3 py-2 space-y-1">
            <button
              onClick={() => setShowCreateModal(true)}
              className="w-full flex justify-center py-2 transition-colors"
              style={{ color: "var(--color-primary)" }}
              title="Create new room"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <button
              onClick={() => setShowDiscovery(true)}
              className="w-full flex justify-center py-2 transition-colors"
              style={{ color: "var(--color-secondary)" }}
              title="Discover rooms"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" strokeWidth={2} />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" />
              </svg>
            </button>
          </div>
        )}

        {/* User block: identity + logout */}
        <div
          className="h-14 sm:h-16 shrink-0 px-3 flex items-center"
          style={{ borderTop: "1px solid var(--border-dim)" }}
        >
          {sidebarOpen ? (
            <div className="flex items-center gap-3 w-full">
              <div
                className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center font-bebas text-[14px]"
                style={{
                  background: "var(--bg-app)",
                  border: "1px solid var(--border-primary)",
                  color: "var(--color-primary)",
                }}
                title={user?.username ?? "User"}
              >
                {user ? getUserInitials(user.username) : "US"}
              </div>
              <span
                className="font-mono text-[12px] tracking-[0.06em] truncate min-w-0 flex-1"
                style={{ color: "var(--color-text)", opacity: 0.53 }}
                title={user?.username ?? "User"}
              >
                {user?.username ?? "Username"}
              </span>
              <button
                type="button"
                onClick={() => setShowLogoutModal(true)}
                className="shrink-0 flex items-center gap-1.5 px-2 py-1.5 text-sm transition-colors"
                style={{ color: "#ff4444" }}
                title="Logout"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="flex justify-center w-full">
              <button
                type="button"
                onClick={onExpandSidebar}
                className="hover:scale-110 transition-transform"
                title="Expand sidebar"
                aria-label="Expand sidebar"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center font-bebas text-[14px]"
                  style={{
                    background: "var(--bg-app)",
                    border: "1px solid var(--border-primary)",
                    color: "var(--color-primary)",
                  }}
                  title={user?.username ?? "User"}
                >
                  {user ? getUserInitials(user.username) : "US"}
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Create Room Modal - rendered via portal to escape sidebar constraints */}
      {showCreateModal &&
        createPortal(
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div
              className="p-6 max-w-md w-full mx-4"
              style={{
                background: "var(--bg-panel)",
                border: "1px solid var(--border-primary)",
              }}
            >
              <h3
                className="font-bebas text-[22px] tracking-[0.08em] mb-4"
                style={{ color: "var(--color-primary)" }}
              >
                Create New Room
              </h3>

              <form onSubmit={handleCreateRoom}>
                <div className="mb-4">
                  <label
                    htmlFor="roomName"
                    className="block font-pixel text-[7px] tracking-[0.2em] mb-2"
                    style={{ color: "var(--color-meta)" }}
                  >
                    ROOM NAME
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
                    className="w-full px-3 py-2 font-mono text-[14px] focus:outline-none disabled:opacity-50"
                    style={{
                      background: "var(--bg-app)",
                      color: "var(--color-primary)",
                      border: "1px solid var(--border-primary)",
                      borderRadius: "2px",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.boxShadow = "var(--glow-primary)";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  />
                  {createError && (
                    <p className="mt-2 text-sm" style={{ color: "#ff4444" }}>{createError}</p>
                  )}
                  <p
                    className="mt-2 font-pixel text-[7px] tracking-[0.12em]"
                    style={{ color: "var(--color-meta)" }}
                  >
                    ROOM NAMES MUST BE 3-50 CHARACTERS
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
                    className="px-4 py-2 font-bebas text-[14px] tracking-[0.10em] transition-colors disabled:opacity-50"
                    style={{
                      border: "1px solid var(--border-dim)",
                      color: "var(--color-text)",
                      background: "transparent",
                    }}
                  >
                    CANCEL
                  </button>
                  <button
                    type="submit"
                    disabled={creating || !newRoomName.trim()}
                    className="px-4 py-2 font-bebas text-[14px] tracking-[0.10em] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      border: "1px solid var(--color-primary)",
                      color: "#000",
                      background: "var(--color-primary)",
                    }}
                  >
                    {creating ? "CREATING..." : "CREATE ROOM"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* Logout Confirmation Modal - matches other destructive action prompts */}
      {showLogoutModal &&
        createPortal(
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div
              className="p-6 max-w-md w-full mx-4"
              style={{
                background: "var(--bg-panel)",
                border: "1px solid var(--border-primary)",
              }}
            >
              <h3
                className="font-bebas text-[22px] tracking-[0.08em] mb-2"
                style={{ color: "var(--color-primary)" }}
              >
                Log Out?
              </h3>
              <p
                className="font-mono text-[14px] mb-6"
                style={{ color: "var(--color-meta)" }}
              >
                Are you sure you want to log out of this session?
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowLogoutModal(false)}
                  className="px-4 py-2 font-bebas text-[14px] tracking-[0.10em] transition-colors"
                  style={{
                    border: "1px solid var(--border-dim)",
                    color: "var(--color-text)",
                    background: "transparent",
                  }}
                >
                  CANCEL
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowLogoutModal(false);
                    onLogout();
                  }}
                  className="px-4 py-2 font-bebas text-[14px] tracking-[0.10em] transition-colors"
                  style={{
                    background: "#ff4444",
                    color: "#000",
                    border: "1px solid #ff4444",
                  }}
                >
                  LOG OUT
                </button>
              </div>
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

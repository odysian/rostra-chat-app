import type { KeyboardEvent } from "react";
import type { Room } from "../../types";
import { formatRoomNameForDisplay } from "../../utils/roomNames";

interface RoomListPanelProps {
  sidebarOpen: boolean;
  loading: boolean;
  error: string;
  rooms: Room[];
  selectedRoom: Room | null;
  unreadCounts: Record<number, number>;
  roomActiveBackground: string;
  roomHoverBackground: string;
  onSelectRoom: (room: Room) => void;
  onRetry: () => void;
}

function focusMessageInput(): void {
  const input = document.querySelector<HTMLTextAreaElement>(
    "[data-tab-focus='message-input']",
  );
  input?.focus();
}

export function RoomListPanel({
  sidebarOpen,
  loading,
  error,
  rooms,
  selectedRoom,
  unreadCounts,
  roomActiveBackground,
  roomHoverBackground,
  onSelectRoom,
  onRetry,
}: RoomListPanelProps) {
  const handleRoomKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    // Prioritize jumping straight into composer from room focus.
    if (event.key === "Tab" && !event.shiftKey && selectedRoom) {
      event.preventDefault();
      focusMessageInput();
    }
  };

  return (
    <>
      {sidebarOpen && (
        <div
          className="font-pixel text-[8px] tracking-[0.15em]"
          style={{
            color: "var(--color-text)",
            opacity: 0.78,
            padding: "10px 14px 6px",
          }}
        >
          ROOMS
        </div>
      )}

      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-4">
            <p
              className="font-mono text-[12px]"
              style={{ color: "var(--color-meta)" }}
            >
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
                onClick={onRetry}
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
            <p
              className="font-mono text-[12px] text-center"
              style={{ color: "var(--color-meta)" }}
            >
              No rooms yet. Create one below!
            </p>
          </div>
        ) : (
          rooms.map((room) => {
            const isSelected = selectedRoom?.id === room.id;
            const unreadCount = unreadCounts[room.id] ?? 0;
            const hasUnread = unreadCount > 0 && !isSelected;
            const displayRoomName = formatRoomNameForDisplay(room.name);

            return (
              <button
                key={room.id}
                onClick={() => onSelectRoom(room)}
                onKeyDown={handleRoomKeyDown}
                className="w-full text-left flex items-center justify-between gap-2 transition-all duration-150"
                style={{
                  padding: "11px 12px 11px 14px",
                  borderBottom: "1px solid var(--border-dim)",
                  borderLeft: isSelected
                    ? "2px solid var(--color-primary)"
                    : "2px solid transparent",
                  background: isSelected ? roomActiveBackground : "transparent",
                  cursor: "pointer",
                }}
                onMouseEnter={(event) => {
                  if (!isSelected) {
                    event.currentTarget.style.transform = "translateX(2px)";
                    event.currentTarget.style.borderLeftColor =
                      "var(--border-primary)";
                    event.currentTarget.style.background = roomHoverBackground;
                  }
                }}
                onMouseLeave={(event) => {
                  if (!isSelected) {
                    event.currentTarget.style.transform = "translateX(0)";
                    event.currentTarget.style.borderLeftColor = "transparent";
                    event.currentTarget.style.background = "transparent";
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
                        {displayRoomName}
                      </div>
                    </div>
                    {hasUnread && (
                      <span
                        className="shrink-0 font-mono text-[11px] font-semibold px-2 py-0.5 leading-none"
                        style={{
                          background: "var(--color-secondary)",
                          color: "#000",
                          borderRadius: "999px",
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
                      {displayRoomName.charAt(0).toUpperCase()}
                    </span>
                    {hasUnread && (
                      <span
                        className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full"
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
    </>
  );
}

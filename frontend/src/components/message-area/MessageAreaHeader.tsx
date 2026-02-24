interface MessageAreaHeaderProps {
  displayRoomName: string;
  displayRoomDescription: string | null;
  theme: "neon" | "amber";
  showRoomMenu: boolean;
  hasOtherUnreadRooms: boolean;
  isRoomOwner: boolean;
  onBackToRooms: () => void;
  onToggleRoomMenu: () => void;
  onCloseRoomMenu: () => void;
  onLeaveRoom: () => void;
  onRequestEditRoom: () => void;
  onRequestDeleteRoom: () => void;
  onToggleSearch: () => void;
  onToggleUsers: () => void;
}

export function MessageAreaHeader({
  displayRoomName,
  displayRoomDescription,
  theme,
  showRoomMenu,
  hasOtherUnreadRooms,
  isRoomOwner,
  onBackToRooms,
  onToggleRoomMenu,
  onCloseRoomMenu,
  onLeaveRoom,
  onRequestEditRoom,
  onRequestDeleteRoom,
  onToggleSearch,
  onToggleUsers,
}: MessageAreaHeaderProps) {
  const normalizedDescription = displayRoomDescription?.trim() ?? "";
  const hasDescription = normalizedDescription.length > 0;

  return (
    <div
      className="shrink-0 flex items-center justify-between gap-2 px-3 sm:px-5 min-w-0"
      style={{
        borderBottom: "1px solid var(--border-dim)",
        padding: "12px 20px",
      }}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        {/* Back button - mobile only */}
        <div className="relative md:hidden">
          <button
            type="button"
            data-tab-focus="back-button"
            onClick={onBackToRooms}
            className="shrink-0 transition-colors p-1 icon-button-focus"
            style={{ color: "var(--color-meta)" }}
            title="Back to rooms"
            aria-label="Back to rooms"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          {hasOtherUnreadRooms && (
            <span
              className="absolute top-0 right-0 w-2 h-2 rounded-full"
              style={{
                background: "var(--color-secondary)",
                boxShadow: "var(--glow-secondary)",
              }}
              aria-hidden
            />
          )}
        </div>

        <div className="min-w-0 flex-1 overflow-hidden">
          {/* Room name — gradient for neon, solid glow for amber */}
          {theme === "neon" ? (
            <div className="flex flex-col items-start gap-0.5 min-w-0 sm:flex-row sm:items-center sm:gap-1.5">
              <h2
                className="inline-flex items-center min-w-0 max-w-full sm:max-w-[62%] md:max-w-[70%] font-bebas text-[clamp(18px,5.5vw,24px)] sm:text-[24px] leading-[0.95] tracking-[0.11em] truncate gradient-text"
                title={`#${displayRoomName}`}
                style={{
                  backgroundImage:
                    "linear-gradient(90deg, var(--color-primary), var(--color-secondary))",
                  filter: "drop-shadow(0 0 6px rgba(0, 240, 255, 0.27))",
                }}
              >
                #{displayRoomName}
              </h2>
              {hasDescription && (
                <p
                  className="w-full min-w-0 truncate font-mono text-[10px] sm:text-[11px] leading-none sm:flex-1"
                  style={{ color: "var(--color-meta)" }}
                  title={normalizedDescription}
                >
                  {normalizedDescription}
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-start gap-0.5 min-w-0 sm:flex-row sm:items-center sm:gap-1.5">
              <h2
                className="inline-flex items-center min-w-0 max-w-full sm:max-w-[62%] md:max-w-[70%] font-bebas text-[clamp(18px,5.5vw,24px)] sm:text-[24px] leading-[0.95] tracking-[0.11em] truncate"
                title={`#${displayRoomName}`}
                style={{
                  color: "var(--color-primary)",
                  textShadow: "var(--glow-primary)",
                }}
              >
                #{displayRoomName}
              </h2>
              {hasDescription && (
                <p
                  className="w-full min-w-0 truncate font-mono text-[10px] sm:text-[11px] leading-none sm:flex-1"
                  style={{ color: "var(--color-meta)" }}
                  title={normalizedDescription}
                >
                  {normalizedDescription}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Room Options Menu */}
        <div className="relative shrink-0">
          <button
            type="button"
            data-tab-focus="room-menu-button"
            onClick={onToggleRoomMenu}
            className="transition-colors p-1.5 icon-button-focus"
            style={{ color: "var(--color-meta)" }}
            title="Room options"
            aria-label="Room options"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
            </svg>
          </button>

          {/* Dropdown Menu */}
          {showRoomMenu && (
            <>
              <div
                className="fixed inset-0 z-10 cursor-pointer"
                onClick={onCloseRoomMenu}
              />
              <div
                className="absolute right-0 mt-2 w-48 max-w-[calc(100vw-16px)] max-h-64 overflow-y-auto shadow-lg py-1 z-20"
                style={{
                  background: "var(--bg-panel)",
                  border: "1px solid var(--border-primary)",
                }}
              >
                <button
                  type="button"
                  onClick={onLeaveRoom}
                  className="w-full px-4 py-2 text-left font-mono text-[12px] room-menu-item"
                  style={{ color: "var(--color-text)" }}
                >
                  Leave Room
                </button>

                {isRoomOwner && (
                  <>
                    <div style={{ borderTop: "1px solid var(--border-dim)", margin: "4px 0" }} />
                    <button
                      type="button"
                      onClick={onRequestEditRoom}
                      className="w-full px-4 py-2 text-left font-mono text-[12px] room-menu-item"
                      style={{ color: "var(--color-text)" }}
                    >
                      Edit Room Details
                    </button>
                    <div style={{ borderTop: "1px solid var(--border-dim)", margin: "4px 0" }} />
                    <button
                      type="button"
                      onClick={onRequestDeleteRoom}
                      className="w-full px-4 py-2 text-left font-mono text-[12px] room-menu-item"
                      style={{ color: "#ff4444" }}
                    >
                      Delete Room
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Search toggle */}
      <button
        type="button"
        data-tab-focus="search-button"
        onClick={onToggleSearch}
        className="shrink-0 transition-colors p-1 icon-button-focus"
        style={{ color: "var(--color-meta)" }}
        title="Search messages"
        aria-label="Search messages"
      >
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
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </button>

      <button
        type="button"
        data-tab-focus="users-button"
        onClick={onToggleUsers}
        className="shrink-0 transition-colors p-1 icon-button-focus"
        style={{ color: "var(--color-meta)" }}
        title="Toggle users panel"
        aria-label="Toggle users panel"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      </button>
    </div>
  );
}

import type { User } from "../../types";
import { getUserColorPalette } from "../../utils/userColors";

interface RoomListFooterProps {
  sidebarOpen: boolean;
  theme: "neon" | "amber";
  user: User | null;
  onOpenCreateModal: () => void;
  onOpenDiscoveryModal: () => void;
  onOpenLogoutModal: () => void;
  onExpandSidebar?: () => void;
}

function getUserInitials(username: string): string {
  return username.substring(0, 2).toUpperCase();
}

export function RoomListFooter({
  sidebarOpen,
  theme,
  user,
  onOpenCreateModal,
  onOpenDiscoveryModal,
  onOpenLogoutModal,
  onExpandSidebar,
}: RoomListFooterProps) {
  const primaryButtonHoverBackground =
    theme === "neon" ? "rgba(0, 240, 255, 0.07)" : "rgba(255, 191, 0, 0.07)";
  const secondaryButtonHoverBackground =
    theme === "neon" ? "rgba(255, 0, 204, 0.07)" : "rgba(255, 136, 0, 0.07)";

  // Keep amber visuals cohesive by using per-user hues only in neon mode.
  const sidebarUserColors =
    theme === "neon" && user ? getUserColorPalette(user.username) : null;

  return (
    <div style={{ borderTop: "1px solid var(--border-dim)" }}>
      {sidebarOpen ? (
        <div className="flex gap-1.5" style={{ padding: "10px 8px 14px" }}>
          <button
            onClick={onOpenCreateModal}
            className="flex-1 font-bebas text-[14px] tracking-[0.10em] py-2.5 px-1.5 transition-all duration-150"
            style={{
              background: "transparent",
              border: "1px solid var(--color-primary)",
              color: "var(--color-primary)",
            }}
            title="Create new room"
            onMouseEnter={(event) => {
              event.currentTarget.style.background = primaryButtonHoverBackground;
              event.currentTarget.style.boxShadow = "var(--glow-primary)";
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.background = "transparent";
              event.currentTarget.style.boxShadow = "none";
            }}
          >
            CREATE ROOM
          </button>
          <button
            onClick={onOpenDiscoveryModal}
            className="flex-1 font-bebas text-[14px] tracking-[0.10em] py-2.5 px-1.5 transition-all duration-150"
            style={{
              background: "transparent",
              border: "1px solid var(--color-secondary)",
              color: "var(--color-secondary)",
            }}
            title="Discover rooms"
            onMouseEnter={(event) => {
              event.currentTarget.style.background = secondaryButtonHoverBackground;
              event.currentTarget.style.boxShadow = "var(--glow-secondary)";
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.background = "transparent";
              event.currentTarget.style.boxShadow = "none";
            }}
          >
            DISCOVER
          </button>
        </div>
      ) : (
        <div className="px-3 py-2 space-y-1">
          <button
            type="button"
            onClick={onOpenCreateModal}
            className="w-full flex justify-center py-2 transition-all duration-150 icon-button-focus"
            style={{ color: "var(--color-primary)", boxShadow: "none" }}
            title="Create new room"
            aria-label="Create new room"
            onMouseEnter={(event) => {
              event.currentTarget.style.background = primaryButtonHoverBackground;
              event.currentTarget.style.boxShadow = "var(--glow-primary)";
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.background = "transparent";
              event.currentTarget.style.boxShadow = "none";
            }}
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
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={onOpenDiscoveryModal}
            className="w-full flex justify-center py-2 transition-all duration-150 icon-button-focus"
            style={{ color: "var(--color-secondary)", boxShadow: "none" }}
            title="Discover rooms"
            aria-label="Discover rooms"
            onMouseEnter={(event) => {
              event.currentTarget.style.background = secondaryButtonHoverBackground;
              event.currentTarget.style.boxShadow = "var(--glow-secondary)";
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.background = "transparent";
              event.currentTarget.style.boxShadow = "none";
            }}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <circle cx="12" cy="12" r="10" strokeWidth={2} />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z"
              />
            </svg>
          </button>
        </div>
      )}

      <div
        className="h-[66.5px] shrink-0 px-3 flex items-center"
        style={{
          borderTop: "1px solid var(--border-dim)",
          marginTop: "-1px",
        }}
      >
        {sidebarOpen ? (
          <div className="flex items-center gap-3 w-full">
            <div
              className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center font-bebas text-[16px]"
              style={{
                background: sidebarUserColors?.backgroundColor ?? "var(--bg-app)",
                border: `1px solid ${sidebarUserColors?.borderColor ?? "var(--border-primary)"}`,
                color: sidebarUserColors?.textColor ?? "var(--color-primary)",
                boxShadow: sidebarUserColors?.glowColor ?? "none",
              }}
              title={user?.username ?? "User"}
            >
              {user ? getUserInitials(user.username) : "US"}
            </div>
            <span
              className="font-mono text-[13px] tracking-[0.06em] truncate min-w-0 flex-1"
              style={{
                color: sidebarUserColors?.textColor ?? "var(--color-text)",
                opacity: 0.92,
              }}
              title={user?.username ?? "User"}
            >
              {user?.username ?? "Username"}
            </span>
            <button
              type="button"
              onClick={onOpenLogoutModal}
              className="shrink-0 flex items-center gap-1.5 px-2 py-1.5 text-sm transition-colors icon-button-focus"
              style={{ color: "#ff4444" }}
              title="Logout"
              aria-label="Logout"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            </button>
          </div>
        ) : (
          <div className="flex justify-center w-full">
            <button
              type="button"
              onClick={onExpandSidebar}
              className="hover:scale-110 transition-transform icon-button-focus"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center font-bebas text-[16px]"
                style={{
                  background: sidebarUserColors?.backgroundColor ?? "var(--bg-app)",
                  border: `1px solid ${sidebarUserColors?.borderColor ?? "var(--border-primary)"}`,
                  color: sidebarUserColors?.textColor ?? "var(--color-primary)",
                  boxShadow: sidebarUserColors?.glowColor ?? "none",
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
  );
}

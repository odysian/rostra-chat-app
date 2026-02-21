import { useEffect, useState } from "react";
import RoomList from "./RoomList";
import { useTheme } from "../context/ThemeContext";
import type { Room } from "../types";

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  density: "compact" | "comfortable";
  openCommandPaletteSignal: number;
  closeCommandPaletteSignal: number;
  onToggleDensity: () => void;
  selectedRoom: Room | null;
  onSelectRoom: (room: Room) => void;
  refreshTrigger: number;
  unreadCounts: Record<number, number>;
  onUnreadCountsLoaded: (counts: Record<number, number>) => void;
  onInitialRoomsLoaded: (rooms: Room[]) => void;
  onLogout: () => void;
  visible: boolean;
}

function parseCrtEnabled(value: string | null): boolean {
  if (!value || value === "off") return false;
  return true;
}

/**
 * Sidebar Component
 *
 * Responsibility: Left panel with logo and room list
 * - Handles collapse/expand animation
 * - Shows logo (full or abbreviated)
 * - Contains RoomList component
 * - Hides on mobile when in chat view
 */
export default function Sidebar({
  isOpen,
  onToggle,
  density,
  openCommandPaletteSignal,
  closeCommandPaletteSignal,
  onToggleDensity,
  selectedRoom,
  onSelectRoom,
  refreshTrigger,
  unreadCounts,
  onUnreadCountsLoaded,
  onInitialRoomsLoaded,
  onLogout,
  visible,
}: SidebarProps) {
  const { theme, toggleTheme } = useTheme();
  const [crtEnabled, setCrtEnabled] = useState(() => {
    const stored = localStorage.getItem("rostra-crt");
    if (stored) return parseCrtEnabled(stored);
    return parseCrtEnabled(document.documentElement.getAttribute("data-crt"));
  });

  useEffect(() => {
    // Persist simple on/off mode while staying compatible with older stored levels.
    const crtState = crtEnabled ? "on" : "off";
    document.documentElement.setAttribute("data-crt", crtState);
    localStorage.setItem("rostra-crt", crtState);
  }, [crtEnabled]);

  if (!visible) return null;

  return (
    <>
      {/* Mobile backdrop - click to close (only show when sidebar is open) */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden cursor-pointer"
          onClick={onToggle}
        />
      )}

      <div
        className={`
          ${isOpen ? "w-[220px]" : "w-16"}
          flex flex-col transition-all duration-300
          md:relative
          fixed top-0 left-0 h-dvh z-50 md:z-auto
          ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
        style={{
          background: "var(--bg-panel)",
          borderRight: "1px solid var(--border-primary)",
        }}
      >
        {/* Header with logo, tagline, and theme toggle */}
        <div
          className="shrink-0 flex flex-col"
          style={{
            borderBottom: "1px solid var(--border-dim)",
            padding: isOpen ? "16px 16px 12px" : "16px 0 12px",
          }}
        >
          {isOpen ? (
            <>
              {/* Top row: logo + control buttons */}
              <div className="flex items-start justify-between">
                <button
                  onClick={onToggle}
                  className="group"
                  title="Collapse sidebar"
                >
                  {/* Logo — gradient for neon, solid glow for amber */}
                  {theme === "neon" ? (
                    <h1
                      className="font-bebas text-[40px] leading-none tracking-[0.06em] gradient-text"
                      style={{
                        backgroundImage:
                          "linear-gradient(90deg, var(--color-primary), var(--color-secondary))",
                      }}
                    >
                      ROSTRA
                    </h1>
                  ) : (
                    <h1
                      className="font-bebas text-[40px] leading-none tracking-[0.06em]"
                      style={{
                        color: "var(--color-primary)",
                        textShadow: "var(--glow-primary)",
                      }}
                    >
                      ROSTRA
                    </h1>
                  )}
                </button>

                <div className="flex flex-col items-end gap-1.5 mt-1">
                  <button
                    onClick={toggleTheme}
                    className="font-pixel text-[8px] tracking-[0.15em] px-2.5 py-1.5 transition-colors duration-150"
                    style={{
                      border: "1px solid var(--border-primary)",
                      color: "var(--color-primary)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--color-primary)";
                      e.currentTarget.style.color = "#000";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "var(--color-primary)";
                    }}
                  >
                    {theme === "neon" ? "NEON" : "AMBER"}
                  </button>
                  <button
                    onClick={() => setCrtEnabled((prev) => !prev)}
                    className="font-pixel text-[8px] tracking-[0.15em] px-2.5 py-1.5 transition-colors duration-150"
                    style={{
                      border: "1px solid var(--border-secondary)",
                      color: crtEnabled ? "#000" : "var(--color-secondary)",
                      background: crtEnabled ? "var(--color-secondary)" : "transparent",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.filter = "brightness(1.1)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.filter = "brightness(1)";
                    }}
                    aria-pressed={crtEnabled}
                    title={crtEnabled ? "CRT on" : "CRT off"}
                  >
                    CRT
                  </button>
                  <button
                    onClick={onToggleDensity}
                    className="font-pixel text-[8px] tracking-[0.15em] px-2.5 py-1.5 transition-colors duration-150"
                    style={{
                      border: "1px solid var(--border-dim)",
                      color: "var(--color-meta)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--bg-bubble)";
                      e.currentTarget.style.color = "var(--color-text)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "var(--color-meta)";
                    }}
                    title={
                      density === "compact"
                        ? "Switch to comfortable density"
                        : "Switch to compact density"
                    }
                  >
                    {density === "compact" ? "COMPACT" : "COMFY"}
                  </button>
                </div>
              </div>

              {/* Tagline */}
              <span
                className="font-pixel text-[8px] tracking-[0.23em] mt-1"
                style={{ color: "var(--color-meta)" }}
              >
                REAL·TIME·CHAT
              </span>
            </>
          ) : (
            // Collapsed: Show just "R" as expand button
            <button
              onClick={onToggle}
              className="w-full flex justify-center hover:scale-110 transition-transform"
              title="Expand sidebar"
            >
              {theme === "neon" ? (
                <span
                  className="font-bebas text-[40px] leading-none gradient-text"
                  style={{
                    backgroundImage:
                      "linear-gradient(90deg, var(--color-primary), var(--color-secondary))",
                    // Show only the beginning of the logo gradient so collapsed "R"
                    // visually matches the first letter of expanded "ROSTRA".
                    backgroundSize: "600% 100%",
                    backgroundPosition: "0% 0%",
                    backgroundRepeat: "no-repeat",
                  }}
                >
                  R
                </span>
              ) : (
                <span
                  className="font-bebas text-[40px] leading-none"
                  style={{
                    color: "var(--color-primary)",
                    textShadow: "var(--glow-primary)",
                  }}
                >
                  R
                </span>
              )}
            </button>
          )}
        </div>

        {/* Room list - pass through props */}
        <RoomList
          selectedRoom={selectedRoom}
          onSelectRoom={onSelectRoom}
          sidebarOpen={isOpen}
          openCommandPaletteSignal={openCommandPaletteSignal}
          closeCommandPaletteSignal={closeCommandPaletteSignal}
          onToggleTheme={toggleTheme}
          onToggleCrt={() => setCrtEnabled((prev) => !prev)}
          crtEnabled={crtEnabled}
          refreshTrigger={refreshTrigger}
          unreadCounts={unreadCounts}
          onUnreadCountsLoaded={onUnreadCountsLoaded}
          onInitialRoomsLoaded={onInitialRoomsLoaded}
          onLogout={onLogout}
          onExpandSidebar={onToggle}
        />
      </div>
    </>
  );
}

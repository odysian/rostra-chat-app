import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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

  const actionButtonBaseClass =
    "font-pixel text-[8px] tracking-[0.15em] px-2.5 py-1.5 transition-colors duration-150";
  const crtAccentColor = theme === "neon" ? "#9069E2" : "var(--color-secondary)";
  const densityButtonBackground = "var(--color-secondary)";
  const densityButtonBorder = "1px solid var(--border-secondary)";

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
              {/* Desktop: explicit collapse affordance + controls row below. */}
              <div className="hidden md:flex items-start justify-between">
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

                <button
                  onClick={onToggle}
                  className="mt-1 p-1 icon-button-focus transition-transform hover:scale-105"
                  title="Collapse sidebar"
                  aria-label="Collapse sidebar"
                >
                  <ChevronLeft
                    className="w-5 h-5"
                    style={{
                      color: theme === "neon" ? "var(--color-secondary)" : "var(--color-primary)",
                      filter: theme === "neon" ? "drop-shadow(0 0 5px rgba(255, 0, 204, 0.5))" : undefined,
                    }}
                  />
                </button>
              </div>

              {/* Mobile: keep current logo/control interaction model. */}
              <div className="md:hidden flex items-start justify-between">
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
                    className={actionButtonBaseClass}
                    style={{
                      border: "1px solid var(--border-primary)",
                      color: "#000",
                      background: "var(--color-primary)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.filter = "brightness(1.1)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.filter = "brightness(1)";
                    }}
                  >
                    {theme === "neon" ? "NEON" : "AMBER"}
                  </button>
                  <button
                    onClick={() => setCrtEnabled((prev) => !prev)}
                    className={actionButtonBaseClass}
                    style={{
                      border: "1px solid var(--border-secondary)",
                      color: crtEnabled ? "#000" : crtAccentColor,
                      background: crtEnabled ? crtAccentColor : "transparent",
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
                    className={actionButtonBaseClass}
                    style={{
                      border: densityButtonBorder,
                      color: "#000",
                      background: densityButtonBackground,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.filter = "brightness(1.1)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.filter = "brightness(1)";
                    }}
                    title={
                      density === "compact"
                        ? "Switch to comfortable density"
                        : "Switch to compact density"
                    }
                  >
                    {density === "compact" ? "TIGHT" : "COMFY"}
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

              {/* Desktop controls row (temporary layout adjustment). */}
              <div className="hidden md:flex items-center gap-1.5 mt-2">
                <button
                  onClick={toggleTheme}
                  className={actionButtonBaseClass}
                  style={{
                    border: "1px solid var(--border-primary)",
                    color: "#000",
                    background: "var(--color-primary)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.filter = "brightness(1.1)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.filter = "brightness(1)";
                  }}
                >
                  {theme === "neon" ? "NEON" : "AMBER"}
                </button>
                <button
                  onClick={() => setCrtEnabled((prev) => !prev)}
                  className={actionButtonBaseClass}
                  style={{
                    border: "1px solid var(--border-secondary)",
                    color: crtEnabled ? "#000" : crtAccentColor,
                    background: crtEnabled ? crtAccentColor : "transparent",
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
                  className={actionButtonBaseClass}
                  style={{
                    border: densityButtonBorder,
                    color: "#000",
                    background: densityButtonBackground,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.filter = "brightness(1.1)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.filter = "brightness(1)";
                  }}
                  title={
                    density === "compact"
                      ? "Switch to comfortable density"
                      : "Switch to compact density"
                  }
                >
                  {density === "compact" ? "TIGHT" : "COMFY"}
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Desktop collapsed affordance: R + right chevron. */}
              <button
                onClick={onToggle}
                className="hidden md:flex w-full items-center justify-center gap-0.5 hover:scale-105 transition-transform icon-button-focus"
                title="Expand sidebar"
                aria-label="Expand sidebar"
              >
                {theme === "neon" ? (
                  <span
                    className="font-bebas text-[38px] leading-none gradient-text"
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
                    className="font-bebas text-[38px] leading-none"
                    style={{
                      color: "var(--color-primary)",
                      textShadow: "var(--glow-primary)",
                    }}
                  >
                    R
                  </span>
                )}
                <ChevronRight
                  className="w-4 h-4"
                  style={{
                    color: theme === "neon" ? "var(--color-secondary)" : "var(--color-primary)",
                    filter: theme === "neon" ? "drop-shadow(0 0 5px rgba(255, 0, 204, 0.5))" : undefined,
                  }}
                />
              </button>

              {/* Mobile fallback (effectively hidden because closed sidebar is off-canvas on mobile). */}
              <button
                onClick={onToggle}
                className="md:hidden w-full flex justify-center hover:scale-110 transition-transform"
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
            </>
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

import RoomList from "./RoomList";
import type { Room } from "../types";

interface SidebarProps {
  // Visual state
  isOpen: boolean;
  onToggle: () => void;

  // Room management
  selectedRoom: Room | null;
  onSelectRoom: (room: Room) => void;
  refreshTrigger: number;

  // Mobile responsiveness
  visible: boolean; // show/hide based on mobile view
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
  selectedRoom,
  onSelectRoom,
  refreshTrigger,
  visible,
}: SidebarProps) {
  if (!visible) return null;

  return (
    <>
      {/* Mobile backdrop - click to close (only show when sidebar is open) */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onToggle}
        />
      )}

      <div
        className={`
          ${isOpen ? "w-64" : "w-16"}
          bg-zinc-900 border-r border-zinc-800 flex flex-col transition-all duration-300
          md:relative
          fixed inset-y-0 left-0 z-50 md:z-auto
          ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        {/* Header with logo and collapse button */}
        <div className="h-14 border-b border-zinc-800 flex items-center px-4">
          {isOpen ? (
            // Expanded: Show full logo + collapse button
            <button
              onClick={onToggle}
              className="w-full flex items-center justify-between group"
              title="Collapse sidebar"
            >
              <h1 className="text-3xl font-cinzel font-bold text-amber-500 tracking-wide">
                ROSTRA
              </h1>
              <svg
                className="w-5 h-5 text-zinc-400 group-hover:text-amber-500 transition-colors"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 19l-7-7 7-7"
                />
              </svg>
            </button>
          ) : (
            // Collapsed: Show just "R" as expand button
            <button
              onClick={onToggle}
              className="w-full flex justify-center hover:scale-110 transition-transform"
              title="Expand sidebar"
            >
              <span className="text-3xl font-cinzel font-bold text-amber-500">
                R
              </span>
            </button>
          )}
        </div>

        {/* Room list - pass through props */}
        <RoomList
          selectedRoom={selectedRoom}
          onSelectRoom={onSelectRoom}
          sidebarOpen={isOpen}
          refreshTrigger={refreshTrigger}
        />
      </div>
    </>
  );
}

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { Room } from "../../types";
import { formatRoomNameForDisplay } from "../../utils/roomNames";
import { useFocusTrap } from "../../hooks/useFocusTrap";

interface RoomListCommandPaletteProps {
  isOpen: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  rooms: Room[];
  theme: "neon" | "amber";
  crtEnabled: boolean;
  onClose: () => void;
  onSelectRoom: (room: Room) => void;
  onOpenCreateModal: () => void;
  onOpenDiscoveryModal: () => void;
  onToggleTheme?: () => void;
  onToggleCrt?: () => void;
}

export function RoomListCommandPalette({
  isOpen,
  query,
  onQueryChange,
  rooms,
  theme,
  crtEnabled,
  onClose,
  onSelectRoom,
  onOpenCreateModal,
  onOpenDiscoveryModal,
  onToggleTheme,
  onToggleCrt,
}: RoomListCommandPaletteProps) {
  const commandPaletteRef = useRef<HTMLDivElement>(null);
  const commandInputRef = useRef<HTMLInputElement>(null);

  useFocusTrap(commandPaletteRef, isOpen, onClose);

  useEffect(() => {
    if (!isOpen) return;

    const timeoutId = window.setTimeout(() => {
      commandInputRef.current?.focus();
    }, 0);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const normalizedQuery = query.trim().toLowerCase();
  const paletteActionItems = [
    {
      id: "create-room",
      label: "Create room",
      keywords: "create room new",
      run: () => {
        onClose();
        onOpenCreateModal();
      },
    },
    {
      id: "discover-rooms",
      label: "Discover rooms",
      keywords: "discover browse join rooms",
      run: () => {
        onClose();
        onOpenDiscoveryModal();
      },
    },
    {
      id: "toggle-theme",
      label:
        theme === "neon" ? "Switch to amber theme" : "Switch to neon theme",
      keywords: "theme neon amber",
      run: () => {
        onClose();
        onToggleTheme?.();
      },
    },
    {
      id: "toggle-crt",
      label: crtEnabled ? "Turn CRT off" : "Turn CRT on",
      keywords: "crt scanline display",
      run: () => {
        onClose();
        onToggleCrt?.();
      },
    },
  ];

  const visibleActions = paletteActionItems.filter(
    (action) =>
      !normalizedQuery ||
      action.label.toLowerCase().includes(normalizedQuery) ||
      action.keywords.includes(normalizedQuery),
  );

  const visibleRooms = rooms.filter(
    (room) =>
      !normalizedQuery ||
      formatRoomNameForDisplay(room.name).toLowerCase().includes(normalizedQuery),
  );

  const runFirstMatch = () => {
    const firstAction = visibleActions[0];
    if (firstAction) {
      firstAction.run();
      return;
    }

    const firstRoom = visibleRooms[0];
    if (firstRoom) {
      onClose();
      onSelectRoom(firstRoom);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        ref={commandPaletteRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-palette-title"
        className="max-w-xl w-full mx-4"
        style={{
          background: "var(--bg-panel)",
          border: "1px solid var(--border-primary)",
        }}
      >
        <div
          className="px-4 pt-4 pb-3"
          style={{ borderBottom: "1px solid var(--border-dim)" }}
        >
          <h3
            id="command-palette-title"
            className="font-bebas text-[22px] tracking-[0.08em] mb-2"
            style={{ color: "var(--color-primary)" }}
          >
            Command Palette
          </h3>
          <input
            ref={commandInputRef}
            type="text"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                runFirstMatch();
              }
            }}
            placeholder="Filter actions and rooms..."
            className="w-full px-3 py-2 font-mono text-[13px] focus:outline-none"
            style={{
              background: "var(--bg-app)",
              color: "var(--color-primary)",
              border: "1px solid var(--border-primary)",
              borderRadius: "2px",
            }}
          />
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {visibleActions.length > 0 && (
            <>
              <p
                className="font-pixel text-[8px] tracking-[0.18em] px-2 pt-1 pb-2"
                style={{ color: "var(--color-meta)" }}
              >
                ACTIONS
              </p>
              {visibleActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={action.run}
                  className="w-full text-left px-3 py-2 font-mono text-[13px] transition-colors"
                  style={{ color: "var(--color-text)" }}
                >
                  {action.label}
                </button>
              ))}
            </>
          )}

          {visibleRooms.length > 0 && (
            <>
              <p
                className="font-pixel text-[8px] tracking-[0.18em] px-2 pt-3 pb-2"
                style={{ color: "var(--color-meta)" }}
              >
                ROOMS
              </p>
              {visibleRooms.map((room) => {
                const displayRoomName = formatRoomNameForDisplay(room.name);
                return (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => {
                      onClose();
                      onSelectRoom(room);
                    }}
                    className="w-full text-left px-3 py-2 font-mono text-[13px] transition-colors"
                    style={{ color: "var(--color-text)" }}
                  >
                    #{displayRoomName}
                  </button>
                );
              })}
            </>
          )}

          {visibleActions.length === 0 && visibleRooms.length === 0 && (
            <p
              className="px-3 py-4 font-mono text-[12px]"
              style={{ color: "var(--color-meta)" }}
            >
              No matches found.
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

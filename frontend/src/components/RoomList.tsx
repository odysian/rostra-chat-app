import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { RoomDiscoveryModal } from "./RoomDiscoveryModal";
import type { Room } from "../types";
import { useRoomsData } from "../hooks/useRoomsData";
import { RoomListPanel } from "./room-list/RoomListPanel";
import { RoomListFooter } from "./room-list/RoomListFooter";
import { RoomListCommandPalette } from "./room-list/RoomListCommandPalette";
import { CreateRoomModal } from "./room-list/CreateRoomModal";
import { LogoutModal } from "./room-list/LogoutModal";

interface RoomListProps {
  selectedRoom: Room | null;
  onSelectRoom: (room: Room) => void;
  sidebarOpen: boolean;
  openCommandPaletteSignal?: number;
  closeCommandPaletteSignal?: number;
  onToggleTheme?: () => void;
  onToggleCrt?: () => void;
  crtEnabled?: boolean;
  refreshTrigger?: number;
  unreadCounts: Record<number, number>;
  onUnreadCountsLoaded: (counts: Record<number, number>) => void;
  onInitialRoomsLoaded?: (rooms: Room[]) => void;
  onLogout: () => void;
  /** When sidebar is collapsed, clicking the user avatar calls this to expand (same as header "R" button) */
  onExpandSidebar?: () => void;
}

export default function RoomList({
  selectedRoom,
  onSelectRoom,
  sidebarOpen,
  openCommandPaletteSignal = 0,
  closeCommandPaletteSignal = 0,
  onToggleTheme,
  onToggleCrt,
  crtEnabled = false,
  refreshTrigger,
  unreadCounts,
  onUnreadCountsLoaded,
  onInitialRoomsLoaded,
  onLogout,
  onExpandSidebar,
}: RoomListProps) {
  const { token, user } = useAuth();
  const { theme } = useTheme();

  const {
    rooms,
    loading,
    error,
    creating,
    createError,
    newRoomName,
    setNewRoomName,
    retryLoadRooms,
    reloadRooms,
    createRoomFromInput,
    resetCreateState,
  } = useRoomsData({
    token,
    refreshTrigger,
    onUnreadCountsLoaded,
    onInitialRoomsLoaded,
    onSelectRoom,
  });

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");

  const prevSidebarOpenRef = useRef(sidebarOpen);
  const prevOpenCommandPaletteSignalRef = useRef(openCommandPaletteSignal);
  const prevCloseCommandPaletteSignalRef = useRef(closeCommandPaletteSignal);

  const closeCreateModal = useCallback(() => {
    setShowCreateModal(false);
    resetCreateState();
  }, [resetCreateState]);

  const closeLogoutModal = useCallback(() => {
    setShowLogoutModal(false);
  }, []);

  const closeCommandPalette = useCallback(() => {
    setShowCommandPalette(false);
    setCommandQuery("");
  }, []);

  // When sidebar transitions from open to closed (e.g. user taps message area on mobile), close discovery modal to avoid stray content. Do not close when sidebar is already collapsed and user opens discovery from the compass.
  useEffect(() => {
    if (prevSidebarOpenRef.current && !sidebarOpen && showDiscovery) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- this effect syncs local modal visibility with external sidebar transitions.
      setShowDiscovery(false);
    }
    prevSidebarOpenRef.current = sidebarOpen;
  }, [sidebarOpen, showDiscovery]);

  useEffect(() => {
    if (openCommandPaletteSignal === prevOpenCommandPaletteSignalRef.current) {
      return;
    }

    prevOpenCommandPaletteSignalRef.current = openCommandPaletteSignal;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- signal props are edge-triggered controls from parent orchestration.
    setShowCommandPalette(true);
    setCommandQuery("");
  }, [openCommandPaletteSignal]);

  useEffect(() => {
    if (
      closeCommandPaletteSignal === prevCloseCommandPaletteSignalRef.current
    ) {
      return;
    }

    prevCloseCommandPaletteSignalRef.current = closeCommandPaletteSignal;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- signal props are edge-triggered controls from parent orchestration.
    closeCommandPalette();
  }, [closeCommandPalette, closeCommandPaletteSignal]);

  const handleCreateRoom = async (event: FormEvent) => {
    event.preventDefault();
    const wasCreated = await createRoomFromInput();
    if (wasCreated) {
      closeCreateModal();
    }
  };

  const roomActiveBackground = theme === "neon" ? "#00f0ff0a" : "#ffbf000a";
  const roomHoverBackground = theme === "neon" ? "#00f0ff06" : "#ffbf0006";

  return (
    <>
      <RoomListPanel
        sidebarOpen={sidebarOpen}
        loading={loading}
        error={error}
        rooms={rooms}
        selectedRoom={selectedRoom}
        unreadCounts={unreadCounts}
        roomActiveBackground={roomActiveBackground}
        roomHoverBackground={roomHoverBackground}
        onSelectRoom={onSelectRoom}
        onRetry={retryLoadRooms}
      />

      <RoomListFooter
        sidebarOpen={sidebarOpen}
        theme={theme}
        user={user}
        onOpenCreateModal={() => setShowCreateModal(true)}
        onOpenDiscoveryModal={() => setShowDiscovery(true)}
        onOpenLogoutModal={() => setShowLogoutModal(true)}
        onExpandSidebar={onExpandSidebar}
      />

      <RoomListCommandPalette
        isOpen={showCommandPalette}
        query={commandQuery}
        onQueryChange={setCommandQuery}
        rooms={rooms}
        theme={theme}
        crtEnabled={crtEnabled}
        onClose={closeCommandPalette}
        onSelectRoom={onSelectRoom}
        onOpenCreateModal={() => setShowCreateModal(true)}
        onOpenDiscoveryModal={() => setShowDiscovery(true)}
        onToggleTheme={onToggleTheme}
        onToggleCrt={onToggleCrt}
      />

      <CreateRoomModal
        isOpen={showCreateModal}
        roomName={newRoomName}
        creating={creating}
        createError={createError}
        onRoomNameChange={setNewRoomName}
        onClose={closeCreateModal}
        onSubmit={handleCreateRoom}
      />

      <LogoutModal
        isOpen={showLogoutModal}
        onClose={closeLogoutModal}
        onConfirmLogout={onLogout}
      />

      {/* Room discovery remains integrated here so joined room ids always mirror current room state. */}
      {showDiscovery &&
        token &&
        user &&
        createPortal(
          <RoomDiscoveryModal
            isOpen={showDiscovery}
            onClose={() => setShowDiscovery(false)}
            onRoomJoined={() => {
              reloadRooms();
            }}
            currentUserId={user.id}
            joinedRoomIds={new Set(rooms.map((room) => room.id))}
            token={token}
          />,
          document.body,
        )}
    </>
  );
}

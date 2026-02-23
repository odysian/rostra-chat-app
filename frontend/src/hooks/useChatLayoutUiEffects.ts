import { useEffect } from "react";
import type { Room } from "../types";
import { formatRoomNameForDisplay } from "../utils/roomNames";

// Isolates passive UI side effects so ChatLayout orchestration stays focused on data flow.
type UiDensity = "compact" | "comfortable";

interface UseChatLayoutUiEffectsParams {
  selectedRoom: Room | null;
  density: UiDensity;
}

export function useChatLayoutUiEffects({
  selectedRoom,
  density,
}: UseChatLayoutUiEffectsParams) {
  // Density preference is user-owned UI state, so persist immediately when changed.
  useEffect(() => {
    localStorage.setItem("rostra-density", density);
  }, [density]);

  useEffect(() => {
    if (!selectedRoom) {
      document.title = "Rostra";
      return;
    }

    const roomName = formatRoomNameForDisplay(selectedRoom.name);
    document.title = `#${roomName} - Rostra`;
  }, [selectedRoom]);
}

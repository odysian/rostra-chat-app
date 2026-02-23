import { useEffect } from "react";
import type { Room } from "../types";
import { formatRoomNameForDisplay } from "../utils/roomNames";

type UiDensity = "compact" | "comfortable";

interface UseChatLayoutUiEffectsParams {
  selectedRoom: Room | null;
  density: UiDensity;
}

export function useChatLayoutUiEffects({
  selectedRoom,
  density,
}: UseChatLayoutUiEffectsParams) {
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

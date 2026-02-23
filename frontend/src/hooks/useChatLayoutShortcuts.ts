import { useEffect } from "react";
import type { Room } from "../types";

interface UseChatLayoutShortcutsParams {
  selectedRoom: Room | null;
  onOpenCommandPalette: () => void;
  onCloseCommandPalette: () => void;
  onOpenSearchPanel: () => void;
  onCloseRightPanel: () => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest("input, textarea, select, [contenteditable='true']"),
  );
}

export function useChatLayoutShortcuts({
  selectedRoom,
  onOpenCommandPalette,
  onCloseCommandPalette,
  onOpenSearchPanel,
  onCloseRightPanel,
}: UseChatLayoutShortcutsParams) {
  useEffect(() => {
    const handleGlobalShortcuts = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();
        onOpenCommandPalette();
        return;
      }

      if (isTypingTarget(event.target)) return;

      if (
        event.key === "/" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        selectedRoom
      ) {
        event.preventDefault();
        onOpenSearchPanel();
        return;
      }

      if (event.key === "Escape") {
        onCloseRightPanel();
        onCloseCommandPalette();
      }
    };

    window.addEventListener("keydown", handleGlobalShortcuts);
    return () => window.removeEventListener("keydown", handleGlobalShortcuts);
  }, [
    onCloseCommandPalette,
    onCloseRightPanel,
    onOpenCommandPalette,
    onOpenSearchPanel,
    selectedRoom,
  ]);
}

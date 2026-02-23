import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";

/**
 * Keeps local room-subscription intent and server-side WS subscriptions aligned.
 * Reconnect invariant: every reconnect must resend current room IDs exactly once.
 */
interface UseChatLayoutSubscriptionsParams {
  connected: boolean;
  subscribedRoomIds: number[];
  subscribe: (roomId: number) => void;
  setRefreshTrigger: Dispatch<SetStateAction<number>>;
  subscribedSentRef: MutableRefObject<Set<number>>;
  prevConnectedRef: MutableRefObject<boolean>;
  hasConnectedOnceRef: MutableRefObject<boolean>;
}

export function useChatLayoutSubscriptions({
  connected,
  subscribedRoomIds,
  subscribe,
  setRefreshTrigger,
  subscribedSentRef,
  prevConnectedRef,
  hasConnectedOnceRef,
}: UseChatLayoutSubscriptionsParams): void {
  useEffect(() => {
    let refreshTimeoutId: number | undefined;

    // Server subscriptions reset on reconnect, so we re-send local room subscriptions.
    if (!prevConnectedRef.current && connected) {
      subscribedSentRef.current.clear();
      if (hasConnectedOnceRef.current) {
        // Trigger Sidebar reload after reconnect so unread + room state resync from API.
        refreshTimeoutId = window.setTimeout(() => {
          setRefreshTrigger((prev) => prev + 1);
        }, 0);
      }
      hasConnectedOnceRef.current = true;
    }
    prevConnectedRef.current = connected;

    return () => {
      if (refreshTimeoutId) {
        clearTimeout(refreshTimeoutId);
      }
    };
  }, [connected, hasConnectedOnceRef, prevConnectedRef, setRefreshTrigger, subscribedSentRef]);

  useEffect(() => {
    if (!connected || subscribedRoomIds.length === 0) {
      return;
    }

    subscribedRoomIds.forEach((roomId) => {
      if (subscribedSentRef.current.has(roomId)) {
        return;
      }
      // Dedupe subscribe() calls across rerenders while keeping explicit room order local.
      subscribe(roomId);
      subscribedSentRef.current.add(roomId);
    });

    // Remove any stale "sent" markers for rooms no longer tracked locally.
    const subscribedIds = new Set(subscribedRoomIds);
    subscribedSentRef.current.forEach((roomId) => {
      if (!subscribedIds.has(roomId)) {
        subscribedSentRef.current.delete(roomId);
      }
    });
  }, [connected, subscribe, subscribedRoomIds, subscribedSentRef]);
}

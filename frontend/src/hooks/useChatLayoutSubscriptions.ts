import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";

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

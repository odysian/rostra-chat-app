import type { Dispatch, SetStateAction } from "react";
import type { Message, MessageContextResponse, OnlineUser, Room } from "../../types";

type MessageViewMode = "normal" | "context";
type TypingUsersByRoom = Record<
  number,
  Record<number, { username: string; timeout: ReturnType<typeof setTimeout> }>
>;

interface ResetSelectedRoomStateParams {
  setSelectedRoom: Dispatch<SetStateAction<Room | null>>;
  setMessageViewMode: Dispatch<SetStateAction<MessageViewMode>>;
  setMessageContext: Dispatch<SetStateAction<MessageContextResponse | null>>;
  setRoomOpenLastReadSnapshot: Dispatch<SetStateAction<string | null>>;
  setIncomingMessagesForRoom: Dispatch<SetStateAction<Message[]>>;
}

interface ClearRoomScopedStateParams {
  roomId: number;
  setOnlineUsersByRoom: Dispatch<SetStateAction<Record<number, OnlineUser[]>>>;
  setLastReadAtByRoomId: Dispatch<SetStateAction<Record<number, string | null>>>;
  setUnreadCounts: Dispatch<SetStateAction<Record<number, number>>>;
  setTypingUsersByRoom: Dispatch<SetStateAction<TypingUsersByRoom>>;
}

function omitRoomKey<T>(prev: Record<number, T>, roomId: number): Record<number, T> {
  if (!Object.prototype.hasOwnProperty.call(prev, roomId)) {
    return prev;
  }

  const next = { ...prev };
  delete next[roomId];
  return next;
}

export function resetSelectedRoomState({
  setSelectedRoom,
  setMessageViewMode,
  setMessageContext,
  setRoomOpenLastReadSnapshot,
  setIncomingMessagesForRoom,
}: ResetSelectedRoomStateParams): void {
  setSelectedRoom(null);
  setMessageViewMode("normal");
  setMessageContext(null);
  setRoomOpenLastReadSnapshot(null);
  setIncomingMessagesForRoom([]);
}

export function clearRoomScopedState({
  roomId,
  setOnlineUsersByRoom,
  setLastReadAtByRoomId,
  setUnreadCounts,
  setTypingUsersByRoom,
}: ClearRoomScopedStateParams): void {
  setOnlineUsersByRoom((prev) => omitRoomKey(prev, roomId));
  setLastReadAtByRoomId((prev) => omitRoomKey(prev, roomId));
  setUnreadCounts((prev) => omitRoomKey(prev, roomId));
  setTypingUsersByRoom((prev) => omitRoomKey(prev, roomId));
}

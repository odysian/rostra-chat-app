import {
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import type { WebSocketMessage } from "../context/WebSocketContext";
import { markRoomRead } from "../services/api";
import type {
  Message,
  OnlineUser,
  Room,
  WSDeletedMessagePayload,
  WSEditedMessagePayload,
  WSMessageReactionAdded,
  WSMessageReactionRemoved,
} from "../types";

/**
 * Owns ChatLayout's websocket event policy.
 * Invariants:
 * - Never drop delivered messages for the selected room.
 * - Keep unread counters scoped to subscribed-but-not-selected rooms.
 * - Keep typing indicators self-healing via timeout cleanup.
 */
type TypingUsersByRoom = Record<
  number,
  Record<number, { username: string; timeout: ReturnType<typeof setTimeout> }>
>;

interface UseChatLayoutMessageHandlerParams {
  registerMessageHandler: (handler: ((msg: WebSocketMessage) => void) | undefined) => void;
  selectedRoomRef: MutableRefObject<Room | null>;
  subscribedRoomIdsRef: MutableRefObject<number[]>;
  tokenRef: MutableRefObject<string | null>;
  typingTimeoutsRef: MutableRefObject<Set<ReturnType<typeof setTimeout>>>;
  setIncomingMessagesForRoom: Dispatch<SetStateAction<Message[]>>;
  setIncomingMessageDeletionsForRoom: Dispatch<SetStateAction<WSDeletedMessagePayload[]>>;
  setIncomingMessageEditsForRoom: Dispatch<SetStateAction<WSEditedMessagePayload[]>>;
  setIncomingMessageReactionsForRoom: Dispatch<
    SetStateAction<Array<WSMessageReactionAdded | WSMessageReactionRemoved>>
  >;
  setUnreadCounts: Dispatch<SetStateAction<Record<number, number>>>;
  setLastReadAtByRoomId: Dispatch<SetStateAction<Record<number, string | null>>>;
  setOnlineUsersByRoom: Dispatch<SetStateAction<Record<number, OnlineUser[]>>>;
  setTypingUsersByRoom: Dispatch<SetStateAction<TypingUsersByRoom>>;
  setWsError: Dispatch<SetStateAction<string | null>>;
}

export function useChatLayoutMessageHandler({
  registerMessageHandler,
  selectedRoomRef,
  subscribedRoomIdsRef,
  tokenRef,
  typingTimeoutsRef,
  setIncomingMessagesForRoom,
  setIncomingMessageDeletionsForRoom,
  setIncomingMessageEditsForRoom,
  setIncomingMessageReactionsForRoom,
  setUnreadCounts,
  setLastReadAtByRoomId,
  setOnlineUsersByRoom,
  setTypingUsersByRoom,
  setWsError,
}: UseChatLayoutMessageHandlerParams): void {
  useEffect(() => {
    const handleMessage = (message: WebSocketMessage) => {
      if (message.type === "error") {
        // WS errors are transient UX hints; auto-clear prevents sticky banners.
        setWsError(message.message);
        setTimeout(() => setWsError(null), 4000);
        return;
      }

      const messageRoomId =
        message.type === "new_message" ||
        message.type === "message_deleted" ||
        message.type === "message_edited"
          ? message.message.room_id
          : message.type === "reaction_added" || message.type === "reaction_removed"
            ? message.reaction.room_id
          : "room_id" in message
            ? message.room_id
            : null;

      if (message.type === "new_message" && messageRoomId != null) {
        if (messageRoomId === selectedRoomRef.current?.id) {
          // Append into queue; MessageList consumes and clears in-order.
          setIncomingMessagesForRoom((prev) => [...prev, message.message]);
          const token = tokenRef.current;
          if (token) {
            // Keep read marker server-authored to stay consistent across tabs/devices.
            markRoomRead(messageRoomId, token)
              .then((response) => {
                setLastReadAtByRoomId((prev) => ({
                  ...prev,
                  [messageRoomId]: response.last_read_at,
                }));
              })
              .catch(() => {});
          }
        } else if (subscribedRoomIdsRef.current.includes(messageRoomId)) {
          // Only increment unread for rooms the user explicitly tracks in the LRU set.
          setUnreadCounts((prev) => ({
            ...prev,
            [messageRoomId]: (prev[messageRoomId] ?? 0) + 1,
          }));
        }

        // Sender finished typing once their message is published.
        setTypingUsersByRoom((prev) => {
          const roomTyping = prev[messageRoomId];
          if (!roomTyping || !roomTyping[message.message.user_id]) {
            return prev;
          }
          clearTimeout(roomTyping[message.message.user_id].timeout);
          typingTimeoutsRef.current.delete(roomTyping[message.message.user_id].timeout);
          const updated = { ...roomTyping };
          delete updated[message.message.user_id];
          return { ...prev, [messageRoomId]: updated };
        });

        return;
      }

      if (message.type === "message_deleted" && messageRoomId != null) {
        if (messageRoomId === selectedRoomRef.current?.id) {
          // Keep deletion updates queued so MessageList mutates rows in place.
          setIncomingMessageDeletionsForRoom((prev) => [...prev, message.message]);
        }
        return;
      }

      if (message.type === "message_edited" && messageRoomId != null) {
        if (messageRoomId === selectedRoomRef.current?.id) {
          // Keep edit updates queued so MessageList mutates rows in place.
          setIncomingMessageEditsForRoom((prev) => [...prev, message.message]);
        }
        return;
      }

      if (
        (message.type === "reaction_added" || message.type === "reaction_removed") &&
        messageRoomId != null
      ) {
        if (messageRoomId === selectedRoomRef.current?.id) {
          setIncomingMessageReactionsForRoom((prev) => [...prev, message]);
        }
        return;
      }

      if (messageRoomId == null) {
        return;
      }

      switch (message.type) {
        case "subscribed":
          setOnlineUsersByRoom((prev) => ({
            ...prev,
            [messageRoomId]: message.online_users,
          }));
          break;
        case "user_joined":
          setOnlineUsersByRoom((prev) => {
            const existingUsers = prev[messageRoomId] ?? [];
            const alreadyExists = existingUsers.some((user) => user.id === message.user.id);
            return {
              ...prev,
              [messageRoomId]: alreadyExists
                ? existingUsers
                : [...existingUsers, message.user],
            };
          });
          break;
        case "user_left":
          setOnlineUsersByRoom((prev) => ({
            ...prev,
            [messageRoomId]: (prev[messageRoomId] ?? []).filter(
              (user) => user.id !== message.user.id,
            ),
          }));
          break;
        case "typing_indicator": {
          const { room_id: roomId, user } = message;

          setTypingUsersByRoom((prev) => {
            const roomTyping = { ...(prev[roomId] ?? {}) };
            if (roomTyping[user.id]) {
              // Renew timeout whenever a fresh typing event arrives for same user.
              clearTimeout(roomTyping[user.id].timeout);
              typingTimeoutsRef.current.delete(roomTyping[user.id].timeout);
            }

            const timeout = setTimeout(() => {
              setTypingUsersByRoom((current) => {
                const nextRoomTyping = { ...(current[roomId] ?? {}) };
                delete nextRoomTyping[user.id];
                return { ...current, [roomId]: nextRoomTyping };
              });
              typingTimeoutsRef.current.delete(timeout);
            }, 3000);

            typingTimeoutsRef.current.add(timeout);
            roomTyping[user.id] = { username: user.username, timeout };
            return { ...prev, [roomId]: roomTyping };
          });
          break;
        }
      }
    };

    registerMessageHandler(handleMessage);
    return () => registerMessageHandler(undefined);
  }, [
    registerMessageHandler,
    selectedRoomRef,
    setIncomingMessagesForRoom,
    setIncomingMessageDeletionsForRoom,
    setIncomingMessageEditsForRoom,
    setIncomingMessageReactionsForRoom,
    setLastReadAtByRoomId,
    setOnlineUsersByRoom,
    setTypingUsersByRoom,
    setUnreadCounts,
    setWsError,
    subscribedRoomIdsRef,
    tokenRef,
    typingTimeoutsRef,
  ]);
}

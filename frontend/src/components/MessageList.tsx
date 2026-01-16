import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { getRoomMessages } from "../services/api";
import type { Message, WebSocketMessage } from "../types";

// Local types
interface SystemMessage {
  id: string;
  type: "system";
  content: string;
  timestamp: number;
}

type ChatItem = Message | SystemMessage;

interface MessageListProps {
  roomId: number;
  lastMessage: WebSocketMessage | null;
}

export default function MessageList({ roomId, lastMessage }: MessageListProps) {
  const { token } = useAuth();
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchMessages() {
      if (!token) return;

      setLoading(true);
      setError("");

      try {
        const fetchedMessages = await getRoomMessages(roomId, token);
        const history = fetchedMessages.reverse();

        setMessages((prev) => {
          const uniqueMap = new Map<string | number, ChatItem>();
          history.forEach((msg) => uniqueMap.set(msg.id, msg));

          prev.forEach((msg) => {
            if (!uniqueMap.has(msg.id)) {
              uniqueMap.set(msg.id, msg);
            }
          });

          return Array.from(uniqueMap.values());
        });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load messages"
        );
      } finally {
        setLoading(false);
      }
    }

    fetchMessages();
  }, [roomId, token]);

  useEffect(() => {
    if (!lastMessage) return;

    // Filter Logic
    const msgRoomId =
      lastMessage.type === "new_message"
        ? lastMessage.message.room_id
        : "room_id" in lastMessage
        ? lastMessage.room_id
        : null;

    if (msgRoomId !== roomId) return;

    let newItem: ChatItem | null = null;

    if (lastMessage.type === "new_message") {
      newItem = lastMessage.message;
    } else if (lastMessage.type === "user_joined") {
      newItem = {
        id: `sys-join-${Date.now()}-${Math.random()}`, // Ensure unique ID
        type: "system",
        content: `${lastMessage.user.username} joined the room.`,
        timestamp: Date.now(),
      };
    } else if (lastMessage.type === "user_left") {
      newItem = {
        id: `sys-left-${Date.now()}-${Math.random()}`,
        type: "system",
        content: `${lastMessage.user.username} left the room.`,
        timestamp: Date.now(),
      };
    }

    if (newItem) {
      setMessages((prev) => {
        const exists = prev.some((item) => item.id === newItem!.id);
        if (exists) return prev;

        return [...prev, newItem!];
      });
    }
  }, [lastMessage, roomId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (loading && messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-zinc-400">Loading messages...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="bg-red-900/20 text-red-400 p-3 rounded border border-red-900">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 flex flex-col">
      {messages.map((item) => {
        // System Message
        if ("type" in item && item.type === "system") {
          return (
            <div key={item.id} className="flex justify-center my-2 opacity-75">
              <span className="text-xs text-zinc-500 bg-zinc-900/50 px-3 py-1 rounded-full border border-zinc-800/50">
                {item.content}
              </span>
            </div>
          );
        }
        // Standard Message
        const message = item as Message;
        return (
          <div
            key={message.id}
            className="flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-200"
          >
            <div className="flex items-baseline gap-2">
              <span className="font-semibold text-amber-500 text-sm">
                {message.username}
              </span>
              <span className="text-xs text-zinc-500">
                {new Date(message.created_at + "Z").toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <div className="text-zinc-200 mt-1">{message.content}</div>
          </div>
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
}

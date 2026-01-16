import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { getRoomMessages } from "../services/api";
import { useWebSocket } from "../hooks/useWebSocket";
import type { Message } from "../types";

interface MessageListProps {
  roomId: number;
}

export default function MessageList({ roomId }: MessageListProps) {
  const { token } = useAuth();
  const { lastMessage, subscribe } = useWebSocket();
  const [messages, setMessages] = useState<Message[]>([]);
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
        setMessages(fetchedMessages.reverse());
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
    subscribe(roomId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  useEffect(() => {
    if (lastMessage?.type === "new_message") {
      setMessages((prev) => [...prev, lastMessage.message]);
    }
  }, [lastMessage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (loading) {
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

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-zinc-400">
          No messages yet. Be the first to say hello!
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 flex flex-col">
      {messages.map((message) => (
        <div key={message.id} className="flex flex-col">
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
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}

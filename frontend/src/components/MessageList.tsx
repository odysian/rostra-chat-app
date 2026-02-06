import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { getRoomMessages } from "../services/api";
import type { Message } from "../types";

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
  incomingMessages?: Message[];
  onIncomingMessagesProcessed?: () => void;
}

export default function MessageList({
  roomId,
  incomingMessages = [],
  onIncomingMessagesProcessed,
}: MessageListProps) {
  const { token } = useAuth();
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [timeoutError, setTimeoutError] = useState(false);
  // Local retry counter so the effect can refetch when user clicks "Retry"
  const [retryCount, setRetryCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch History & Deduplicate
  useEffect(() => {
    let timeoutId: number;

    async function fetchMessages() {
      if (!token) return;

      // Reset timeout error state
      setTimeoutError(false);
      setLoading(true);
      setError("");

      // 5-second timeout for local testing
      timeoutId = window.setTimeout(() => {
        setTimeoutError(true);
        setError("Loading messages is taking longer than expected. The server may be waking up.");
        setLoading(false);
      }, 5000);

      try {
        const fetchedMessages = await getRoomMessages(roomId, token);
        const history = fetchedMessages.reverse();
        clearTimeout(timeoutId);

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
        setTimeoutError(false);
      } catch (err) {
        clearTimeout(timeoutId);
        setError(
          err instanceof Error ? err.message : "Failed to load messages",
        );
        setTimeoutError(false);
      } finally {
        if (!timeoutError) {
          setLoading(false);
        }
      }
    }

    fetchMessages();

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [roomId, token, retryCount]);

  const handleRetry = () => {
    setLoading(true);
    setError("");
    setTimeoutError(false);
    // Bump local retry counter so the effect above refetches messages
    setRetryCount((prev) => prev + 1);
  };



  // Append incoming messages (delivered per-message so none are dropped when many arrive quickly)
  useEffect(() => {
    if (incomingMessages.length === 0) return;
    setMessages((prev) => {
      const ids = new Set(prev.map((item) => item.id));
      const toAdd = incomingMessages.filter((m) => !ids.has(m.id));
      if (toAdd.length === 0) return prev;
      return [...prev, ...toAdd];
    });
    onIncomingMessagesProcessed?.();
  }, [incomingMessages, onIncomingMessagesProcessed]);

  // user_joined / user_left are not shown as chat messages; ChatLayout uses them only for the online users sidebar

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Date Formatting
  const getSmartDate = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const timeStr = date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });

    // Today
    if (date.toDateString() === now.toDateString()) {
      return `${timeStr}`;
    }

    // Yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday at ${timeStr}`;
    }

    // Older
    return `${date.toLocaleDateString()} ${timeStr}`;
  };

  const shouldGroupMessage = (
    current: ChatItem,
    prev: ChatItem | undefined,
  ) => {
    if (!prev) return false;
    if ("type" in current && current.type === "system") return false;
    if ("type" in prev && prev.type === "system") return false;

    const currMsg = current as Message;
    const prevMsg = prev as Message;

    if (currMsg.username !== prevMsg.username) return false;

    const currTime = new Date(currMsg.created_at).getTime();
    const prevTime = new Date(prevMsg.created_at).getTime();

    return currTime - prevTime < 5 * 60 * 1000;
  };

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
        <div className="bg-red-900/20 text-red-400 p-3 rounded border border-red-900 max-w-md">
          {error}
          <button
            onClick={handleRetry}
            className="mt-2 block w-full py-1 px-2 bg-red-600/20 hover:bg-red-600/30 rounded text-xs transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-4 flex flex-col">
      {messages.map((item, index) => {
        if ("type" in item && item.type === "system") {
          return (
            <div
              key={item.id}
              className="flex justify-center my-4 opacity-75 px-4"
            >
              <span className="text-xs text-zinc-500 bg-zinc-900/50 px-3 py-1 rounded-full border border-zinc-800/50">
                {item.content}
              </span>
            </div>
          );
        }

        const message = item as Message;
        const isoDate = message.created_at.endsWith("Z")
          ? message.created_at
          : message.created_at + "Z";
        const isGrouped = shouldGroupMessage(item, messages[index - 1]);

        const headerDate = getSmartDate(isoDate);

        const simpleTime = new Date(isoDate).toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        });

        return (
          <div
            key={message.id}
            className={`group flex items-start gap-3 px-4 hover:bg-white/5 transition-colors ${
              isGrouped ? "mt-0.5 py-0.5" : "mt-4 py-0.5"
            }`}
          >
            {/* Left Sidebar */}
            <div className="w-10 shrink-0 select-none flex justify-center">
              {!isGrouped ? (
                <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-amber-500 font-cinzel text-sm border border-zinc-700">
                  {message.username.substring(0, 2).toUpperCase()}
                </div>
              ) : (
                // Hover Timestamp
                <span className="hidden group-hover:block text-[10px] text-zinc-500 pt-1 text-center w-full">
                  {simpleTime}
                </span>
              )}
            </div>

            {/* Right Side */}
            <div className="flex flex-col min-w-0 flex-1">
              {!isGrouped && (
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-amber-500 text-sm hover:underline cursor-pointer">
                    {message.username}
                  </span>
                  <span className="text-xs text-zinc-500">{headerDate}</span>
                </div>
              )}

              <div
                className={`text-zinc-200 break-all leading-snug ${
                  isGrouped ? "" : "mt-1"
                }`}
              >
                {message.content}
              </div>
            </div>
          </div>
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
}

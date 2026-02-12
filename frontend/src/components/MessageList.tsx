import { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
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

type PendingScrollAdjustment =
  | { type: "initial" }
  | { type: "prepend"; previousScrollTop: number; previousScrollHeight: number }
  | { type: "append"; behavior: ScrollBehavior };

const JUMP_TO_LATEST_MIN_HIDDEN_MESSAGES = 250;

interface MessageListProps {
  roomId: number;
  incomingMessages?: Message[];
  onIncomingMessagesProcessed?: () => void;
  scrollToLatestSignal?: number;
}

export default function MessageList({
  roomId,
  incomingMessages = [],
  onIncomingMessagesProcessed,
  scrollToLatestSignal = 0,
}: MessageListProps) {
  const { token } = useAuth();
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [timeoutError, setTimeoutError] = useState(false);
  // Local retry counter so the effect can refetch when user clicks "Retry"
  const [retryCount, setRetryCount] = useState(0);

  // Pagination state
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isInitialPositioned, setIsInitialPositioned] = useState(false);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const pendingScrollAdjustmentRef = useRef<PendingScrollAdjustment | null>(null);

  const isNearBottom = useCallback((container: HTMLDivElement): boolean => {
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    return distanceFromBottom < 100;
  }, []);

  const updateJumpToLatestVisibility = useCallback(() => {
    const container = scrollContainerRef.current;

    if (!container || !isInitialPositioned || isNearBottom(container)) {
      setShowJumpToLatest(false);
      return;
    }

    const viewportBottom = container.scrollTop + container.clientHeight;
    const messageElements = container.querySelectorAll<HTMLElement>(
      "[data-chat-message='true']",
    );

    let hiddenMessageCount = 0;
    for (let i = messageElements.length - 1; i >= 0; i -= 1) {
      const element = messageElements[i];
      if (element.offsetTop < viewportBottom) {
        break;
      }
      hiddenMessageCount += 1;
    }

    setShowJumpToLatest(
      hiddenMessageCount >= JUMP_TO_LATEST_MIN_HIDDEN_MESSAGES,
    );
  }, [isInitialPositioned, isNearBottom]);

  // Apply scroll corrections after each message mutation so initial load, prepends,
  // and real-time appends do not fight each other.
  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    const adjustment = pendingScrollAdjustmentRef.current;
    if (!container || !adjustment) return;

    if (adjustment.type === "initial") {
      container.scrollTop = container.scrollHeight;
      setIsInitialPositioned(true);
    } else if (adjustment.type === "prepend") {
      const newScrollHeight = container.scrollHeight;
      const heightDelta = newScrollHeight - adjustment.previousScrollHeight;
      container.scrollTop = adjustment.previousScrollTop + heightDelta;
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: adjustment.behavior });
    }

    pendingScrollAdjustmentRef.current = null;
  }, [messages]);

  // Fetch history when room changes. Defer fetch to next tick so React Strict Mode's
  // double-invoke runs cleanup before the first fetch starts (avoids duplicate OPTIONS + GET).
  useEffect(() => {
    const abortController = new AbortController();
    let timeoutId: number | undefined;

    if (token) {
      setError("");
      setLoading(true);
      setNextCursor(null);
      setIsInitialPositioned(false);
      setShowJumpToLatest(false);
      pendingScrollAdjustmentRef.current = null;
    }

    async function fetchMessages() {
      if (!token) return;

      setTimeoutError(false);

      timeoutId = window.setTimeout(() => {
        setTimeoutError(true);
        setError("Loading messages is taking longer than expected. The server may be waking up.");
        setLoading(false);
      }, 5000);

      try {
        // Fetch initial messages (no cursor)
        const { messages: fetchedMessages, next_cursor } = await getRoomMessages(
          roomId,
          token,
          abortController.signal
        );
        const history = fetchedMessages.reverse();
        clearTimeout(timeoutId);

        pendingScrollAdjustmentRef.current = { type: "initial" };
        setMessages((prev) => {
          const historyIds = new Set<string | number>(history.map((msg) => msg.id));
          const liveMessages = prev.filter((msg) => !historyIds.has(msg.id));
          return [...history, ...liveMessages];
        });

        // Store cursor for pagination
        setNextCursor(next_cursor);
        setTimeoutError(false);
      } catch (err) {
        clearTimeout(timeoutId);
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
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

    const deferredId = window.setTimeout(fetchMessages, 0);

    return () => {
      clearTimeout(deferredId);
      abortController.abort();
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
    setIsInitialPositioned(false);
    setShowJumpToLatest(false);
    pendingScrollAdjustmentRef.current = null;
    // Bump local retry counter so the effect above refetches messages
    setRetryCount((prev) => prev + 1);
  };

  // Load older messages when scrolling to top
  const loadOlderMessages = useCallback(async () => {
    if (!token || !nextCursor || isLoadingMore || !isInitialPositioned) return;

    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    // Record current scroll position before fetching
    const previousScrollHeight = scrollContainer.scrollHeight;
    const previousScrollTop = scrollContainer.scrollTop;

    setIsLoadingMore(true);

    try {
      const { messages: olderMessages, next_cursor } = await getRoomMessages(
        roomId,
        token,
        undefined,
        nextCursor
      );

      // Reverse to get oldest-first order (API returns newest-first)
      const reversedOlderMessages = olderMessages.reverse();

      pendingScrollAdjustmentRef.current = {
        type: "prepend",
        previousScrollHeight,
        previousScrollTop,
      };
      setMessages((prev) => {
        const existingIds = new Set(prev.map((msg) => msg.id));
        const uniqueOlderMessages = reversedOlderMessages.filter(
          (msg) => !existingIds.has(msg.id),
        );

        if (uniqueOlderMessages.length === 0) {
          pendingScrollAdjustmentRef.current = null;
          return prev;
        }

        return [...uniqueOlderMessages, ...prev];
      });

      // Update cursor
      setNextCursor(next_cursor);
    } catch (err) {
      console.error("Failed to load older messages:", err);
      // Don't show error UI for pagination failures - user can just retry by scrolling
    } finally {
      setIsLoadingMore(false);
    }
  }, [token, roomId, nextCursor, isLoadingMore, isInitialPositioned]);



  // Append incoming messages (delivered per-message so none are dropped when many arrive quickly)
  useEffect(() => {
    if (incomingMessages.length === 0) return;
    const scrollContainer = scrollContainerRef.current;
    const shouldStickToBottom = scrollContainer ? isNearBottom(scrollContainer) : false;

    setMessages((prev) => {
      const ids = new Set(prev.map((item) => item.id));
      const toAdd = incomingMessages.filter((m) => !ids.has(m.id));
      if (toAdd.length === 0) return prev;

      if (shouldStickToBottom) {
        pendingScrollAdjustmentRef.current = { type: "append", behavior: "smooth" };
      }

      return [...prev, ...toAdd];
    });
    onIncomingMessagesProcessed?.();
  }, [incomingMessages, onIncomingMessagesProcessed, isNearBottom]);

  // Sending a local message should always bring the user back to latest chat context.
  useEffect(() => {
    if (!isInitialPositioned) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    container.scrollTop = container.scrollHeight;
    setShowJumpToLatest(false);
  }, [scrollToLatestSignal, isInitialPositioned]);

  useEffect(() => {
    updateJumpToLatestVisibility();
  }, [messages, updateJumpToLatestVisibility]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !isInitialPositioned) return;

    const handleScroll = () => {
      updateJumpToLatestVisibility();
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [isInitialPositioned, updateJumpToLatestVisibility]);

  const handleJumpToLatest = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    setShowJumpToLatest(false);
  };

  // user_joined / user_left are not shown as chat messages; ChatLayout uses them only for the online users sidebar

  // IntersectionObserver to detect scroll-to-top
  useEffect(() => {
    if (!isInitialPositioned) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // When sentinel becomes visible, load older messages
        if (entries[0].isIntersecting && nextCursor && !isLoadingMore) {
          loadOlderMessages();
        }
      },
      {
        root: scrollContainerRef.current,
        rootMargin: "100px", // Start loading before sentinel is fully visible
        threshold: 0,
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [nextCursor, isLoadingMore, loadOlderMessages, isInitialPositioned]);

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
    <div className="relative flex-1 min-h-0">
      <div
        ref={scrollContainerRef}
        className="h-full overflow-y-auto overflow-x-hidden py-4 flex flex-col"
      >
        {/* Sentinel for IntersectionObserver - triggers load when scrolled to top */}
        <div ref={sentinelRef} className="h-px" />

        {/* Loading indicator or "beginning of conversation" message */}
        {isLoadingMore && (
          <div className="flex justify-center py-4">
            <span className="text-xs text-zinc-500">Loading older messages...</span>
          </div>
        )}
        {!isLoadingMore && nextCursor === null && messages.length > 0 && (
          <div className="flex justify-center py-4">
            <span className="text-xs text-zinc-500 bg-zinc-900/50 px-3 py-1 rounded-full border border-zinc-800/50">
              This is the beginning of the conversation
            </span>
          </div>
        )}

        {/* Spacer to push messages to bottom when container isn't full */}
        <div className="grow" />
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
              data-chat-message="true"
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

      {showJumpToLatest && (
        <button
          type="button"
          onClick={handleJumpToLatest}
          className="absolute bottom-4 right-4 z-10 rounded-full bg-amber-500 px-3 py-2 text-xs font-semibold text-zinc-900 shadow-lg shadow-black/40 transition-colors hover:bg-amber-400"
        >
          Jump to latest
        </button>
      )}
    </div>
  );
}

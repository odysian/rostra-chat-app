import { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { getRoomMessages } from "../services/api";
import { getUserColorPalette } from "../utils/userColors";
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
  const { theme } = useTheme();
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

  // IntersectionObserver to detect scroll-to-top
  useEffect(() => {
    if (!isInitialPositioned) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && nextCursor && !isLoadingMore) {
          loadOlderMessages();
        }
      },
      {
        root: scrollContainerRef.current,
        rootMargin: "100px",
        threshold: 0,
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [nextCursor, isLoadingMore, loadOlderMessages, isInitialPositioned]);

  // Message header timestamp: keep compact and time-only.
  const getMessageTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  // Full timestamp used for browser tooltips on hover.
  const getFullDateTime = (isoString: string) => {
    const date = new Date(isoString);
    const longDate = date.toLocaleDateString([], {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    const time = date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
    return `${longDate}\n${time}`;
  };

  // Get date string for date dividers
  const getDateLabel = (isoString: string) => {
    const dateStr = isoString.endsWith("Z") ? isoString : isoString + "Z";
    const date = new Date(dateStr);
    const now = new Date();

    if (date.toDateString() === now.toDateString()) return "TODAY";

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return "YESTERDAY";

    return date
      .toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
      .toUpperCase();
  };

  // Check if a date divider should be shown before this message
  const shouldShowDateDivider = (current: ChatItem, prev: ChatItem | undefined): boolean => {
    if (!prev) return true; // Always show for first message
    if ("type" in current && current.type === "system") return false;
    if ("type" in prev && prev.type === "system") return false;

    const currMsg = current as Message;
    const prevMsg = prev as Message;
    const currDate = new Date(currMsg.created_at.endsWith("Z") ? currMsg.created_at : currMsg.created_at + "Z");
    const prevDate = new Date(prevMsg.created_at.endsWith("Z") ? prevMsg.created_at : prevMsg.created_at + "Z");

    return currDate.toDateString() !== prevDate.toDateString();
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
        <p className="font-mono text-[12px]" style={{ color: "var(--color-meta)" }}>
          Loading messages...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div
          className="p-3 text-sm max-w-md"
          style={{
            background: "rgba(255, 0, 0, 0.05)",
            color: "#ff4444",
            border: "1px solid rgba(255, 0, 0, 0.2)",
          }}
        >
          {error}
          <button
            onClick={handleRetry}
            className="mt-2 block w-full py-1 px-2 text-xs transition-colors"
            style={{ background: "rgba(255, 0, 0, 0.1)" }}
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
        className="h-full overflow-y-auto overflow-x-hidden flex flex-col"
        style={{ padding: "20px 20px 12px" }}
      >
        {/* Sentinel for IntersectionObserver */}
        <div ref={sentinelRef} className="h-px" />

        {/* Loading indicator or "beginning of conversation" message */}
        {isLoadingMore && (
          <div className="flex justify-center py-4">
            <span className="font-mono text-[11px]" style={{ color: "var(--color-meta)" }}>
              Loading older messages...
            </span>
          </div>
        )}
        {!isLoadingMore && nextCursor == null && (
          <div className="flex justify-center py-4">
            <span
              className="font-pixel text-[7px] tracking-[0.20em] px-3 py-1"
              style={{ color: "var(--color-meta)", border: "1px solid var(--border-dim)" }}
            >
              BEGINNING OF CONVERSATION
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
                <span
                  className="font-pixel text-[7px] tracking-[0.15em] px-3 py-1"
                  style={{ color: "var(--color-meta)", border: "1px solid var(--border-dim)" }}
                >
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
          const showDateDivider = shouldShowDateDivider(item, messages[index - 1]);
          // Keep amber visuals cohesive by using per-user hues only in neon mode.
          const userColors =
            theme === "neon" ? getUserColorPalette(message.username) : null;

          const headerTime = getMessageTime(isoDate);
          const hoverTime = new Date(isoDate).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          });
          const fullDateTime = getFullDateTime(isoDate);

          return (
            <div key={message.id}>
              {/* Date divider */}
              {showDateDivider && (
                <div className="flex items-center gap-3 my-6">
                  <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, transparent, var(--border-dim))" }} />
                  <span
                    className="font-pixel text-[7px] tracking-[0.20em]"
                    style={{ color: "var(--color-meta)" }}
                  >
                    {getDateLabel(isoDate)}
                  </span>
                  <div className="flex-1 h-px" style={{ background: "linear-gradient(270deg, transparent, var(--border-dim))" }} />
                </div>
              )}

              {/* Flush-left message row (Discord-style) */}
              <div
                data-chat-message="true"
                className={`group flex items-start gap-3 px-4 hover:bg-white/[0.02] transition-colors ${
                  isGrouped ? "mt-0.5 py-0.5" : "mt-4 py-0.5"
                }`}
                style={{ animation: "slide-in 0.2s ease-out" }}
              >
                {/* Left: avatar or hover timestamp */}
                <div className="w-11 shrink-0 select-none flex justify-center">
                  {!isGrouped ? (
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center font-bebas text-[16px]"
                      style={{
                        background: userColors?.backgroundColor ?? "var(--bg-app)",
                        border: `1px solid ${userColors?.borderColor ?? "var(--border-primary)"}`,
                        color: userColors?.textColor ?? "var(--color-primary)",
                        boxShadow: userColors?.glowColor ?? "none",
                      }}
                    >
                      {message.username.substring(0, 2).toUpperCase()}
                    </div>
                  ) : (
                    <span
                      className="block font-mono text-[12px] pt-1 text-center w-full whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                      style={{ color: "var(--color-meta)" }}
                      title={fullDateTime}
                    >
                      {hoverTime}
                    </span>
                  )}
                </div>

                {/* Right: meta + content */}
                <div className="flex flex-col min-w-0 flex-1">
                  {!isGrouped && (
                    <div className="flex items-baseline gap-2">
                      <span
                        className="font-mono font-semibold text-[14px] tracking-[0.06em]"
                        style={{ color: userColors?.textColor ?? "var(--color-primary)" }}
                      >
                        {message.username}
                      </span>
                      <span
                        className="font-mono text-[12px] tracking-[0.08em]"
                        style={{ color: "var(--color-meta)" }}
                        title={fullDateTime}
                      >
                        {headerTime}
                      </span>
                    </div>
                  )}

                  <div
                    className={`font-mono text-[18px] leading-relaxed break-all ${
                      isGrouped ? "" : "mt-1"
                    }`}
                    style={{ color: "var(--color-msg-text)" }}
                  >
                    {message.content}
                  </div>
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
          className="absolute bottom-4 right-4 z-10 px-3 py-2 font-bebas text-[14px] tracking-[0.10em] shadow-lg transition-colors"
          style={{
            background: "var(--color-primary)",
            color: "#000",
            boxShadow: "var(--glow-primary)",
          }}
        >
          JUMP TO LATEST
        </button>
      )}
    </div>
  );
}

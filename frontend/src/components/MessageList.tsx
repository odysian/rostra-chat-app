import { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { getRoomMessages, getRoomMessagesNewer } from "../services/api";
import { logError } from "../utils/logger";
import { getUserColorPalette } from "../utils/userColors";
import type { Message, MessageContextResponse } from "../types";

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
  | { type: "context-target"; targetMessageId: number }
  | {
      type: "prepend";
      previousScrollTop: number;
      previousScrollHeight: number;
      anchorMessageId: number | null;
      anchorTop: number | null;
    }
  | { type: "append"; behavior: ScrollBehavior };

const JUMP_TO_LATEST_MIN_HIDDEN_MESSAGES = 50;
const INITIAL_HISTORY_PAGE_SIZE = 75;
const OLDER_HISTORY_PAGE_SIZE = 100;
const TOP_PREFETCH_ROOT_MARGIN = "900px";

function ensureUtcIso(isoString: string): string {
  return isoString.endsWith("Z") ? isoString : `${isoString}Z`;
}

function isStrictlyNewerThan(
  candidate: Message,
  reference: Message,
): boolean {
  const candidateTime = new Date(ensureUtcIso(candidate.created_at)).getTime();
  const referenceTime = new Date(ensureUtcIso(reference.created_at)).getTime();
  if (candidateTime !== referenceTime) {
    return candidateTime > referenceTime;
  }
  return candidate.id > reference.id;
}

interface MessageListProps {
  roomId: number;
  density: "compact" | "comfortable";
  messageViewMode?: "normal" | "context";
  messageContext?: MessageContextResponse | null;
  lastReadAtSnapshot?: string | null;
  incomingMessages?: Message[];
  onIncomingMessagesProcessed?: () => void;
  scrollToLatestSignal?: number;
  onExitContextMode?: () => void;
}

function normalizeToUtcIso(isoString: string): string {
  const hasTimezoneSuffix = /(?:Z|[+-]\d{2}:\d{2})$/i.test(isoString);
  return hasTimezoneSuffix ? isoString : `${isoString}Z`;
}

function parseTimestamp(isoString: string | null | undefined): number | null {
  if (!isoString) return null;
  const timestamp = Date.parse(normalizeToUtcIso(isoString));
  return Number.isNaN(timestamp) ? null : timestamp;
}

function findFirstUnreadMessageId(
  items: ChatItem[],
  snapshot: string | null | undefined,
  currentUserId: number | null | undefined,
): number | null {
  const snapshotTimestamp = parseTimestamp(snapshot);
  if (snapshotTimestamp == null) return null;

  const unreadMessage = items.find((item) => {
    if ("type" in item && item.type === "system") return false;
    if (currentUserId != null && (item as Message).user_id === currentUserId) {
      return false;
    }
    const messageTimestamp = parseTimestamp((item as Message).created_at);
    return messageTimestamp != null && messageTimestamp > snapshotTimestamp;
  });

  if (!unreadMessage || ("type" in unreadMessage && unreadMessage.type === "system")) {
    return null;
  }

  return (unreadMessage as Message).id;
}

export default function MessageList({
  roomId,
  density,
  messageViewMode = "normal",
  messageContext = null,
  lastReadAtSnapshot = null,
  incomingMessages = [],
  onIncomingMessagesProcessed,
  scrollToLatestSignal = 0,
  onExitContextMode,
}: MessageListProps) {
  const { token, user } = useAuth();
  const { theme } = useTheme();
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Local retry counter so the effect can refetch when user clicks "Retry"
  const [retryCount, setRetryCount] = useState(0);

  // Pagination state
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [newerCursor, setNewerCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isLoadingNewer, setIsLoadingNewer] = useState(false);
  const [isInitialPositioned, setIsInitialPositioned] = useState(false);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<number | null>(null);
  const [contextLiveMessages, setContextLiveMessages] = useState<Message[]>([]);
  /**
   * Divider anchor is resolved once per room-entry so the "NEW MESSAGES"
   * marker does not reposition while the user keeps viewing this room.
   */
  const [newMessagesAnchorId, setNewMessagesAnchorId] = useState<number | null>(null);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const pendingScrollAdjustmentRef = useRef<PendingScrollAdjustment | null>(null);
  /** Ref avoids stale state reads in async finally blocks. */
  const timeoutFiredRef = useRef(false);
  const previousScrollToLatestSignalRef = useRef(scrollToLatestSignal);
  const contextLiveMessagesRef = useRef<Message[]>([]);
  const jumpVisibilitySuppressedRef = useRef(false);

  useEffect(() => {
    contextLiveMessagesRef.current = contextLiveMessages;
  }, [contextLiveMessages]);

  const isNearBottom = useCallback((container: HTMLDivElement): boolean => {
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    return distanceFromBottom < 100;
  }, []);

  const capturePrependAnchor = useCallback(
    (container: HTMLDivElement): { anchorMessageId: number | null; anchorTop: number | null } => {
      const containerTop = container.getBoundingClientRect().top;
      const messageElements = Array.from(
        container.querySelectorAll<HTMLElement>("[data-chat-message='true'][data-message-id]"),
      );

      const anchorElement =
        messageElements.find(
          (el) => el.getBoundingClientRect().bottom >= containerTop,
        ) ?? messageElements[0];

      if (!anchorElement) {
        return { anchorMessageId: null, anchorTop: null };
      }

      const rawId = anchorElement.dataset.messageId;
      const parsedId = rawId ? Number(rawId) : Number.NaN;
      if (!Number.isFinite(parsedId)) {
        return { anchorMessageId: null, anchorTop: null };
      }

      return {
        anchorMessageId: parsedId,
        anchorTop: anchorElement.getBoundingClientRect().top,
      };
    },
    [],
  );

  const updateJumpToLatestVisibility = useCallback(() => {
    const container = scrollContainerRef.current;
    const shouldShowJumpActionForMode =
      messageViewMode === "normal" || messageViewMode === "context";

    if (
      !shouldShowJumpActionForMode ||
      !container ||
      jumpVisibilitySuppressedRef.current ||
      !isInitialPositioned
    ) {
      setShowJumpToLatest(false);
      return;
    }

    if (messageViewMode === "context") {
      // Context mode should offer a direct exit path to latest chat as soon as
      // we know there are newer pages outside the loaded context slice.
      if (newerCursor !== null) {
        setShowJumpToLatest(true);
        return;
      }
      if (isNearBottom(container)) {
        setShowJumpToLatest(false);
        return;
      }
      setShowJumpToLatest(true);
      return;
    }

    if (isNearBottom(container)) {
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
  }, [isInitialPositioned, isNearBottom, messageViewMode, newerCursor]);

  // Apply scroll corrections after each message mutation so initial load, prepends,
  // and real-time appends do not fight each other.
  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    const adjustment = pendingScrollAdjustmentRef.current;
    if (!container || !adjustment) return;

    if (adjustment.type === "initial") {
      container.scrollTop = container.scrollHeight;
      setIsInitialPositioned(true);
    } else if (adjustment.type === "context-target") {
      const targetElement = container.querySelector<HTMLElement>(
        `[data-message-id='${adjustment.targetMessageId}']`,
      );
      if (targetElement) {
        targetElement.scrollIntoView({ block: "center", behavior: "auto" });
      } else {
        container.scrollTop = container.scrollHeight;
      }
      setIsInitialPositioned(true);
    } else if (adjustment.type === "prepend") {
      if (
        adjustment.anchorMessageId !== null &&
        adjustment.anchorTop !== null
      ) {
        const anchorElement = container.querySelector<HTMLElement>(
          `[data-message-id='${adjustment.anchorMessageId}']`,
        );
        if (anchorElement) {
          const newAnchorTop = anchorElement.getBoundingClientRect().top;
          // Keep the same message "pinned" in viewport after prepending variable-height rows.
          container.scrollTop += newAnchorTop - adjustment.anchorTop;
        } else {
          const newScrollHeight = container.scrollHeight;
          const heightDelta = newScrollHeight - adjustment.previousScrollHeight;
          container.scrollTop = adjustment.previousScrollTop + heightDelta;
        }
      } else {
        const newScrollHeight = container.scrollHeight;
        const heightDelta = newScrollHeight - adjustment.previousScrollHeight;
        container.scrollTop = adjustment.previousScrollTop + heightDelta;
      }
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: adjustment.behavior });
    }

    pendingScrollAdjustmentRef.current = null;
  }, [messages]);

  // Density changes alter message heights; pin to latest so on-screen context
  // does not drift upward when switching between tight and comfy modes.
  useLayoutEffect(() => {
    if (!isInitialPositioned) return;
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
    setShowJumpToLatest(false);
  }, [density, isInitialPositioned]);

  useEffect(() => {
    if (messageViewMode !== "context" || !messageContext) return;

    setError("");
    setLoading(false);
    setIsInitialPositioned(false);
    setShowJumpToLatest(false);
    setContextLiveMessages([]);
    setNextCursor(messageContext.older_cursor);
    setNewerCursor(messageContext.newer_cursor);
    setHighlightedMessageId(messageContext.target_message_id);
    pendingScrollAdjustmentRef.current = {
      type: "context-target",
      targetMessageId: messageContext.target_message_id,
    };
    setMessages(messageContext.messages);
  }, [messageContext, messageViewMode]);

  // Fetch history when room changes in normal mode. Defer fetch to next tick so
  // React Strict Mode cleanup runs before the first fetch starts.
  useEffect(() => {
    if (messageViewMode !== "normal") return;

    const abortController = new AbortController();
    let timeoutId: number | undefined;
    const bufferedContextTail = contextLiveMessagesRef.current;

    if (token) {
      setError("");
      setLoading(true);
      setNextCursor(null);
      setNewerCursor(null);
      setContextLiveMessages([]);
      setHighlightedMessageId(null);
      setIsInitialPositioned(false);
      setShowJumpToLatest(false);
      setNewMessagesAnchorId(null);
      pendingScrollAdjustmentRef.current = null;
    }

    async function fetchMessages() {
      if (!token) return;

      timeoutFiredRef.current = false;

      timeoutId = window.setTimeout(() => {
        timeoutFiredRef.current = true;
        setError("Loading messages is taking longer than expected. The server may be waking up.");
        setLoading(false);
      }, 5000);

      try {
        const { messages: fetchedMessages, next_cursor } = await getRoomMessages(
          roomId,
          token,
          abortController.signal,
          undefined,
          INITIAL_HISTORY_PAGE_SIZE,
        );
        const history = fetchedMessages.reverse();
        clearTimeout(timeoutId);

        // Resolve divider anchor from entry-time history only, so live messages
        // that arrive while loading cannot retroactively create/move the marker.
        setNewMessagesAnchorId(
          findFirstUnreadMessageId(history, lastReadAtSnapshot, user?.id),
        );

        pendingScrollAdjustmentRef.current = { type: "initial" };
        setMessages((prev) => {
          const historyIds = new Set<string | number>(history.map((msg) => msg.id));

          if (history.length === 0) {
            return history;
          }

          const newestHistoryMessage = history[history.length - 1];
          const trueLiveTail = prev.filter((item) => {
            if ("type" in item) return false;
            const liveMessage = item as Message;
            if (historyIds.has(liveMessage.id)) return false;
            return isStrictlyNewerThan(liveMessage, newestHistoryMessage);
          }) as Message[];

          const bufferedTail = bufferedContextTail.filter((message) => {
            if (historyIds.has(message.id)) return false;
            return isStrictlyNewerThan(message, newestHistoryMessage);
          });

          const uniqueTailById = new Map<number, Message>();
          [...trueLiveTail, ...bufferedTail].forEach((message) => {
            uniqueTailById.set(message.id, message);
          });

          return [...history, ...Array.from(uniqueTailById.values())];
        });

        setNextCursor(next_cursor);
      } catch (err) {
        clearTimeout(timeoutId);
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        setError(
          err instanceof Error ? err.message : "Failed to load messages",
        );
      } finally {
        if (!timeoutFiredRef.current) {
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
  }, [roomId, token, retryCount, messageViewMode, lastReadAtSnapshot, user?.id]);

  const handleRetry = () => {
    setLoading(true);
    setError("");
    setIsInitialPositioned(false);
    setShowJumpToLatest(false);
    setNewMessagesAnchorId(null);
    pendingScrollAdjustmentRef.current = null;
    // Bump local retry counter so the effect above refetches messages
    setRetryCount((prev) => prev + 1);
  };

  useEffect(() => {
    if (highlightedMessageId == null) return;

    const timeoutId = window.setTimeout(() => {
      setHighlightedMessageId(null);
    }, 2200);

    return () => clearTimeout(timeoutId);
  }, [highlightedMessageId]);

  // Load older messages when scrolling to top
  const loadOlderMessages = useCallback(async () => {
    if (!token || !nextCursor || isLoadingMore || !isInitialPositioned) return;

    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    // Record current scroll position before fetching
    const previousScrollHeight = scrollContainer.scrollHeight;
    const previousScrollTop = scrollContainer.scrollTop;
    const { anchorMessageId, anchorTop } = capturePrependAnchor(scrollContainer);

    setIsLoadingMore(true);

    try {
      const { messages: olderMessages, next_cursor } = await getRoomMessages(
        roomId,
        token,
        undefined,
        nextCursor,
        OLDER_HISTORY_PAGE_SIZE,
      );

      // Reverse to get oldest-first order (API returns newest-first)
      const reversedOlderMessages = olderMessages.reverse();

      pendingScrollAdjustmentRef.current = {
        type: "prepend",
        previousScrollHeight,
        previousScrollTop,
        anchorMessageId,
        anchorTop,
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
      logError("Failed to load older messages:", err);
      // Don't show error UI for pagination failures - user can just retry by scrolling
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    token,
    roomId,
    nextCursor,
    isLoadingMore,
    isInitialPositioned,
    capturePrependAnchor,
  ]);

  const loadNewerMessages = useCallback(async () => {
    if (
      messageViewMode !== "context" ||
      !token ||
      !newerCursor ||
      isLoadingNewer ||
      !isInitialPositioned
    ) {
      return;
    }

    setIsLoadingNewer(true);

    try {
      const { messages: newerMessages, next_cursor } = await getRoomMessagesNewer(
        roomId,
        token,
        newerCursor,
      );

      setMessages((prev) => {
        const existingIds = new Set(prev.map((msg) => msg.id));
        const uniqueNewerMessages = newerMessages.filter(
          (msg) => !existingIds.has(msg.id),
        );

        if (uniqueNewerMessages.length === 0) {
          return prev;
        }

        return [...prev, ...uniqueNewerMessages];
      });
      setNewerCursor(next_cursor);
    } catch (err) {
      logError("Failed to load newer messages:", err);
    } finally {
      setIsLoadingNewer(false);
    }
  }, [isInitialPositioned, isLoadingNewer, messageViewMode, newerCursor, roomId, token]);



  // Append incoming messages (delivered per-message so none are dropped when many arrive quickly)
  useEffect(() => {
    if (incomingMessages.length === 0) return;

    if (messageViewMode === "context") {
      const scrollContainer = scrollContainerRef.current;
      const contextIsAtLatest =
        newerCursor === null &&
        scrollContainer !== null &&
        isNearBottom(scrollContainer);

      if (contextIsAtLatest) {
        setMessages((prev) => {
          const ids = new Set(prev.map((item) => item.id));
          const toAdd = incomingMessages.filter((m) => !ids.has(m.id));
          if (toAdd.length === 0) return prev;

          pendingScrollAdjustmentRef.current = { type: "append", behavior: "smooth" };
          return [...prev, ...toAdd];
        });
      } else {
        setContextLiveMessages((prev) => {
          const ids = new Set(prev.map((msg) => msg.id));
          const toAdd = incomingMessages.filter((msg) => !ids.has(msg.id));
          if (toAdd.length === 0) return prev;
          return [...prev, ...toAdd];
        });
      }
      onIncomingMessagesProcessed?.();
      return;
    }

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
  }, [
    incomingMessages,
    isNearBottom,
    messageViewMode,
    newerCursor,
    onIncomingMessagesProcessed,
  ]);

  // Sending a local message should always bring the user back to latest chat context.
  useEffect(() => {
    if (previousScrollToLatestSignalRef.current === scrollToLatestSignal) return;
    previousScrollToLatestSignalRef.current = scrollToLatestSignal;
    if (!isInitialPositioned) return;

    if (messageViewMode === "context") {
      onExitContextMode?.();
      return;
    }

    const container = scrollContainerRef.current;
    if (!container) return;

    container.scrollTop = container.scrollHeight;
    setShowJumpToLatest(false);
  }, [scrollToLatestSignal, isInitialPositioned, messageViewMode, onExitContextMode]);

  useEffect(() => {
    updateJumpToLatestVisibility();
  }, [messages, updateJumpToLatestVisibility, messageViewMode]);

  useEffect(() => {
    if (messageViewMode !== "normal" && messageViewMode !== "context") return;

    const container = scrollContainerRef.current;
    if (!container || !isInitialPositioned) return;

    const handleScroll = () => {
      if (jumpVisibilitySuppressedRef.current) {
        if (isNearBottom(container)) {
          jumpVisibilitySuppressedRef.current = false;
        } else {
          setShowJumpToLatest(false);
          return;
        }
      }
      updateJumpToLatestVisibility();
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [isInitialPositioned, isNearBottom, messageViewMode, updateJumpToLatestVisibility]);

  const handleJumpToLatest = () => {
    if (messageViewMode === "context") {
      onExitContextMode?.();
      return;
    }

    const container = scrollContainerRef.current;
    if (!container) return;

    // Keep jump affordance hidden until animated programmatic scroll actually
    // reaches latest, so long-distance jumps do not flash the button mid-flight.
    jumpVisibilitySuppressedRef.current = true;
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
        // Start loading older history well before hard-top so users keep scrolling smoothly.
        rootMargin: TOP_PREFETCH_ROOT_MARGIN,
        threshold: 0,
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [nextCursor, isLoadingMore, loadOlderMessages, isInitialPositioned]);

  useEffect(() => {
    if (!isInitialPositioned || messageViewMode !== "context") return;

    const sentinel = bottomSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && newerCursor && !isLoadingNewer) {
          loadNewerMessages();
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
  }, [
    isInitialPositioned,
    isLoadingNewer,
    loadNewerMessages,
    messageViewMode,
    newerCursor,
  ]);

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
    const date = new Date(normalizeToUtcIso(isoString));
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
    const currDate = new Date(normalizeToUtcIso(currMsg.created_at));
    const prevDate = new Date(normalizeToUtcIso(prevMsg.created_at));

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

  const isComfortableDensity = density === "comfortable";
  const showContextLiveIndicator =
    messageViewMode === "context" && contextLiveMessages.length > 0;
  const shouldShowJumpAction = showJumpToLatest || showContextLiveIndicator;
  const jumpActionLabel = showContextLiveIndicator
    ? "New messages available"
    : "JUMP TO LATEST";

  return (
    <div className="relative flex-1 min-h-0">
      <div
        ref={scrollContainerRef}
        className="h-full overflow-y-auto overflow-x-hidden flex flex-col"
        style={{
          padding: isComfortableDensity ? "20px 20px 12px 10px" : "16px 16px 10px 8px",
          // We manually preserve scroll position during prepends; disable native anchoring
          // to avoid double-adjustments that cause visible stutter.
          overflowAnchor: "none",
        }}
      >
        {/* Sentinel for IntersectionObserver */}
        <div ref={sentinelRef} className="h-px" />

        {/* "Beginning of conversation" marker */}
        {!isLoadingMore && nextCursor == null && (
          <div className="flex justify-center py-4">
            <span
              className="font-pixel text-[8px] tracking-[0.16em] px-3 py-1.5"
              style={{
                color: "var(--color-text)",
                border: "1px solid var(--border-dim)",
                background: "var(--bg-bubble)",
              }}
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
                  className="font-pixel text-[8px] tracking-[0.14em] px-3 py-1"
                  style={{
                    color: "var(--color-meta)",
                    border: "1px solid var(--border-dim)",
                  }}
                >
                  {item.content}
                </span>
              </div>
            );
          }

          const message = item as Message;
          const isoDate = normalizeToUtcIso(message.created_at);
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
              {newMessagesAnchorId === message.id && (
                <div
                  className={`flex items-center ${isComfortableDensity ? "gap-3 my-6" : "gap-2.5 my-5"}`}
                >
                  <div
                    className="flex-1 h-px"
                    style={{
                      background:
                        "linear-gradient(90deg, transparent, var(--color-secondary))",
                    }}
                  />
                  <span
                    className="font-pixel text-[8px] tracking-[0.16em] px-2 py-1"
                    style={{
                      color: "var(--color-secondary)",
                      border: "1px solid var(--color-secondary)",
                    }}
                  >
                    NEW MESSAGES
                  </span>
                  <div
                    className="flex-1 h-px"
                    style={{
                      background:
                        "linear-gradient(270deg, transparent, var(--color-secondary))",
                    }}
                  />
                </div>
              )}

              {/* Date divider */}
              {showDateDivider && (
                <div
                  className={`flex items-center ${isComfortableDensity ? "gap-3 my-6" : "gap-2.5 my-5"}`}
                >
                  <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, transparent, var(--border-dim))" }} />
                  <span
                    className="font-pixel text-[8px] tracking-[0.16em]"
                    style={{ color: "var(--color-text)" }}
                  >
                    {getDateLabel(isoDate)}
                  </span>
                  <div className="flex-1 h-px" style={{ background: "linear-gradient(270deg, transparent, var(--border-dim))" }} />
                </div>
              )}

              {/* Flush-left message row (Discord-style) */}
              <div
                data-chat-message="true"
                data-message-id={message.id}
                className={`group flex items-start hover:bg-white/[0.02] transition-colors ${
                  isComfortableDensity ? "gap-3 px-2" : "gap-2.5 px-1.5"
                } ${
                  isGrouped
                    ? isComfortableDensity
                      ? "mt-0.5 py-0.5"
                      : "mt-0 py-0.5"
                    : isComfortableDensity
                      ? "mt-3.5 py-0.5"
                      : "mt-2.5 py-0.5"
                }`}
                style={{
                  animation: "slide-in 0.2s ease-out",
                  background:
                    highlightedMessageId === message.id
                      ? "rgba(0, 240, 255, 0.10)"
                      : undefined,
                  borderLeft:
                    highlightedMessageId === message.id
                      ? "2px solid var(--color-primary)"
                      : "2px solid transparent",
                }}
              >
                {/* Left: avatar or hover timestamp */}
                <div
                  className={`shrink-0 select-none flex justify-center ${
                    isComfortableDensity ? "w-11" : "w-9"
                  }`}
                >
                  {!isGrouped ? (
                    <div
                      className={`rounded-full flex items-center justify-center font-bebas ${
                        isComfortableDensity ? "w-11 h-11 text-[16px]" : "w-9 h-9 text-[14px]"
                      }`}
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
                      className={`block font-mono pt-1 text-center w-full whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 ${
                        isComfortableDensity ? "text-[12px]" : "text-[11px]"
                      }`}
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
                        className={`font-mono tracking-[0.08em] ${
                          isComfortableDensity ? "text-[12px]" : "text-[11px]"
                        }`}
                        style={{ color: "var(--color-meta)" }}
                        title={fullDateTime}
                      >
                        {headerTime}
                      </span>
                    </div>
                  )}

                  <div
                    className={`font-mono break-words ${
                      isComfortableDensity
                        ? "text-[18px] leading-relaxed"
                        : "text-[15px] leading-normal"
                    } ${isGrouped ? "" : isComfortableDensity ? "mt-1" : "mt-0.5"}`}
                    style={{ color: "var(--color-msg-text)" }}
                  >
                    {message.content}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {isLoadingNewer && (
          <div className="flex justify-center py-4">
            <span className="font-mono text-[11px]" style={{ color: "var(--color-meta)" }}>
              Loading newer messages...
            </span>
          </div>
        )}
        <div ref={bottomSentinelRef} className="h-px" />
        <div ref={messagesEndRef} />
      </div>

      {isLoadingMore && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <span
            className="font-mono text-[11px] px-2 py-1"
            style={{
              color: "var(--color-meta)",
              background: "color-mix(in srgb, var(--bg-panel) 90%, transparent)",
              border: "1px solid var(--border-dim)",
            }}
          >
            Loading older messages...
          </span>
        </div>
      )}

      {shouldShowJumpAction && (
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
          {jumpActionLabel}
        </button>
      )}
    </div>
  );
}

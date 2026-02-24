import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { getRoomMessages, getRoomMessagesNewer } from "../services/api";
import { logError } from "../utils/logger";
import type {
  Message,
  MessageContextResponse,
  WSDeletedMessagePayload,
} from "../types";
import {
  capturePrependAnchor,
  findFirstUnreadMessageId,
  isStrictlyNewerThan,
  type ChatItem,
} from "../components/message-list/messageListFormatting";
import {
  useMessageFeedViewport,
  type PendingScrollAdjustment,
} from "./useMessageFeedViewport";

/**
 * Orchestrates MessageList data lifecycle.
 * Ownership:
 * - Cursor pagination state (older + newer in context mode)
 * - Initial/history/context fetch sequencing
 * - Live message merge policy without duplicate rows
 */
interface UseMessageFeedLifecycleParams {
  roomId: number;
  token: string | null;
  userId: number | null | undefined;
  density: "compact" | "comfortable";
  messageViewMode: "normal" | "context";
  messageContext: MessageContextResponse | null;
  lastReadAtSnapshot: string | null;
  incomingMessages: Message[];
  onIncomingMessagesProcessed?: () => void;
  incomingMessageDeletions: WSDeletedMessagePayload[];
  onIncomingMessageDeletionsProcessed?: () => void;
  scrollToLatestSignal: number;
  onExitContextMode?: () => void;
}

interface UseMessageFeedLifecycleResult {
  messages: ChatItem[];
  loading: boolean;
  error: string;
  retryInitialLoad: () => void;
  isLoadingMore: boolean;
  isLoadingNewer: boolean;
  nextCursor: string | null;
  newMessagesAnchorId: number | null;
  highlightedMessageId: number | null;
  showJumpToLatest: boolean;
  showContextLiveIndicator: boolean;
  jumpToLatest: () => void;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  sentinelRef: RefObject<HTMLDivElement | null>;
  bottomSentinelRef: RefObject<HTMLDivElement | null>;
  messagesEndRef: RefObject<HTMLDivElement | null>;
}

const INITIAL_HISTORY_PAGE_SIZE = 75;
const OLDER_HISTORY_PAGE_SIZE = 100;
const MESSAGES_LOAD_TIMEOUT_MS = 5000;

export function useMessageFeedLifecycle({
  roomId,
  token,
  userId,
  density,
  messageViewMode,
  messageContext,
  lastReadAtSnapshot,
  incomingMessages,
  onIncomingMessagesProcessed,
  incomingMessageDeletions,
  onIncomingMessageDeletionsProcessed,
  scrollToLatestSignal,
  onExitContextMode,
}: UseMessageFeedLifecycleParams): UseMessageFeedLifecycleResult {
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const pendingScrollAdjustmentRef = useRef<PendingScrollAdjustment | null>(null);
  const timeoutFiredRef = useRef(false);
  const contextLiveMessagesRef = useRef<Message[]>([]);
  // Guards async race conditions when room/mode changes mid-request.
  const paginationEpochRef = useRef(0);

  useEffect(() => {
    contextLiveMessagesRef.current = contextLiveMessages;
  }, [contextLiveMessages]);

  useEffect(() => {
    if (messageViewMode !== "context" || !messageContext) return;

    // Entering context mode resets normal-history cursors and hydrates around anchor message.
    paginationEpochRef.current += 1;
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
    // Preserve unseen live messages captured while in context mode during mode handoff.
    const bufferedContextTail = contextLiveMessagesRef.current;

    if (token) {
      paginationEpochRef.current += 1;
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
    const activeEpoch = paginationEpochRef.current;

    async function fetchMessages() {
      if (!token) return;

      timeoutFiredRef.current = false;

      timeoutId = window.setTimeout(() => {
        timeoutFiredRef.current = true;
        setError("Loading messages is taking longer than expected. The server may be waking up.");
        setLoading(false);
      }, MESSAGES_LOAD_TIMEOUT_MS);

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
        if (paginationEpochRef.current !== activeEpoch) {
          return;
        }

        // Resolve divider anchor from entry-time history only, so live messages
        // that arrive while loading cannot retroactively create/move the marker.
        setNewMessagesAnchorId(
          findFirstUnreadMessageId(history, lastReadAtSnapshot, userId),
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
          // Keep deterministic order: existing live tail first, then buffered context tail.
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
  }, [roomId, token, retryCount, messageViewMode, lastReadAtSnapshot, userId]);

  const retryInitialLoad = useCallback(() => {
    setLoading(true);
    setError("");
    setIsInitialPositioned(false);
    setShowJumpToLatest(false);
    setNewMessagesAnchorId(null);
    pendingScrollAdjustmentRef.current = null;
    setRetryCount((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (highlightedMessageId == null) return;

    const timeoutId = window.setTimeout(() => {
      setHighlightedMessageId(null);
    }, 2200);

    return () => clearTimeout(timeoutId);
  }, [highlightedMessageId]);

  const loadOlderMessages = useCallback(async () => {
    if (!token || !nextCursor || isLoadingMore || !isInitialPositioned) return;

    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const previousScrollHeight = scrollContainer.scrollHeight;
    const previousScrollTop = scrollContainer.scrollTop;
    // Anchor snapshot lets viewport preserve exact visible row after prepend.
    const { anchorMessageId, anchorTop } = capturePrependAnchor(scrollContainer);
    const requestEpoch = paginationEpochRef.current;

    setIsLoadingMore(true);

    try {
      const { messages: olderMessages, next_cursor } = await getRoomMessages(
        roomId,
        token,
        undefined,
        nextCursor,
        OLDER_HISTORY_PAGE_SIZE,
      );

      const reversedOlderMessages = olderMessages.reverse();
      if (paginationEpochRef.current !== requestEpoch) {
        return;
      }

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

      setNextCursor(next_cursor);
    } catch (err) {
      logError("Failed to load older messages:", err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    token,
    roomId,
    nextCursor,
    isLoadingMore,
    isInitialPositioned,
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

  const { isNearBottom, jumpToLatest } = useMessageFeedViewport({
    density,
    messageViewMode,
    messages,
    nextCursor,
    newerCursor,
    isLoadingMore,
    isLoadingNewer,
    isInitialPositioned,
    setIsInitialPositioned,
    setShowJumpToLatest,
    scrollToLatestSignal,
    onExitContextMode,
    loadOlderMessages,
    loadNewerMessages,
    scrollContainerRef,
    sentinelRef,
    bottomSentinelRef,
    messagesEndRef,
    pendingScrollAdjustmentRef,
  });

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
        // In context mode, keep live traffic separate until user returns to latest.
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

  useEffect(() => {
    if (incomingMessageDeletions.length === 0) return;

    const deletionsById = new Map(
      incomingMessageDeletions.map((deletion) => [deletion.id, deletion]),
    );

    setMessages((prev) =>
      prev.map((item) => {
        if ("type" in item) return item;
        const deletion = deletionsById.get(item.id);
        if (!deletion) return item;
        return {
          ...item,
          content: "",
          deleted_at: deletion.deleted_at,
        };
      }),
    );

    setContextLiveMessages((prev) =>
      prev.map((item) => {
        const deletion = deletionsById.get(item.id);
        if (!deletion) return item;
        return {
          ...item,
          content: "",
          deleted_at: deletion.deleted_at,
        };
      }),
    );

    onIncomingMessageDeletionsProcessed?.();
  }, [incomingMessageDeletions, onIncomingMessageDeletionsProcessed]);

  const showContextLiveIndicator =
    messageViewMode === "context" && contextLiveMessages.length > 0;

  return {
    messages,
    loading,
    error,
    retryInitialLoad,
    isLoadingMore,
    isLoadingNewer,
    nextCursor,
    newMessagesAnchorId,
    highlightedMessageId,
    showJumpToLatest,
    showContextLiveIndicator,
    jumpToLatest,
    scrollContainerRef,
    sentinelRef,
    bottomSentinelRef,
    messagesEndRef,
  };
}

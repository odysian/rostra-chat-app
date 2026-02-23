import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";

// Scroll policy coordinator for MessageList. It applies pending adjustments
// produced by lifecycle events (initial load, prepend, append, context target).
export type PendingScrollAdjustment =
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

interface UseMessageFeedViewportParams {
  density: "compact" | "comfortable";
  messageViewMode: "normal" | "context";
  messages: Array<{ id: string | number }>;
  nextCursor: string | null;
  newerCursor: string | null;
  isLoadingMore: boolean;
  isLoadingNewer: boolean;
  isInitialPositioned: boolean;
  setIsInitialPositioned: Dispatch<SetStateAction<boolean>>;
  setShowJumpToLatest: Dispatch<SetStateAction<boolean>>;
  scrollToLatestSignal: number;
  onExitContextMode?: () => void;
  loadOlderMessages: () => void;
  loadNewerMessages: () => void;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  sentinelRef: RefObject<HTMLDivElement | null>;
  bottomSentinelRef: RefObject<HTMLDivElement | null>;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  pendingScrollAdjustmentRef: RefObject<PendingScrollAdjustment | null>;
}

interface UseMessageFeedViewportResult {
  isNearBottom: (container: HTMLDivElement) => boolean;
  jumpToLatest: () => void;
}

const JUMP_TO_LATEST_MIN_HIDDEN_MESSAGES = 50;
const TOP_PREFETCH_ROOT_MARGIN = "900px";

export function useMessageFeedViewport({
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
}: UseMessageFeedViewportParams): UseMessageFeedViewportResult {
  const previousScrollToLatestSignalRef = useRef(scrollToLatestSignal);
  // Suppresses jump button while smooth scroll animation is in-flight.
  const jumpVisibilitySuppressedRef = useRef(false);

  const isNearBottom = useCallback((container: HTMLDivElement): boolean => {
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    return distanceFromBottom < 100;
  }, []);

  const updateJumpToLatestVisibility = useCallback(() => {
    const container = scrollContainerRef.current;

    if (
      !container ||
      jumpVisibilitySuppressedRef.current ||
      !isInitialPositioned
    ) {
      setShowJumpToLatest(false);
      return;
    }

    if (messageViewMode === "context") {
      // In context mode, the button is both "jump to latest" and "exit context".
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
  }, [isInitialPositioned, isNearBottom, messageViewMode, newerCursor, scrollContainerRef, setShowJumpToLatest]);

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
  }, [messages, messagesEndRef, pendingScrollAdjustmentRef, scrollContainerRef, setIsInitialPositioned]);

  // Density changes alter message heights; pin to latest so on-screen context
  // does not drift upward when switching between tight and comfy modes.
  useLayoutEffect(() => {
    if (!isInitialPositioned) return;
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
    setShowJumpToLatest(false);
  }, [density, isInitialPositioned, scrollContainerRef, setShowJumpToLatest]);

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
  }, [
    isInitialPositioned,
    messageViewMode,
    onExitContextMode,
    scrollContainerRef,
    scrollToLatestSignal,
    setShowJumpToLatest,
  ]);

  useEffect(() => {
    updateJumpToLatestVisibility();
  }, [messages, updateJumpToLatestVisibility, messageViewMode]);

  useEffect(() => {
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
  }, [
    isInitialPositioned,
    isNearBottom,
    scrollContainerRef,
    setShowJumpToLatest,
    updateJumpToLatestVisibility,
  ]);

  const jumpToLatest = useCallback(() => {
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
  }, [messageViewMode, onExitContextMode, scrollContainerRef, setShowJumpToLatest]);

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
  }, [
    isInitialPositioned,
    isLoadingMore,
    loadOlderMessages,
    nextCursor,
    scrollContainerRef,
    sentinelRef,
  ]);

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
        // Smaller prefetch window at bottom keeps context-mode newer paging predictable.
        rootMargin: "100px",
        threshold: 0,
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [
    bottomSentinelRef,
    isInitialPositioned,
    isLoadingNewer,
    loadNewerMessages,
    messageViewMode,
    newerCursor,
    scrollContainerRef,
  ]);

  return {
    isNearBottom,
    jumpToLatest,
  };
}

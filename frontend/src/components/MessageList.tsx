import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import type { Message, MessageContextResponse } from "../types";
import { MessageFeedContent } from "./message-list/MessageFeedContent";
import { useMessageFeedLifecycle } from "../hooks/useMessageFeedLifecycle";

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
  const {
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
  } = useMessageFeedLifecycle({
    roomId,
    token,
    userId: user?.id,
    density,
    messageViewMode,
    messageContext,
    lastReadAtSnapshot,
    incomingMessages,
    onIncomingMessagesProcessed,
    scrollToLatestSignal,
    onExitContextMode,
  });

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
            onClick={retryInitialLoad}
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
        <div ref={sentinelRef} className="h-px" />

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

        <div className="grow" />

        <MessageFeedContent
          messages={messages}
          density={density}
          theme={theme}
          newMessagesAnchorId={newMessagesAnchorId}
          highlightedMessageId={highlightedMessageId}
        />

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
          onClick={jumpToLatest}
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

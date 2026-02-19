import type { Message } from "../types";

interface SearchResultsProps {
  messages: Message[];
  query: string;
  loading: boolean;
  error: string;
  hasMore: boolean;
  onLoadMore: () => void;
  loadingMore: boolean;
}

export default function SearchResults({
  messages,
  query,
  loading,
  error,
  hasMore,
  onLoadMore,
  loadingMore,
}: SearchResultsProps) {
  // Format date for search results — always show full date since results span time
  const formatDate = (isoString: string): string => {
    const dateStr = isoString.endsWith("Z") ? isoString : isoString + "Z";
    const date = new Date(dateStr);
    const now = new Date();
    const timeStr = date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });

    if (date.toDateString() === now.toDateString()) {
      return timeStr;
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday at ${timeStr}`;
    }

    return `${date.toLocaleDateString([], { month: "short", day: "numeric" })} at ${timeStr}`;
  };

  // Initial loading state (first search)
  if (loading && messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="font-mono text-[12px]" style={{ color: "var(--color-meta)" }}>
          Searching...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div
          className="p-3 font-mono text-[12px]"
          style={{
            background: "rgba(255, 0, 0, 0.05)",
            color: "#ff4444",
            border: "1px solid rgba(255, 0, 0, 0.2)",
          }}
        >
          {error}
        </div>
      </div>
    );
  }

  // No query entered yet
  if (!query) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="font-mono text-[12px]" style={{ color: "var(--color-meta)" }}>
          Type to search messages
        </p>
      </div>
    );
  }

  // No results
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="font-mono text-[12px]" style={{ color: "var(--color-meta)" }}>
          No messages found
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto min-h-0">
      {/* Result count */}
      <div
        className="px-3.5 py-2 font-mono text-[10px] tracking-[0.08em]"
        style={{ color: "var(--color-meta)" }}
      >
        {messages.length}{hasMore ? "+" : ""} result{messages.length !== 1 ? "s" : ""}
      </div>

      {/* Results list */}
      {messages.map((msg) => (
        <div
          key={msg.id}
          className="px-3.5 py-3 transition-colors"
          style={{ borderBottom: "1px solid var(--border-dim)" }}
        >
          <div className="flex items-start gap-2">
            <div
              className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center font-bebas text-[12px]"
              style={{
                background: "var(--bg-app)",
                border: "1px solid var(--border-primary)",
                color: "var(--color-primary)",
              }}
            >
              {msg.username.substring(0, 2).toUpperCase()}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2 mb-1">
                <span
                  className="font-mono text-[10px] tracking-[0.08em]"
                  style={{ color: "var(--color-primary)" }}
                >
                  {msg.username}
                </span>
                <span
                  className="font-mono text-[10px] tracking-[0.08em]"
                  style={{ color: "var(--color-meta)" }}
                >
                  {formatDate(msg.created_at)}
                </span>
              </div>

              <p
                className="font-mono text-[14px] break-words leading-snug px-2.5 py-1.5"
                style={{
                  color: "var(--color-msg-text)",
                  background: "var(--bg-bubble)",
                  border: "1px solid var(--border-dim)",
                  borderRadius: "2px",
                }}
              >
                {msg.content}
              </p>
            </div>
          </div>
        </div>
      ))}

      {/* Load more button */}
      {hasMore && (
        <div className="flex justify-center py-4">
          <button
            onClick={onLoadMore}
            disabled={loadingMore}
            className="px-4 py-2 font-bebas text-[14px] tracking-[0.10em] transition-colors disabled:opacity-50"
            style={{ color: "var(--color-primary)" }}
          >
            {loadingMore ? "LOADING..." : "LOAD MORE"}
          </button>
        </div>
      )}
    </div>
  );
}

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
        <p className="text-zinc-500 text-sm">Searching...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="bg-red-900/20 text-red-400 p-3 rounded border border-red-900 text-sm">
          {error}
        </div>
      </div>
    );
  }

  // No query entered yet
  if (!query) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-zinc-500 text-sm">Type to search messages</p>
      </div>
    );
  }

  // No results
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-zinc-500 text-sm">No messages found</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto min-h-0">
      {/* Result count */}
      <div className="px-4 py-2 text-xs text-zinc-500">
        {messages.length}{hasMore ? "+" : ""} result{messages.length !== 1 ? "s" : ""}
      </div>

      {/* Results list */}
      {messages.map((msg) => (
        <div
          key={msg.id}
          className="px-4 py-3 hover:bg-white/5 transition-colors border-b border-zinc-800/50"
        >
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-sm font-semibold text-amber-500">
              {msg.username}
            </span>
            <span className="text-xs text-zinc-500">
              {formatDate(msg.created_at)}
            </span>
          </div>
          <p className="text-sm text-zinc-200 break-all leading-snug">
            {msg.content}
          </p>
        </div>
      ))}

      {/* Load more button */}
      {hasMore && (
        <div className="flex justify-center py-4">
          <button
            onClick={onLoadMore}
            disabled={loadingMore}
            className="px-4 py-2 text-sm text-amber-500 hover:text-amber-400 disabled:text-zinc-500 transition-colors"
          >
            {loadingMore ? "Loading..." : "Load more results"}
          </button>
        </div>
      )}
    </div>
  );
}

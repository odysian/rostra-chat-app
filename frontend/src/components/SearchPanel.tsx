import { useState, useCallback, useRef, useEffect } from "react";
import SearchBar from "./SearchBar";
import SearchResults from "./SearchResults";
import { searchMessages } from "../services/api";
import type { Message } from "../types";

interface SearchPanelProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: number;
  token: string;
}

/**
 * SearchPanel Component
 *
 * Right sidebar for searching messages in the current room.
 * Owns all search state internally (query, results, pagination, abort).
 * Same layout pattern as UsersPanel: fixed overlay on mobile, static on desktop.
 */
export default function SearchPanel({
  isOpen,
  onClose,
  roomId,
  token,
}: SearchPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchCursor, setSearchCursor] = useState<string | null>(null);
  const [searchLoadingMore, setSearchLoadingMore] = useState(false);
  const searchAbortRef = useRef<AbortController | null>(null);

  // Reset search state when room changes
  useEffect(() => {
    searchAbortRef.current?.abort();
    setSearchQuery("");
    setSearchResults([]);
    setSearchError("");
    setSearchCursor(null);
  }, [roomId]);

  // Perform search — called by SearchBar's debounced onChange
  const handleSearch = useCallback(
    async (query: string) => {
      // Abort any in-flight request so stale results don't overwrite newer ones
      searchAbortRef.current?.abort();

      if (!query) {
        setSearchQuery(query);
        setSearchResults([]);
        setSearchCursor(null);
        setSearchError("");
        return;
      }

      setSearchQuery(query);
      setSearchLoading(true);
      setSearchError("");

      const controller = new AbortController();
      searchAbortRef.current = controller;

      try {
        const data = await searchMessages(
          roomId,
          query,
          token,
          controller.signal,
        );
        setSearchResults(data.messages);
        setSearchCursor(data.next_cursor);
      } catch (err) {
        // Don't show errors for aborted requests (user typed a new query)
        if (err instanceof Error && err.name === "AbortError") return;
        setSearchError(
          err instanceof Error ? err.message : "Search failed",
        );
      } finally {
        setSearchLoading(false);
      }
    },
    [roomId, token],
  );

  // Load more search results (pagination)
  const handleSearchLoadMore = useCallback(async () => {
    if (!searchCursor || !searchQuery) return;

    setSearchLoadingMore(true);
    try {
      const data = await searchMessages(
        roomId,
        searchQuery,
        token,
        undefined,
        searchCursor,
      );
      setSearchResults((prev) => [...prev, ...data.messages]);
      setSearchCursor(data.next_cursor);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setSearchError(
        err instanceof Error ? err.message : "Failed to load more results",
      );
    } finally {
      setSearchLoadingMore(false);
    }
  }, [searchCursor, searchQuery, roomId, token]);

  const handleClose = () => {
    searchAbortRef.current?.abort();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Mobile backdrop - click to close */}
      <div
        className="fixed inset-0 bg-black/50 z-40 md:hidden cursor-pointer"
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        className="w-60 flex flex-col md:relative fixed inset-y-0 right-0 z-50 md:z-auto"
        style={{
          background: "var(--bg-panel)",
          borderLeft: "1px solid var(--border-primary)",
        }}
      >
        <SearchBar onSearch={handleSearch} onClose={handleClose} />
        <SearchResults
          messages={searchResults}
          query={searchQuery}
          loading={searchLoading}
          error={searchError}
          hasMore={searchCursor !== null}
          onLoadMore={handleSearchLoadMore}
          loadingMore={searchLoadingMore}
        />
      </div>
    </>
  );
}

import { useState, useEffect, useRef } from "react";

interface SearchBarProps {
  onSearch: (query: string) => void;
  onClose: () => void;
}

export default function SearchBar({ onSearch, onClose }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | undefined>(undefined);

  // Auto-focus the input when the search bar mounts
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounce: wait 300ms after user stops typing before firing search.
  // This prevents hammering the API on every keystroke.
  useEffect(() => {
    clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (!trimmed) {
      // Clear results immediately when input is empty
      onSearch("");
      return;
    }

    debounceRef.current = window.setTimeout(() => {
      onSearch(trimmed);
    }, 300);

    return () => clearTimeout(debounceRef.current);
    // onSearch is stable (useCallback in parent) — safe to include
  }, [query, onSearch]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div className="h-14 shrink-0 flex items-center gap-2 px-3 bg-zinc-900 border-b border-zinc-800">
      {/* Search icon */}
      <svg
        className="w-4 h-4 text-zinc-500 shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>

      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search messages..."
        className="flex-1 bg-transparent text-zinc-100 text-sm placeholder-zinc-500 focus:outline-none"
      />

      {/* Close button */}
      <button
        onClick={onClose}
        className="text-zinc-500 hover:text-zinc-300 transition-colors shrink-0"
        title="Close search (Esc)"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}

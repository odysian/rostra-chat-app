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
    <div
      className="shrink-0"
      style={{ borderBottom: "1px solid var(--border-dim)" }}
    >
      <div style={{ padding: "12px 14px 8px" }}>
        <h3
          className="font-bebas text-[13px] tracking-[0.10em]"
          style={{ color: "var(--color-primary)" }}
        >
          SEARCH
        </h3>
      </div>

      <div className="flex items-center gap-2" style={{ margin: "0 12px 12px" }}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search messages..."
          className="flex-1 px-3 py-2 focus:outline-none font-mono text-[11px] tracking-[0.10em] placeholder:text-[var(--color-meta)]"
          style={{
            background: "var(--bg-app)",
            border: "1px solid var(--border-primary)",
            color: "var(--color-primary)",
            borderRadius: "2px",
          }}
          onFocus={(e) => {
            e.currentTarget.style.boxShadow = "var(--glow-primary)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.boxShadow = "none";
          }}
        />

        <button
          onClick={onClose}
          className="transition-colors shrink-0 p-1"
          style={{ color: "var(--color-meta)" }}
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
    </div>
  );
}

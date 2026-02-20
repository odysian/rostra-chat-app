import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import SearchPanel from "../SearchPanel";
import type { Message } from "../../types";

const mockSearchMessages = vi.fn();
const mockOnClose = vi.fn();

vi.mock("../../services/api", () => ({
  searchMessages: (...args: unknown[]) => mockSearchMessages(...args),
}));

// SearchBar debounce behavior is covered in SearchBar.test.tsx.
// Here we mock it so SearchPanel tests can focus on panel state transitions.
vi.mock("../SearchBar", () => ({
  default: ({
    onSearch,
    onClose,
  }: {
    onSearch: (query: string) => void;
    onClose: () => void;
  }) => (
    <div>
      <input
        aria-label="search-input"
        onChange={(e) => onSearch(e.currentTarget.value)}
      />
      <button type="button" onClick={() => onSearch("")}>
        clear-search
      </button>
      <button type="button" onClick={onClose}>
        close-search
      </button>
    </div>
  ),
}));

function makeMessage(id: number, content: string): Message {
  return {
    id,
    room_id: 1,
    user_id: 1,
    username: "alice",
    content,
    created_at: "2024-01-01T10:00:00Z",
  };
}

function renderSearchPanel(overrides?: Partial<ComponentProps<typeof SearchPanel>>) {
  return render(
    <SearchPanel
      isOpen={true}
      onClose={mockOnClose}
      roomId={1}
      token="test-token"
      {...overrides}
    />,
  );
}

describe("SearchPanel", () => {
  beforeEach(() => {
    mockSearchMessages.mockReset();
    mockOnClose.mockReset();
  });

  it("returns null when closed", () => {
    const { container } = renderSearchPanel({ isOpen: false });
    expect(container).toBeEmptyDOMElement();
  });

  it("searches and renders results", async () => {
    mockSearchMessages.mockResolvedValueOnce({
      messages: [makeMessage(1, "hello world")],
      next_cursor: null,
    });

    renderSearchPanel();
    fireEvent.change(screen.getByLabelText("search-input"), {
      target: { value: "hello" },
    });

    await waitFor(() => {
      expect(mockSearchMessages).toHaveBeenCalledWith(
        1,
        "hello",
        "test-token",
        expect.any(AbortSignal),
      );
    });
    expect(await screen.findByText("hello world")).toBeInTheDocument();
  });

  it("aborts previous request when a new query is entered", async () => {
    const signals: AbortSignal[] = [];

    mockSearchMessages.mockImplementation(
      async (
        _roomId: number,
        _query: string,
        _token: string,
        signal?: AbortSignal,
      ) => {
        if (signal) signals.push(signal);
        return new Promise(() => {});
      },
    );

    renderSearchPanel();
    fireEvent.change(screen.getByLabelText("search-input"), {
      target: { value: "hel" },
    });
    fireEvent.change(screen.getByLabelText("search-input"), {
      target: { value: "hello" },
    });

    await waitFor(() => {
      expect(mockSearchMessages).toHaveBeenCalledTimes(2);
    });
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
  });

  it("clears results for empty query without calling API again", async () => {
    mockSearchMessages.mockResolvedValueOnce({
      messages: [makeMessage(1, "hello world")],
      next_cursor: null,
    });

    renderSearchPanel();
    fireEvent.change(screen.getByLabelText("search-input"), {
      target: { value: "hello" },
    });
    expect(await screen.findByText("hello world")).toBeInTheDocument();
    expect(mockSearchMessages).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "clear-search" }));
    expect(screen.getByText("Type to search messages")).toBeInTheDocument();
    expect(mockSearchMessages).toHaveBeenCalledTimes(1);
  });

  it("shows network error message", async () => {
    mockSearchMessages.mockRejectedValueOnce(new Error("Search failed"));

    renderSearchPanel();
    fireEvent.change(screen.getByLabelText("search-input"), {
      target: { value: "hello" },
    });

    expect(await screen.findByText("Search failed")).toBeInTheDocument();
  });

  it("resets query and results when room changes", async () => {
    mockSearchMessages.mockResolvedValue({
      messages: [makeMessage(1, "hello world")],
      next_cursor: null,
    });

    const { rerender } = renderSearchPanel({ roomId: 1 });
    fireEvent.change(screen.getByLabelText("search-input"), {
      target: { value: "hello" },
    });
    expect(await screen.findByText("hello world")).toBeInTheDocument();

    rerender(
      <SearchPanel
        isOpen={true}
        onClose={mockOnClose}
        roomId={2}
        token="test-token"
      />,
    );

    expect(screen.getByText("Type to search messages")).toBeInTheDocument();
  });
});

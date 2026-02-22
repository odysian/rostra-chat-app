import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import SearchPanel from "../SearchPanel";
import type { Message } from "../../types";

const mockSearchMessages = vi.fn();
const mockGetMessageContext = vi.fn();
const mockOnClose = vi.fn();

vi.mock("../../services/api", () => ({
  searchMessages: (...args: unknown[]) => mockSearchMessages(...args),
  getMessageContext: (...args: unknown[]) => mockGetMessageContext(...args),
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

describe("SearchPanel integration", () => {
  beforeEach(() => {
    mockSearchMessages.mockReset();
    mockGetMessageContext.mockReset();
    mockOnClose.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses SearchBar debounce and only searches with the final query", async () => {
    mockSearchMessages.mockResolvedValueOnce({
      messages: [makeMessage(1, "hello world")],
      next_cursor: null,
    });

    render(
      <SearchPanel
        isOpen={true}
        onClose={mockOnClose}
        roomId={1}
        token="test-token"
      />,
    );

    const input = screen.getByPlaceholderText("Search messages...");

    fireEvent.change(input, { target: { value: "hel" } });
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(mockSearchMessages).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "hello" } });
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(mockSearchMessages).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });

    expect(mockSearchMessages).toHaveBeenCalledTimes(1);
    expect(mockSearchMessages).toHaveBeenCalledWith(
      1,
      "hello",
      "test-token",
      expect.any(AbortSignal),
    );
    expect(screen.getByText("hello world")).toBeInTheDocument();
  });
});

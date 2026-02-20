import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import SearchBar from "../SearchBar";

describe("SearchBar", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("auto-focuses input on mount", () => {
    const onSearch = vi.fn();
    const onClose = vi.fn();
    render(<SearchBar onSearch={onSearch} onClose={onClose} />);

    expect(screen.getByPlaceholderText("Search messages...")).toHaveFocus();
  });

  it('calls onSearch("") immediately for empty input', () => {
    const onSearch = vi.fn();
    const onClose = vi.fn();
    render(<SearchBar onSearch={onSearch} onClose={onClose} />);

    expect(onSearch).toHaveBeenCalledWith("");
  });

  it("debounces non-empty search by 300ms", async () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();
    const onClose = vi.fn();
    render(<SearchBar onSearch={onSearch} onClose={onClose} />);
    onSearch.mockClear();

    const input = screen.getByPlaceholderText("Search messages...");
    fireEvent.change(input, { target: { value: "hello" } });
    expect(onSearch).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(299);
    });
    expect(onSearch).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(onSearch).toHaveBeenCalledWith("hello");
  });

  it("fires only once after rapid typing", async () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();
    const onClose = vi.fn();
    render(<SearchBar onSearch={onSearch} onClose={onClose} />);
    onSearch.mockClear();

    const input = screen.getByPlaceholderText("Search messages...");
    fireEvent.change(input, { target: { value: "h" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    fireEvent.change(input, { target: { value: "he" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    fireEvent.change(input, { target: { value: "hey" } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith("hey");
  });

  it("calls onClose when Escape is pressed", () => {
    const onSearch = vi.fn();
    const onClose = vi.fn();
    render(<SearchBar onSearch={onSearch} onClose={onClose} />);

    const input = screen.getByPlaceholderText("Search messages...");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SearchResults from "../SearchResults";
import type { Message } from "../../types";

function makeMessage(id: number, username: string, content: string): Message {
  return {
    id,
    room_id: 1,
    user_id: id,
    username,
    content,
    created_at: "2024-01-01T10:00:00Z",
  };
}

describe("SearchResults", () => {
  it('shows "Searching..." during initial load', () => {
    render(
      <SearchResults
        messages={[]}
        query="hello"
        loading={true}
        error=""
        hasMore={false}
        onLoadMore={vi.fn()}
        loadingMore={false}
      />,
    );

    expect(screen.getByText("Searching...")).toBeInTheDocument();
  });

  it('shows "Type to search messages" when query is empty', () => {
    render(
      <SearchResults
        messages={[]}
        query=""
        loading={false}
        error=""
        hasMore={false}
        onLoadMore={vi.fn()}
        loadingMore={false}
      />,
    );

    expect(screen.getByText("Type to search messages")).toBeInTheDocument();
  });

  it('shows "No messages found" when query has no results', () => {
    render(
      <SearchResults
        messages={[]}
        query="hello"
        loading={false}
        error=""
        hasMore={false}
        onLoadMore={vi.fn()}
        loadingMore={false}
      />,
    );

    expect(screen.getByText("No messages found")).toBeInTheDocument();
  });

  it("renders result count and result rows", () => {
    const messages = [
      makeMessage(1, "alice", "one"),
      makeMessage(2, "bob", "two"),
      makeMessage(3, "carol", "three"),
      makeMessage(4, "dave", "four"),
      makeMessage(5, "erin", "five"),
    ];

    render(
      <SearchResults
        messages={messages}
        query="e"
        loading={false}
        error=""
        hasMore={false}
        onLoadMore={vi.fn()}
        loadingMore={false}
      />,
    );

    expect(screen.getByText("5 results")).toBeInTheDocument();
    expect(screen.getByText("alice")).toBeInTheDocument();
    expect(screen.getByText("five")).toBeInTheDocument();
  });

  it('shows "5+ results" when hasMore is true', () => {
    const messages = [
      makeMessage(1, "alice", "one"),
      makeMessage(2, "bob", "two"),
      makeMessage(3, "carol", "three"),
      makeMessage(4, "dave", "four"),
      makeMessage(5, "erin", "five"),
    ];

    render(
      <SearchResults
        messages={messages}
        query="e"
        loading={false}
        error=""
        hasMore={true}
        onLoadMore={vi.fn()}
        loadingMore={false}
      />,
    );

    expect(screen.getByText("5+ results")).toBeInTheDocument();
  });

  it("calls load more and reflects loadingMore state", async () => {
    const onLoadMore = vi.fn();
    const messages = [makeMessage(1, "alice", "one")];
    const { rerender } = render(
      <SearchResults
        messages={messages}
        query="a"
        loading={false}
        error=""
        hasMore={true}
        onLoadMore={onLoadMore}
        loadingMore={false}
      />,
    );

    screen.getByRole("button", { name: "LOAD MORE" }).click();
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    rerender(
      <SearchResults
        messages={messages}
        query="a"
        loading={false}
        error=""
        hasMore={true}
        onLoadMore={onLoadMore}
        loadingMore={true}
      />,
    );
    expect(screen.getByRole("button", { name: "LOADING..." })).toBeInTheDocument();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import MessageList from "../MessageList";
import type { Message } from "../../types";

const mockGetRoomMessages = vi.fn();
const mockGetRoomMessagesNewer = vi.fn();
const mockOnIncomingMessagesProcessed = vi.fn();

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    token: "test-token",
  }),
}));

vi.mock("../../context/ThemeContext", () => ({
  useTheme: () => ({
    theme: "neon" as const,
  }),
}));

vi.mock("../../services/api", () => ({
  getRoomMessages: (...args: unknown[]) => mockGetRoomMessages(...args),
  getRoomMessagesNewer: (...args: unknown[]) => mockGetRoomMessagesNewer(...args),
}));

function makeMessage(params: {
  id: number;
  username: string;
  content: string;
  createdAt: string;
}): Message {
  return {
    id: params.id,
    room_id: 1,
    user_id: params.id,
    username: params.username,
    content: params.content,
    created_at: params.createdAt,
  };
}

function renderMessageList(overrides?: Partial<ComponentProps<typeof MessageList>>) {
  return render(
    <MessageList
      roomId={1}
      incomingMessages={[]}
      onIncomingMessagesProcessed={mockOnIncomingMessagesProcessed}
      scrollToLatestSignal={0}
      {...overrides}
    />,
  );
}

function makeHistory(total: number, startId = 1): Message[] {
  const base = new Date("2024-01-01T10:00:00Z").getTime();
  return Array.from({ length: total }, (_, index) =>
    makeMessage({
      id: startId + index,
      username: index % 2 === 0 ? "alice" : "bob",
      content: `Message ${startId + index}`,
      createdAt: new Date(base + index * 60 * 1000).toISOString(),
    }),
  );
}

function getUppercaseDateLabel(isoString: string): string {
  const date = new Date(isoString);
  return date
    .toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
    .toUpperCase();
}

describe("MessageList", () => {
  beforeEach(() => {
    mockGetRoomMessages.mockReset();
    mockGetRoomMessagesNewer.mockReset();
    mockOnIncomingMessagesProcessed.mockReset();
  });

  it("shows loading state while initial fetch is pending", async () => {
    let resolveMessages: (value: { messages: Message[]; next_cursor: string | null }) => void;
    const pending = new Promise<{ messages: Message[]; next_cursor: string | null }>(
      (resolve) => {
        resolveMessages = resolve;
      },
    );
    mockGetRoomMessages.mockReturnValueOnce(pending);

    renderMessageList();
    expect(screen.getByText("Loading messages...")).toBeInTheDocument();

    resolveMessages!({ messages: [], next_cursor: null });
    await waitFor(() => {
      expect(screen.getByText("BEGINNING OF CONVERSATION")).toBeInTheDocument();
    });
  });

  it("shows error and retries fetch", async () => {
    const user = userEvent.setup();
    const newest = makeMessage({
      id: 2,
      username: "alice",
      content: "Newest",
      createdAt: "2024-01-02T00:00:00",
    });
    mockGetRoomMessages
      .mockRejectedValueOnce(new Error("Failed to load messages"))
      .mockResolvedValueOnce({ messages: [newest], next_cursor: null });

    renderMessageList();

    expect(await screen.findByText("Failed to load messages")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => {
      expect(screen.getByText("Newest")).toBeInTheDocument();
    });
    expect(mockGetRoomMessages).toHaveBeenCalledTimes(2);
  });

  it("renders messages in chronological order and shows beginning label", async () => {
    const oldest = makeMessage({
      id: 1,
      username: "alice",
      content: "Oldest message",
      createdAt: "2024-01-01T10:00:00",
    });
    const newest = makeMessage({
      id: 2,
      username: "bob",
      content: "Newest message",
      createdAt: "2024-01-01T10:05:00",
    });

    // API returns newest-first; component should reverse it.
    mockGetRoomMessages.mockResolvedValueOnce({
      messages: [newest, oldest],
      next_cursor: null,
    });

    renderMessageList();

    const first = await screen.findByText("Oldest message");
    const second = screen.getByText("Newest message");
    expect(
      first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByText("BEGINNING OF CONVERSATION")).toBeInTheDocument();
  });

  it("shows TODAY and older date divider labels", async () => {
    const now = new Date();
    const todayIso = now.toISOString();
    const olderDate = new Date(now);
    olderDate.setDate(now.getDate() - 7);
    const olderIso = olderDate.toISOString();
    const olderLabel = getUppercaseDateLabel(olderIso);

    const todayMsg = makeMessage({
      id: 2,
      username: "bob",
      content: "Today message",
      createdAt: todayIso,
    });
    const olderMsg = makeMessage({
      id: 1,
      username: "alice",
      content: "Older message",
      createdAt: olderIso,
    });

    mockGetRoomMessages.mockResolvedValueOnce({
      messages: [todayMsg, olderMsg],
      next_cursor: null,
    });

    renderMessageList();

    await screen.findByText("Today message");
    expect(screen.getByText("TODAY")).toBeInTheDocument();
    expect(screen.getByText(olderLabel)).toBeInTheDocument();
  });

  it("groups consecutive messages from same user within five minutes", async () => {
    const base = new Date("2024-01-01T10:00:00Z");
    const first = makeMessage({
      id: 1,
      username: "alice",
      content: "First",
      createdAt: base.toISOString(),
    });
    const second = makeMessage({
      id: 2,
      username: "alice",
      content: "Second",
      createdAt: new Date(base.getTime() + 2 * 60 * 1000).toISOString(),
    });

    mockGetRoomMessages.mockResolvedValueOnce({
      messages: [second, first],
      next_cursor: null,
    });

    renderMessageList();
    await screen.findByText("First");
    expect(screen.getByText("Second")).toBeInTheDocument();
    expect(screen.getAllByText("alice")).toHaveLength(1);
  });

  it("appends only new incoming messages and calls processed callback", async () => {
    const initial = makeMessage({
      id: 1,
      username: "alice",
      content: "Initial",
      createdAt: "2024-01-01T10:00:00Z",
    });
    const incomingNew = makeMessage({
      id: 2,
      username: "bob",
      content: "Incoming",
      createdAt: "2024-01-01T10:01:00Z",
    });

    mockGetRoomMessages.mockResolvedValueOnce({
      messages: [initial],
      next_cursor: null,
    });

    const { rerender } = renderMessageList();
    await screen.findByText("Initial");

    rerender(
      <MessageList
        roomId={1}
        incomingMessages={[initial, incomingNew]}
        onIncomingMessagesProcessed={mockOnIncomingMessagesProcessed}
        scrollToLatestSignal={0}
      />,
    );

    await screen.findByText("Incoming");
    expect(screen.getAllByText("Initial")).toHaveLength(1);
    expect(mockOnIncomingMessagesProcessed).toHaveBeenCalledTimes(1);
  });

  it("does not flash jump action during smooth jump-to-latest scroll", async () => {
    const chronological = makeHistory(60);
    const newestFirst = [...chronological].reverse();

    mockGetRoomMessages.mockResolvedValueOnce({
      messages: newestFirst,
      next_cursor: null,
    });

    const { container } = renderMessageList();
    await screen.findByText("Message 60");

    const scroller = container.querySelector<HTMLDivElement>(".h-full.overflow-y-auto");
    expect(scroller).not.toBeNull();
    if (!scroller) return;

    Object.defineProperty(scroller, "scrollHeight", {
      configurable: true,
      value: 4000,
    });
    Object.defineProperty(scroller, "clientHeight", {
      configurable: true,
      value: 500,
    });
    Object.defineProperty(scroller, "scrollTop", {
      configurable: true,
      writable: true,
      value: 0,
    });
    Object.defineProperty(scroller, "scrollTo", {
      configurable: true,
      value: vi.fn(),
    });

    const rows = container.querySelectorAll<HTMLElement>("[data-chat-message='true']");
    rows.forEach((row, index) => {
      Object.defineProperty(row, "offsetTop", {
        configurable: true,
        value: index * 60,
      });
    });

    fireEvent.scroll(scroller);
    const jumpButton = await screen.findByRole("button", {
      name: "JUMP TO LATEST",
    });

    await userEvent.click(jumpButton);
    fireEvent.scroll(scroller);

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "JUMP TO LATEST" }),
      ).not.toBeInTheDocument();
    });
  });

  it("renders context payload and highlights the jump target", async () => {
    const older = makeMessage({
      id: 1,
      username: "alice",
      content: "Older context",
      createdAt: "2024-01-01T10:00:00Z",
    });
    const target = makeMessage({
      id: 2,
      username: "bob",
      content: "Target context",
      createdAt: "2024-01-01T10:01:00Z",
    });
    const newer = makeMessage({
      id: 3,
      username: "carol",
      content: "Newer context",
      createdAt: "2024-01-01T10:02:00Z",
    });

    const { container } = renderMessageList({
      messageViewMode: "context",
      messageContext: {
        messages: [older, target, newer],
        target_message_id: 2,
        older_cursor: null,
        newer_cursor: null,
      },
    });

    await screen.findByText("Target context");
    const targetRow = container.querySelector("[data-message-id='2']");
    expect(targetRow).toHaveStyle("border-left: 2px solid var(--color-primary)");
  });

  it("drops stale context-only messages when returning to normal mode", async () => {
    const contextOlder = makeMessage({
      id: 11,
      username: "alice",
      content: "Context older",
      createdAt: "2024-01-01T09:40:00Z",
    });
    const contextTarget = makeMessage({
      id: 12,
      username: "bob",
      content: "Context target",
      createdAt: "2024-01-01T09:45:00Z",
    });
    const newestRecent = makeMessage({
      id: 102,
      username: "carol",
      content: "Recent newest",
      createdAt: "2024-01-01T10:05:00Z",
    });
    const olderRecent = makeMessage({
      id: 101,
      username: "dave",
      content: "Recent older",
      createdAt: "2024-01-01T10:00:00Z",
    });

    mockGetRoomMessages.mockResolvedValueOnce({
      // API contract is newest-first
      messages: [newestRecent, olderRecent],
      next_cursor: null,
    });

    const { rerender } = renderMessageList({
      messageViewMode: "context",
      messageContext: {
        messages: [contextOlder, contextTarget],
        target_message_id: 12,
        older_cursor: null,
        newer_cursor: null,
      },
    });

    await screen.findByText("Context target");

    rerender(
      <MessageList
        roomId={1}
        messageViewMode="normal"
        messageContext={null}
        incomingMessages={[]}
        onIncomingMessagesProcessed={mockOnIncomingMessagesProcessed}
        scrollToLatestSignal={0}
      />,
    );

    await screen.findByText("Recent newest");
    expect(screen.getByText("Recent older")).toBeInTheDocument();
    expect(screen.queryByText("Context older")).not.toBeInTheDocument();
    expect(screen.queryByText("Context target")).not.toBeInTheDocument();
  });

  it("preserves buffered context live messages when exiting to normal mode", async () => {
    const contextTarget = makeMessage({
      id: 12,
      username: "bob",
      content: "Context target",
      createdAt: "2024-01-01T09:45:00Z",
    });
    const bufferedLive = makeMessage({
      id: 300,
      username: "eve",
      content: "Buffered live",
      createdAt: "2024-01-01T10:06:00Z",
    });
    const recentNewest = makeMessage({
      id: 102,
      username: "carol",
      content: "Recent newest",
      createdAt: "2024-01-01T10:05:00Z",
    });

    mockGetRoomMessages.mockResolvedValueOnce({
      // Simulate a stale/limited fetch that does not yet include buffered live row
      messages: [recentNewest],
      next_cursor: null,
    });

    const { rerender } = renderMessageList({
      messageViewMode: "context",
      messageContext: {
        messages: [contextTarget],
        target_message_id: 12,
        older_cursor: null,
        newer_cursor: "newer-1",
      },
    });

    await screen.findByText("Context target");

    rerender(
      <MessageList
        roomId={1}
        messageViewMode="context"
        messageContext={{
          messages: [contextTarget],
          target_message_id: 12,
          older_cursor: null,
          newer_cursor: "newer-1",
        }}
        incomingMessages={[bufferedLive]}
        onIncomingMessagesProcessed={mockOnIncomingMessagesProcessed}
        scrollToLatestSignal={0}
      />,
    );

    await screen.findByRole("button", { name: "New messages available" });

    rerender(
      <MessageList
        roomId={1}
        messageViewMode="normal"
        messageContext={null}
        incomingMessages={[]}
        onIncomingMessagesProcessed={mockOnIncomingMessagesProcessed}
        scrollToLatestSignal={0}
      />,
    );

    await screen.findByText("Recent newest");
    expect(screen.getByText("Buffered live")).toBeInTheDocument();
  });

  it("shows anchored live indicator and exits context on jump-to-latest action", async () => {
    const base = makeMessage({
      id: 1,
      username: "alice",
      content: "Anchor",
      createdAt: "2024-01-01T10:00:00Z",
    });
    const incoming = makeMessage({
      id: 2,
      username: "bob",
      content: "Incoming while anchored",
      createdAt: "2024-01-01T10:01:00Z",
    });
    const onExitContextMode = vi.fn();
    const { rerender } = renderMessageList({
      messageViewMode: "context",
      messageContext: {
        messages: [base],
        target_message_id: 1,
        older_cursor: null,
        newer_cursor: "newer-1",
      },
      onExitContextMode,
    });

    await screen.findByText("Anchor");
    rerender(
      <MessageList
        roomId={1}
        messageViewMode="context"
        messageContext={{
          messages: [base],
          target_message_id: 1,
          older_cursor: null,
          newer_cursor: "newer-1",
        }}
        incomingMessages={[incoming]}
        onIncomingMessagesProcessed={mockOnIncomingMessagesProcessed}
        scrollToLatestSignal={0}
        onExitContextMode={onExitContextMode}
      />,
    );

    const jumpButton = await screen.findByRole("button", {
      name: "New messages available",
    });
    await userEvent.click(jumpButton);
    expect(onExitContextMode).toHaveBeenCalledTimes(1);
    expect(mockOnIncomingMessagesProcessed).toHaveBeenCalledTimes(1);
  });

  it("shows jump-to-latest immediately when context has newer pages", async () => {
    const base = makeMessage({
      id: 1,
      username: "alice",
      content: "Context anchor",
      createdAt: "2024-01-01T10:00:00Z",
    });

    renderMessageList({
      messageViewMode: "context",
      messageContext: {
        messages: [base],
        target_message_id: 1,
        older_cursor: null,
        newer_cursor: "newer-1",
      },
    });

    await screen.findByText("Context anchor");
    expect(
      await screen.findByRole("button", { name: "JUMP TO LATEST" }),
    ).toBeInTheDocument();
  });

  it("shows jump-to-latest action in context mode when far from bottom", async () => {
    const contextMessages = makeHistory(60, 500);
    const { container } = renderMessageList({
      messageViewMode: "context",
      messageContext: {
        messages: contextMessages,
        target_message_id: contextMessages[20].id,
        older_cursor: null,
        newer_cursor: null,
      },
    });

    await screen.findByText("Message 559");

    const scroller = container.querySelector<HTMLDivElement>(".h-full.overflow-y-auto");
    expect(scroller).not.toBeNull();
    if (!scroller) return;

    Object.defineProperty(scroller, "scrollHeight", {
      configurable: true,
      value: 4000,
    });
    Object.defineProperty(scroller, "clientHeight", {
      configurable: true,
      value: 500,
    });
    Object.defineProperty(scroller, "scrollTop", {
      configurable: true,
      writable: true,
      value: 0,
    });

    const rows = container.querySelectorAll<HTMLElement>("[data-chat-message='true']");
    rows.forEach((row, index) => {
      Object.defineProperty(row, "offsetTop", {
        configurable: true,
        value: index * 60,
      });
    });

    fireEvent.scroll(scroller);
    expect(
      await screen.findByRole("button", { name: "JUMP TO LATEST" }),
    ).toBeInTheDocument();
  });

  it("loads newer messages at context bottom sentinel", async () => {
    const originalObserver = window.IntersectionObserver;
    class TriggerObserver implements IntersectionObserver {
      readonly root: Element | Document | null = null;
      readonly rootMargin = "";
      readonly thresholds: ReadonlyArray<number> = [];
      private readonly callback: IntersectionObserverCallback;

      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback;
      }

      disconnect() {}
      observe() {
        this.callback(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          this,
        );
      }
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
      unobserve() {}
    }

    window.IntersectionObserver = TriggerObserver as unknown as typeof IntersectionObserver;

    try {
      const base = makeMessage({
        id: 1,
        username: "alice",
        content: "Context base",
        createdAt: "2024-01-01T10:00:00Z",
      });
      const newer = makeMessage({
        id: 2,
        username: "bob",
        content: "Loaded newer",
        createdAt: "2024-01-01T10:01:00Z",
      });
      mockGetRoomMessagesNewer.mockResolvedValueOnce({
        messages: [newer],
        next_cursor: null,
      });

      renderMessageList({
        messageViewMode: "context",
        messageContext: {
          messages: [base],
          target_message_id: 1,
          older_cursor: null,
          newer_cursor: "newer-1",
        },
      });

      await waitFor(() => {
        expect(mockGetRoomMessagesNewer).toHaveBeenCalledWith(
          1,
          "test-token",
          "newer-1",
        );
      });
      expect(await screen.findByText("Loaded newer")).toBeInTheDocument();
    } finally {
      window.IntersectionObserver = originalObserver;
    }
  });

  it("does not auto-exit context mode when reaching the bottom edge", async () => {
    const onExitContextMode = vi.fn();
    const base = makeMessage({
      id: 1,
      username: "alice",
      content: "Anchor",
      createdAt: "2024-01-01T10:00:00Z",
    });

    const { container } = renderMessageList({
      messageViewMode: "context",
      messageContext: {
        messages: [base],
        target_message_id: 1,
        older_cursor: null,
        newer_cursor: null,
      },
      onExitContextMode,
    });

    await screen.findByText("Anchor");

    const scroller = container.querySelector<HTMLDivElement>(".h-full.overflow-y-auto");
    expect(scroller).not.toBeNull();
    if (!scroller) return;

    Object.defineProperty(scroller, "scrollHeight", {
      configurable: true,
      value: 1000,
    });
    Object.defineProperty(scroller, "clientHeight", {
      configurable: true,
      value: 500,
    });
    Object.defineProperty(scroller, "scrollTop", {
      configurable: true,
      writable: true,
      value: 520,
    });

    fireEvent.scroll(scroller);
    expect(onExitContextMode).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import MessageList from "../MessageList";
import type { Message } from "../../types";

const mockGetRoomMessages = vi.fn();
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

function getUppercaseDateLabel(isoString: string): string {
  const date = new Date(isoString);
  return date
    .toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
    .toUpperCase();
}

describe("MessageList", () => {
  beforeEach(() => {
    mockGetRoomMessages.mockReset();
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
});

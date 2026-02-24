import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WebSocketMessage } from "../../context/WebSocketContext";
import type { Room } from "../../types";
import ChatLayout from "../ChatLayout";

const mockSubscribe = vi.fn();
const mockUnsubscribe = vi.fn();
const mockMarkRoomRead = vi.fn();
const mockLeaveRoom = vi.fn();
const mockLogout = vi.fn();

const roomOne: Room = {
  id: 1,
  name: "General Discussion",
  created_by: 1,
  created_at: "2024-01-01T00:00:00",
  last_read_at: "2024-01-01T00:00:00",
};

const roomTwo: Room = {
  id: 2,
  name: "Backend Room",
  created_by: 2,
  created_at: "2024-01-01T00:00:00",
  last_read_at: "2024-01-01T00:00:00",
};

type SidebarMockProps = {
  onSelectRoom: (room: Room) => void;
  refreshTrigger: number;
  unreadCounts: Record<number, number>;
  openCommandPaletteSignal: number;
  closeCommandPaletteSignal: number;
};

type MessageAreaMockProps = {
  selectedRoom: Room | null;
  incomingMessages: Array<{ id: number }>;
  incomingMessageDeletions: Array<{ id: number }>;
  incomingMessageEdits: Array<{ id: number }>;
  wsError?: string | null;
  onLeaveRoom: () => void;
  onRoomDeleted: () => void;
};

type UsersPanelMockProps = {
  onlineUsers: Array<{ id: number; username: string }>;
};

type SearchPanelMockProps = {
  isOpen: boolean;
  focusSignal: number;
};

let latestSidebarProps: SidebarMockProps | null = null;
let latestUsersPanelProps: UsersPanelMockProps | null = null;
let latestSearchPanelProps: SearchPanelMockProps | null = null;
let wsMessageHandler: ((message: WebSocketMessage) => void) | undefined;

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: 1,
      username: "alice",
      email: "alice@example.com",
      created_at: "2024-01-01T00:00:00",
    },
    token: "test-token",
    logout: (...args: unknown[]) => mockLogout(...args),
  }),
}));

vi.mock("../../context/useWebSocketContext", () => ({
  useWebSocketContext: () => ({
    connected: true,
    subscribe: (...args: unknown[]) => mockSubscribe(...args),
    unsubscribe: (...args: unknown[]) => mockUnsubscribe(...args),
    registerMessageHandler: (
      handler: ((message: WebSocketMessage) => void) | undefined,
    ) => {
      wsMessageHandler = handler;
    },
  }),
}));

vi.mock("../../services/api", () => ({
  markRoomRead: (...args: unknown[]) => mockMarkRoomRead(...args),
  leaveRoom: (...args: unknown[]) => mockLeaveRoom(...args),
}));

vi.mock("../Sidebar", () => ({
  default: (props: SidebarMockProps) => {
    latestSidebarProps = props;
    return (
      <div>
        <div data-testid="refresh-trigger">{props.refreshTrigger}</div>
        <div data-testid="open-command-signal">{props.openCommandPaletteSignal}</div>
        <div data-testid="close-command-signal">{props.closeCommandPaletteSignal}</div>
        <input aria-label="Typing Target" />
        <button type="button" onClick={() => props.onSelectRoom(roomOne)}>
          Select Room One
        </button>
        <button type="button" onClick={() => props.onSelectRoom(roomTwo)}>
          Select Room Two
        </button>
      </div>
    );
  },
}));

vi.mock("../MessageArea", () => ({
  default: ({
    selectedRoom,
    incomingMessages,
    incomingMessageDeletions,
    incomingMessageEdits,
    wsError,
    onLeaveRoom,
    onRoomDeleted,
  }: MessageAreaMockProps) => (
    <div>
      <div data-testid="selected-room-id">{selectedRoom?.id ?? "none"}</div>
      <div data-testid="incoming-count">{incomingMessages.length}</div>
      <div data-testid="incoming-deletions-count">{incomingMessageDeletions.length}</div>
      <div data-testid="incoming-edits-count">{incomingMessageEdits.length}</div>
      <div data-testid="ws-error-text">{wsError ?? ""}</div>
      <button type="button" onClick={onLeaveRoom}>
        Leave Room
      </button>
      <button type="button" onClick={onRoomDeleted}>
        Delete Room
      </button>
    </div>
  ),
}));

vi.mock("../UsersPanel", () => ({
  default: (props: UsersPanelMockProps) => {
    latestUsersPanelProps = props;
    return <div data-testid="online-count">{props.onlineUsers.length}</div>;
  },
}));

vi.mock("../SearchPanel", () => ({
  default: (props: SearchPanelMockProps) => {
    latestSearchPanelProps = props;
    return (
      <div>
        <div data-testid="search-open">{props.isOpen ? "open" : "closed"}</div>
        <div data-testid="search-focus-signal">{props.focusSignal}</div>
      </div>
    );
  },
}));

function emitWsMessage(message: WebSocketMessage) {
  if (!wsMessageHandler) {
    throw new Error("WS handler is not registered");
  }
  act(() => {
    wsMessageHandler?.(message);
  });
}

describe("ChatLayout", () => {
  beforeEach(() => {
    mockSubscribe.mockReset();
    mockUnsubscribe.mockReset();
    mockMarkRoomRead.mockReset();
    mockLeaveRoom.mockReset();
    mockLogout.mockReset();
    latestSidebarProps = null;
    latestUsersPanelProps = null;
    latestSearchPanelProps = null;
    wsMessageHandler = undefined;
    mockMarkRoomRead.mockResolvedValue({ last_read_at: "2024-01-02T00:00:00" });
    mockLeaveRoom.mockResolvedValue({ room_id: 1 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("subscribes when selecting a room and keeps selected room state", async () => {
    render(<ChatLayout />);

    fireEvent.click(screen.getByRole("button", { name: "Select Room One" }));

    await waitFor(() => {
      expect(mockSubscribe).toHaveBeenCalledWith(1);
    });
    expect(screen.getByTestId("selected-room-id")).toHaveTextContent("1");
  });

  it("leave flow clears selection, unsubscribes, and refreshes even when API leave fails", async () => {
    mockLeaveRoom.mockRejectedValueOnce(new Error("Room creator cannot leave"));
    render(<ChatLayout />);

    fireEvent.click(screen.getByRole("button", { name: "Select Room One" }));
    await waitFor(() => {
      expect(screen.getByTestId("selected-room-id")).toHaveTextContent("1");
    });
    await waitFor(() => {
      expect(mockMarkRoomRead).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "Leave Room" }));

    await waitFor(() => {
      expect(mockLeaveRoom).toHaveBeenCalledWith(1, "test-token");
    });
    expect(mockUnsubscribe).toHaveBeenCalledWith(1);
    expect(screen.getByTestId("selected-room-id")).toHaveTextContent("none");
    expect(screen.getByTestId("refresh-trigger")).toHaveTextContent("1");
    expect(screen.getByText("Room creator cannot leave")).toBeInTheDocument();
  });

  it("delete flow prunes room-scoped online users so reselecting starts clean", async () => {
    render(<ChatLayout />);

    fireEvent.click(screen.getByRole("button", { name: "Select Room One" }));
    await waitFor(() => {
      expect(screen.getByTestId("selected-room-id")).toHaveTextContent("1");
    });

    emitWsMessage({
      type: "subscribed",
      room_id: 1,
      online_users: [{ id: 22, username: "bob" }],
    });
    expect(screen.getByTestId("online-count")).toHaveTextContent("1");
    expect(latestUsersPanelProps?.onlineUsers[0]?.username).toBe("bob");

    fireEvent.click(screen.getByRole("button", { name: "Delete Room" }));
    expect(mockUnsubscribe).toHaveBeenCalledWith(1);
    expect(screen.getByTestId("selected-room-id")).toHaveTextContent("none");
    expect(screen.getByTestId("refresh-trigger")).toHaveTextContent("1");

    fireEvent.click(screen.getByRole("button", { name: "Select Room One" }));
    await waitFor(() => {
      expect(screen.getByTestId("selected-room-id")).toHaveTextContent("1");
    });
    await waitFor(() => {
      expect(mockMarkRoomRead).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByTestId("online-count")).toHaveTextContent("0");
  });

  it("routes websocket new_message to incoming queue or unread counts based on selected room", async () => {
    render(<ChatLayout />);

    fireEvent.click(screen.getByRole("button", { name: "Select Room One" }));
    await waitFor(() => {
      expect(screen.getByTestId("selected-room-id")).toHaveTextContent("1");
    });

    emitWsMessage({
      type: "new_message",
      message: {
        id: 101,
        room_id: 1,
        user_id: 9,
        username: "bob",
        content: "hello",
        created_at: "2024-01-01T00:00:00",
      },
    });
    expect(screen.getByTestId("incoming-count")).toHaveTextContent("1");

    fireEvent.click(screen.getByRole("button", { name: "Select Room Two" }));
    await waitFor(() => {
      expect(screen.getByTestId("selected-room-id")).toHaveTextContent("2");
    });

    emitWsMessage({
      type: "new_message",
      message: {
        id: 102,
        room_id: 1,
        user_id: 9,
        username: "bob",
        content: "still there",
        created_at: "2024-01-01T00:00:10",
      },
    });

    expect(latestSidebarProps?.unreadCounts[1]).toBe(1);
  });

  it("routes websocket message_deleted to selected-room deletion queue", async () => {
    render(<ChatLayout />);

    fireEvent.click(screen.getByRole("button", { name: "Select Room One" }));
    await waitFor(() => {
      expect(screen.getByTestId("selected-room-id")).toHaveTextContent("1");
    });

    emitWsMessage({
      type: "message_deleted",
      message: {
        id: 101,
        room_id: 1,
        deleted_at: "2024-01-01T00:00:00Z",
      },
    });
    expect(screen.getByTestId("incoming-deletions-count")).toHaveTextContent("1");

    emitWsMessage({
      type: "message_deleted",
      message: {
        id: 102,
        room_id: 2,
        deleted_at: "2024-01-01T00:01:00Z",
      },
    });
    // Non-selected room deletions are ignored in the selected-room queue.
    expect(screen.getByTestId("incoming-deletions-count")).toHaveTextContent("1");
  });

  it("routes websocket message_edited to selected-room edit queue", async () => {
    render(<ChatLayout />);

    fireEvent.click(screen.getByRole("button", { name: "Select Room One" }));
    await waitFor(() => {
      expect(screen.getByTestId("selected-room-id")).toHaveTextContent("1");
    });

    emitWsMessage({
      type: "message_edited",
      message: {
        id: 103,
        room_id: 1,
        content: "Updated content",
        edited_at: "2024-01-01T00:02:00Z",
      },
    });
    expect(screen.getByTestId("incoming-edits-count")).toHaveTextContent("1");

    emitWsMessage({
      type: "message_edited",
      message: {
        id: 104,
        room_id: 2,
        content: "Other room update",
        edited_at: "2024-01-01T00:03:00Z",
      },
    });
    // Non-selected room edits are ignored in the selected-room queue.
    expect(screen.getByTestId("incoming-edits-count")).toHaveTextContent("1");
  });

  it("shows websocket errors and auto-clears the banner after four seconds", async () => {
    vi.useFakeTimers();
    render(<ChatLayout />);

    emitWsMessage({
      type: "error",
      message: "Message rate limit exceeded",
    });
    expect(screen.getByTestId("ws-error-text")).toHaveTextContent(
      "Message rate limit exceeded",
    );

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(screen.getByTestId("ws-error-text")).toHaveTextContent("");
  });

  it("opens command palette signal on Cmd/Ctrl+K", () => {
    render(<ChatLayout />);

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });

    expect(screen.getByTestId("open-command-signal")).toHaveTextContent("1");
  });

  it("opens search panel on slash when a room is selected", async () => {
    render(<ChatLayout />);

    fireEvent.click(screen.getByRole("button", { name: "Select Room One" }));
    await waitFor(() => {
      expect(screen.getByTestId("selected-room-id")).toHaveTextContent("1");
    });
    expect(screen.getByTestId("search-open")).toHaveTextContent("closed");

    fireEvent.keyDown(window, { key: "/" });

    expect(screen.getByTestId("search-open")).toHaveTextContent("open");
    expect(screen.getByTestId("search-focus-signal")).toHaveTextContent("1");
    expect(latestSearchPanelProps?.isOpen).toBe(true);
  });

  it("does not open search panel on slash while typing in an input target", async () => {
    render(<ChatLayout />);

    fireEvent.click(screen.getByRole("button", { name: "Select Room One" }));
    await waitFor(() => {
      expect(screen.getByTestId("selected-room-id")).toHaveTextContent("1");
    });
    expect(screen.getByTestId("search-open")).toHaveTextContent("closed");

    const typingInput = screen.getByLabelText("Typing Target");
    typingInput.focus();
    fireEvent.keyDown(typingInput, { key: "/" });

    expect(screen.getByTestId("search-open")).toHaveTextContent("closed");
    expect(screen.getByTestId("search-focus-signal")).toHaveTextContent("0");
  });

  it("escape closes right panel and emits close command palette signal", async () => {
    render(<ChatLayout />);

    fireEvent.click(screen.getByRole("button", { name: "Select Room One" }));
    await waitFor(() => {
      expect(screen.getByTestId("selected-room-id")).toHaveTextContent("1");
    });

    fireEvent.keyDown(window, { key: "/" });
    expect(screen.getByTestId("search-open")).toHaveTextContent("open");

    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.getByTestId("search-open")).toHaveTextContent("closed");
    expect(screen.getByTestId("close-command-signal")).toHaveTextContent("1");
  });
});

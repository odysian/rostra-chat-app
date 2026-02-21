import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import MessageArea from "../MessageArea";
import type { Message, Room } from "../../types";

const mockDeleteRoom = vi.fn();
const mockOnIncomingMessagesProcessed = vi.fn();
const mockOnToggleUsers = vi.fn();
const mockOnToggleSearch = vi.fn();
const mockOnRoomDeleted = vi.fn();
const mockOnLeaveRoom = vi.fn();
const mockOnBackToRooms = vi.fn();
const mockOnDismissWsError = vi.fn();

const selectedRoom: Room = {
  id: 10,
  name: "General Discussion",
  created_by: 1,
  created_at: "2024-01-01T00:00:00",
};

const incomingMessages: Message[] = [];

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 1, username: "alice", email: "alice@example.com", created_at: "2024-01-01T00:00:00" },
    token: "test-token",
  }),
}));

vi.mock("../../context/ThemeContext", () => ({
  useTheme: () => ({
    theme: "neon" as const,
  }),
}));

vi.mock("../../services/api", () => ({
  deleteRoom: (...args: unknown[]) => mockDeleteRoom(...args),
}));

vi.mock("../MessageList", () => ({
  default: ({ roomId }: { roomId: number }) => (
    <div data-testid="message-list">Message list for room {roomId}</div>
  ),
}));

vi.mock("../MessageInput", () => ({
  default: ({ roomName }: { roomName: string }) => (
    <div data-testid="message-input">
      <label htmlFor="mock-message-input">Input for {roomName}</label>
      <textarea id="mock-message-input" data-tab-focus="message-input" />
      <button type="button" data-tab-focus="send-button">
        Send
      </button>
    </div>
  ),
}));

function renderMessageArea(overrides?: Partial<ComponentProps<typeof MessageArea>>) {
  return render(
    <MessageArea
      selectedRoom={selectedRoom}
      incomingMessages={incomingMessages}
      onIncomingMessagesProcessed={mockOnIncomingMessagesProcessed}
      onToggleUsers={mockOnToggleUsers}
      onToggleSearch={mockOnToggleSearch}
      onRoomDeleted={mockOnRoomDeleted}
      onLeaveRoom={mockOnLeaveRoom}
      onBackToRooms={mockOnBackToRooms}
      typingUsernames={[]}
      wsError={null}
      onDismissWsError={mockOnDismissWsError}
      {...overrides}
    />,
  );
}

describe("MessageArea", () => {
  beforeEach(() => {
    mockDeleteRoom.mockReset();
    mockOnIncomingMessagesProcessed.mockReset();
    mockOnToggleUsers.mockReset();
    mockOnToggleSearch.mockReset();
    mockOnRoomDeleted.mockReset();
    mockOnLeaveRoom.mockReset();
    mockOnBackToRooms.mockReset();
    mockOnDismissWsError.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows welcome screen when no room is selected", () => {
    renderMessageArea({ selectedRoom: null });
    expect(
      screen.getByText("Select a room from the sidebar to start chatting"),
    ).toBeInTheDocument();
  });

  it("renders room header and menu options", async () => {
    const user = userEvent.setup();
    renderMessageArea();

    expect(screen.getByText("#General-Discussion")).toBeInTheDocument();
    await user.click(screen.getByTitle("Room options"));

    expect(screen.getByRole("button", { name: "Leave Room" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete Room" })).toBeInTheDocument();
  });

  it("hides delete option for non-room-owner", async () => {
    const user = userEvent.setup();
    renderMessageArea({
      selectedRoom: {
        ...selectedRoom,
        created_by: 999,
      },
    });

    await user.click(screen.getByTitle("Room options"));
    expect(screen.getByRole("button", { name: "Leave Room" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Delete Room" }),
    ).not.toBeInTheDocument();
  });

  it("calls leave callback when Leave Room is clicked", async () => {
    const user = userEvent.setup();
    renderMessageArea();

    await user.click(screen.getByRole("button", { name: "Room options" }));
    await user.click(screen.getByRole("button", { name: "Leave Room" }));

    expect(mockOnLeaveRoom).toHaveBeenCalledTimes(1);
  });

  it("closes room options menu on Escape", async () => {
    const user = userEvent.setup();
    renderMessageArea();

    await user.click(screen.getByRole("button", { name: "Room options" }));
    expect(screen.getByRole("button", { name: "Leave Room" })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Leave Room" }),
      ).not.toBeInTheDocument();
    });
  });

  it("deletes room and calls onRoomDeleted on success", async () => {
    const user = userEvent.setup();
    let resolveDelete: () => void;
    const pendingDelete = new Promise<void>((resolve) => {
      resolveDelete = resolve;
    });
    mockDeleteRoom.mockReturnValueOnce(pendingDelete);

    renderMessageArea();

    await user.click(screen.getByTitle("Room options"));
    await user.click(screen.getByRole("button", { name: "Delete Room" }));
    await user.click(screen.getByRole("button", { name: "DELETE ROOM" }));
    expect(screen.getByRole("button", { name: "DELETING..." })).toBeDisabled();

    resolveDelete!();
    await waitFor(() => {
      expect(mockOnRoomDeleted).toHaveBeenCalledTimes(1);
    });
    expect(mockDeleteRoom).toHaveBeenCalledWith(10, "test-token");
  });

  it("shows inline delete error on API failure", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const user = userEvent.setup();
    mockDeleteRoom.mockRejectedValueOnce(new Error("Delete failed"));

    renderMessageArea();

    await user.click(screen.getByTitle("Room options"));
    await user.click(screen.getByRole("button", { name: "Delete Room" }));
    await user.click(screen.getByRole("button", { name: "DELETE ROOM" }));

    expect(await screen.findByText("Delete failed")).toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("supports typing indicator text formats", () => {
    const { rerender } = renderMessageArea({ typingUsernames: ["alice"] });
    expect(screen.getByText("alice is typing")).toBeInTheDocument();

    rerender(
      <MessageArea
        selectedRoom={selectedRoom}
        incomingMessages={incomingMessages}
        onIncomingMessagesProcessed={mockOnIncomingMessagesProcessed}
        onToggleUsers={mockOnToggleUsers}
        onToggleSearch={mockOnToggleSearch}
        onRoomDeleted={mockOnRoomDeleted}
        onLeaveRoom={mockOnLeaveRoom}
        onBackToRooms={mockOnBackToRooms}
        typingUsernames={["alice", "bob"]}
        wsError={null}
        onDismissWsError={mockOnDismissWsError}
      />,
    );
    expect(screen.getByText("alice and bob are typing")).toBeInTheDocument();

    rerender(
      <MessageArea
        selectedRoom={selectedRoom}
        incomingMessages={incomingMessages}
        onIncomingMessagesProcessed={mockOnIncomingMessagesProcessed}
        onToggleUsers={mockOnToggleUsers}
        onToggleSearch={mockOnToggleSearch}
        onRoomDeleted={mockOnRoomDeleted}
        onLeaveRoom={mockOnLeaveRoom}
        onBackToRooms={mockOnBackToRooms}
        typingUsernames={["alice", "bob", "carol"]}
        wsError={null}
        onDismissWsError={mockOnDismissWsError}
      />,
    );
    expect(
      screen.getByText("alice, bob, and carol are typing"),
    ).toBeInTheDocument();

    rerender(
      <MessageArea
        selectedRoom={selectedRoom}
        incomingMessages={incomingMessages}
        onIncomingMessagesProcessed={mockOnIncomingMessagesProcessed}
        onToggleUsers={mockOnToggleUsers}
        onToggleSearch={mockOnToggleSearch}
        onRoomDeleted={mockOnRoomDeleted}
        onLeaveRoom={mockOnLeaveRoom}
        onBackToRooms={mockOnBackToRooms}
        typingUsernames={["alice", "bob", "carol", "dave"]}
        wsError={null}
        onDismissWsError={mockOnDismissWsError}
      />,
    );
    expect(
      screen.getByText("alice, bob, and 2 others are typing"),
    ).toBeInTheDocument();
  });

  it("renders and dismisses ws error banner", async () => {
    const user = userEvent.setup();
    renderMessageArea({ wsError: "Message rate limit exceeded" });

    expect(screen.getByText("Message rate limit exceeded")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(mockOnDismissWsError).toHaveBeenCalledTimes(1);
  });

  it("uses requested tab order inside chat area controls", () => {
    renderMessageArea();

    const input = screen.getByLabelText(/Input for General-Discussion/i);
    const sendButton = screen.getByRole("button", { name: "Send" });
    const backButton = screen.getByRole("button", { name: "Back to rooms" });
    const roomMenuButton = screen.getByRole("button", { name: "Room options" });
    const searchButton = screen.getByRole("button", { name: "Search messages" });
    const usersButton = screen.getByRole("button", { name: "Toggle users panel" });
    const pressTab = (shiftKey = false) => {
      if (!(document.activeElement instanceof HTMLElement)) {
        throw new Error("No active element to tab from");
      }
      fireEvent.keyDown(document.activeElement, { key: "Tab", shiftKey });
    };

    input.focus();
    pressTab();
    expect(sendButton).toHaveFocus();

    pressTab();
    expect(backButton).toHaveFocus();

    pressTab();
    expect(roomMenuButton).toHaveFocus();

    pressTab();
    expect(searchButton).toHaveFocus();

    pressTab();
    expect(usersButton).toHaveFocus();

    pressTab(true);
    expect(searchButton).toHaveFocus();
  });
});

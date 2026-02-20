import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { RoomDiscoveryModal } from "../RoomDiscoveryModal";
import type { Room } from "../../types";

const mockDiscoverRooms = vi.fn();
const mockJoinRoom = vi.fn();
const mockLeaveRoom = vi.fn();
const mockOnClose = vi.fn();
const mockOnRoomJoined = vi.fn();

const roomsFixture: Room[] = [
  {
    id: 1,
    name: "General Discussion",
    created_by: 1,
    created_at: "2024-01-01T00:00:00",
  },
  {
    id: 2,
    name: "Frontend Team",
    created_by: 2,
    created_at: "2024-01-01T00:00:00",
  },
];

vi.mock("../../services/api", () => ({
  discoverRooms: (...args: unknown[]) => mockDiscoverRooms(...args),
  joinRoom: (...args: unknown[]) => mockJoinRoom(...args),
  leaveRoom: (...args: unknown[]) => mockLeaveRoom(...args),
}));

function renderModal(overrides?: Partial<ComponentProps<typeof RoomDiscoveryModal>>) {
  return render(
    <RoomDiscoveryModal
      isOpen={true}
      onClose={mockOnClose}
      onRoomJoined={mockOnRoomJoined}
      currentUserId={1}
      joinedRoomIds={new Set([1])}
      token="test-token"
      {...overrides}
    />,
  );
}

describe("RoomDiscoveryModal", () => {
  beforeEach(() => {
    mockDiscoverRooms.mockReset();
    mockJoinRoom.mockReset();
    mockLeaveRoom.mockReset();
    mockOnClose.mockReset();
    mockOnRoomJoined.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders nothing when closed", () => {
    mockDiscoverRooms.mockResolvedValue(roomsFixture);

    const { container } = renderModal({ isOpen: false });
    expect(container).toBeEmptyDOMElement();
  });

  it("shows loading state while fetching rooms", async () => {
    let resolveRooms: (value: Room[]) => void;
    const pendingRooms = new Promise<Room[]>((resolve) => {
      resolveRooms = resolve;
    });
    mockDiscoverRooms.mockReturnValueOnce(pendingRooms);

    renderModal();
    expect(screen.getByText("Loading rooms...")).toBeInTheDocument();

    resolveRooms!(roomsFixture);
    await waitFor(() => {
      expect(screen.getByText("General-Discussion")).toBeInTheDocument();
    });
  });

  it("renders browse tab with JOINED and JOIN states", async () => {
    mockDiscoverRooms.mockResolvedValueOnce(roomsFixture);

    renderModal();

    expect(await screen.findByText("General-Discussion")).toBeInTheDocument();
    expect(screen.getByText("JOINED")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "JOIN" })).toBeInTheDocument();
  });

  it("joins a room and triggers refresh callback", async () => {
    const user = userEvent.setup();
    let resolveJoin: () => void;
    const joinPending = new Promise<void>((resolve) => {
      resolveJoin = resolve;
    });

    mockDiscoverRooms.mockResolvedValueOnce(roomsFixture);
    mockJoinRoom.mockReturnValueOnce(joinPending);

    renderModal();
    await screen.findByText("Frontend-Team");

    await user.click(screen.getByRole("button", { name: "JOIN" }));
    // Optimistic state marks room joined immediately in browse mode.
    expect(screen.getAllByText("JOINED").length).toBeGreaterThan(1);

    resolveJoin!();
    await waitFor(() => {
      expect(mockOnRoomJoined).toHaveBeenCalledTimes(1);
    });
  });

  it("shows join error and rolls back optimistic state", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const user = userEvent.setup();
    mockDiscoverRooms.mockResolvedValueOnce(roomsFixture);
    mockJoinRoom.mockRejectedValueOnce(new Error("Already a member"));

    renderModal();
    await screen.findByText("Frontend-Team");

    await user.click(screen.getByRole("button", { name: "JOIN" }));

    expect(await screen.findByText("Already a member of this room")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "JOIN" })).toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("filters to joined rooms in your rooms tab and supports leave", async () => {
    const user = userEvent.setup();
    mockDiscoverRooms.mockResolvedValueOnce(roomsFixture);
    mockLeaveRoom.mockResolvedValueOnce({ message: "left", room_id: 2 });

    renderModal({ joinedRoomIds: new Set([1, 2]) });

    await screen.findByText("Frontend-Team");
    await user.click(screen.getByRole("button", { name: /YOUR ROOMS/i }));

    expect(screen.getByText("General-Discussion")).toBeInTheDocument();
    expect(screen.getAllByText("OWNER").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "LEAVE" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "LEAVE" }));
    await waitFor(() => {
      expect(mockOnRoomJoined).toHaveBeenCalledTimes(1);
    });
  });

  it("shows creator leave failure message", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const user = userEvent.setup();
    mockDiscoverRooms.mockResolvedValueOnce(roomsFixture);
    mockLeaveRoom.mockRejectedValueOnce(new Error("creator cannot leave"));

    renderModal({ joinedRoomIds: new Set([1, 2]) });
    await screen.findByText("Frontend-Team");

    await user.click(screen.getByRole("button", { name: /YOUR ROOMS/i }));
    await user.click(screen.getByRole("button", { name: "LEAVE" }));

    expect(
      await screen.findByText("Room owners cannot leave their own rooms. Delete the room instead."),
    ).toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("closes on Escape key", async () => {
    mockDiscoverRooms.mockResolvedValueOnce(roomsFixture);
    renderModal();

    await screen.findByText("General-Discussion");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("closes on backdrop click", async () => {
    const user = userEvent.setup();
    mockDiscoverRooms.mockResolvedValueOnce(roomsFixture);
    renderModal();

    const dialog = await screen.findByRole("dialog");
    await user.click(dialog);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});

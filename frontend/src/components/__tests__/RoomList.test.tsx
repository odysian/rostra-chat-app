import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import RoomList from "../RoomList";
import type { Room } from "../../types";

const mockGetRooms = vi.fn();
const mockCreateRoom = vi.fn();
const mockOnSelectRoom = vi.fn();
const mockOnUnreadCountsLoaded = vi.fn();
const mockOnInitialRoomsLoaded = vi.fn();
const mockOnLogout = vi.fn();
const mockOnExpandSidebar = vi.fn();

const roomsFixture: Room[] = [
  {
    id: 1,
    name: "General Discussion",
    created_by: 1,
    created_at: "2024-01-01T00:00:00",
    unread_count: 0,
  },
  {
    id: 2,
    name: "Engineering Room",
    created_by: 2,
    created_at: "2024-01-01T00:00:00",
    unread_count: 120,
  },
];

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    token: "test-token",
    user: {
      id: 1,
      username: "alice",
      email: "alice@example.com",
      created_at: "2024-01-01T00:00:00",
    },
  }),
}));

vi.mock("../../context/ThemeContext", () => ({
  useTheme: () => ({
    theme: "neon" as const,
  }),
}));

vi.mock("../../services/api", () => ({
  getRooms: (...args: unknown[]) => mockGetRooms(...args),
  createRoom: (...args: unknown[]) => mockCreateRoom(...args),
}));

vi.mock("../RoomDiscoveryModal", () => ({
  RoomDiscoveryModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div>Room discovery modal</div> : null,
}));

function renderRoomList(overrides?: Partial<ComponentProps<typeof RoomList>>) {
  return render(
    <RoomList
      selectedRoom={null}
      sidebarOpen={true}
      unreadCounts={{}}
      onSelectRoom={mockOnSelectRoom}
      onUnreadCountsLoaded={mockOnUnreadCountsLoaded}
      onInitialRoomsLoaded={mockOnInitialRoomsLoaded}
      onLogout={mockOnLogout}
      onExpandSidebar={mockOnExpandSidebar}
      {...overrides}
    />,
  );
}

describe("RoomList", () => {
  beforeEach(() => {
    mockGetRooms.mockReset();
    mockCreateRoom.mockReset();
    mockOnSelectRoom.mockReset();
    mockOnUnreadCountsLoaded.mockReset();
    mockOnInitialRoomsLoaded.mockReset();
    mockOnLogout.mockReset();
    mockOnExpandSidebar.mockReset();
  });

  it("shows loading state while fetching rooms", async () => {
    let resolveRooms: (value: Room[]) => void;
    const pendingRooms = new Promise<Room[]>((resolve) => {
      resolveRooms = resolve;
    });
    mockGetRooms.mockReturnValueOnce(pendingRooms);

    renderRoomList();
    expect(screen.getByText("Loading rooms...")).toBeInTheDocument();

    resolveRooms!(roomsFixture);
    await waitFor(() => {
      expect(screen.getByText("General-Discussion")).toBeInTheDocument();
    });
  });

  it("renders rooms and calls selection callback on click", async () => {
    const user = userEvent.setup();
    mockGetRooms.mockResolvedValueOnce(roomsFixture);

    renderRoomList();

    const roomButton = await screen.findByRole("button", {
      name: /General-Discussion/i,
    });
    await user.click(roomButton);

    expect(mockOnSelectRoom).toHaveBeenCalledWith(roomsFixture[0]);
  });

  it("loads unread counts and initial room list callbacks", async () => {
    mockGetRooms.mockResolvedValueOnce(roomsFixture);
    renderRoomList();

    await screen.findByText("General-Discussion");
    expect(mockOnUnreadCountsLoaded).toHaveBeenCalledWith({ 1: 0, 2: 120 });
    expect(mockOnInitialRoomsLoaded).toHaveBeenCalledWith(roomsFixture);
  });

  it("shows unread badge for non-selected rooms and caps at 99+", async () => {
    mockGetRooms.mockResolvedValueOnce(roomsFixture);

    renderRoomList({
      selectedRoom: roomsFixture[0],
      unreadCounts: { 1: 5, 2: 120 },
    });

    await screen.findByText("Engineering-Room");
    expect(screen.queryByText("5")).not.toBeInTheDocument();
    expect(screen.getByText("99+")).toBeInTheDocument();
  });

  it("shows empty state when no rooms exist", async () => {
    mockGetRooms.mockResolvedValueOnce([]);
    renderRoomList();

    expect(
      await screen.findByText("No rooms yet. Create one below!"),
    ).toBeInTheDocument();
  });

  it("shows fetch error and retries successfully", async () => {
    const user = userEvent.setup();
    mockGetRooms
      .mockRejectedValueOnce(new Error("Failed to load rooms"))
      .mockResolvedValueOnce(roomsFixture);

    renderRoomList();

    expect(await screen.findByText("Failed to load rooms")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => {
      expect(screen.getByText("General-Discussion")).toBeInTheDocument();
    });
    expect(mockGetRooms).toHaveBeenCalledTimes(2);
  });

  it("validates create room form length constraints", async () => {
    const user = userEvent.setup();
    mockGetRooms.mockResolvedValueOnce(roomsFixture);

    renderRoomList();
    await screen.findByText("General-Discussion");

    await user.click(screen.getByTitle("Create new room"));
    expect(screen.getByRole("heading", { name: "Create New Room" })).toBeInTheDocument();
    const modal = screen.getByRole("heading", { name: "Create New Room" }).closest("div");
    if (!modal) {
      throw new Error("Create room modal not found");
    }

    const input = screen.getByLabelText("ROOM NAME");
    await user.type(input, "ab");
    await user.click(within(modal).getByRole("button", { name: "CREATE ROOM" }));
    expect(
      await screen.findByText("Room name must be at least 3 characters"),
    ).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, "a".repeat(51));
    await user.click(within(modal).getByRole("button", { name: "CREATE ROOM" }));
    expect(
      await screen.findByText("Room name must be less than 50 characters"),
    ).toBeInTheDocument();
  });

  it("disables create submit button for empty room name", async () => {
    const user = userEvent.setup();
    mockGetRooms.mockResolvedValueOnce(roomsFixture);

    renderRoomList();
    await screen.findByText("General-Discussion");
    await user.click(screen.getByTitle("Create new room"));
    const modal = screen.getByRole("heading", { name: "Create New Room" }).closest("div");
    if (!modal) {
      throw new Error("Create room modal not found");
    }
    expect(within(modal).getByRole("button", { name: "CREATE ROOM" })).toBeDisabled();
  });

  it("creates room, closes modal, and selects the new room", async () => {
    const user = userEvent.setup();
    const newRoom: Room = {
      id: 3,
      name: "Brand New Room",
      created_by: 1,
      created_at: "2024-01-01T00:00:00",
    };
    mockGetRooms.mockResolvedValueOnce(roomsFixture);
    mockCreateRoom.mockResolvedValueOnce(newRoom);

    renderRoomList();
    await screen.findByText("General-Discussion");

    await user.click(screen.getByTitle("Create new room"));
    const modal = screen.getByRole("heading", { name: "Create New Room" }).closest("div");
    if (!modal) {
      throw new Error("Create room modal not found");
    }
    await user.type(screen.getByLabelText("ROOM NAME"), "Brand New Room");
    await user.click(within(modal).getByRole("button", { name: "CREATE ROOM" }));

    await waitFor(() => {
      expect(mockCreateRoom).toHaveBeenCalledWith("Brand New Room", "test-token");
    });
    expect(mockOnSelectRoom).toHaveBeenCalledWith(newRoom);
    expect(
      screen.queryByRole("heading", { name: "Create New Room" }),
    ).not.toBeInTheDocument();
  });

  it("shows inline create error when room creation fails", async () => {
    const user = userEvent.setup();
    mockGetRooms.mockResolvedValueOnce(roomsFixture);
    mockCreateRoom.mockRejectedValueOnce(new Error("Failed to create room"));

    renderRoomList();
    await screen.findByText("General-Discussion");

    await user.click(screen.getByTitle("Create new room"));
    const modal = screen.getByRole("heading", { name: "Create New Room" }).closest("div");
    if (!modal) {
      throw new Error("Create room modal not found");
    }
    await user.type(screen.getByLabelText("ROOM NAME"), "Good Name");
    await user.click(within(modal).getByRole("button", { name: "CREATE ROOM" }));

    expect(await screen.findByText("Failed to create room")).toBeInTheDocument();
  });
});

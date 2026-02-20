import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import UsersPanel from "../UsersPanel";

const mockOnClose = vi.fn();
let mockConnectionStatus:
  | "disconnected"
  | "connecting"
  | "reconnecting"
  | "connected"
  | "error" = "connected";

vi.mock("../../context/useWebSocketContext", () => ({
  useWebSocketContext: () => ({
    connectionStatus: mockConnectionStatus,
  }),
}));

vi.mock("../../context/ThemeContext", () => ({
  useTheme: () => ({
    theme: "neon" as const,
  }),
}));

function renderUsersPanel(overrides?: Partial<ComponentProps<typeof UsersPanel>>) {
  return render(
    <UsersPanel
      isOpen={true}
      onClose={mockOnClose}
      currentUser={{
        id: 1,
        username: "alice",
        email: "alice@example.com",
        created_at: "2024-01-01T00:00:00",
      }}
      onlineUsers={[
        { id: 1, username: "alice" },
        { id: 2, username: "bob" },
      ]}
      roomOwnerId={2}
      {...overrides}
    />,
  );
}

describe("UsersPanel", () => {
  beforeEach(() => {
    mockOnClose.mockReset();
    mockConnectionStatus = "connected";
  });

  it("returns null when closed", () => {
    const { container } = renderUsersPanel({ isOpen: false });
    expect(container).toBeEmptyDOMElement();
  });

  it('shows online header count and users', () => {
    renderUsersPanel();
    expect(screen.getByText("ONLINE — 2")).toBeInTheDocument();
    expect(screen.getByText("alice")).toBeInTheDocument();
    expect(screen.getByText("bob")).toBeInTheDocument();
  });

  it("shows crown marker for room owner", () => {
    renderUsersPanel();
    expect(screen.getByTitle("Room owner")).toBeInTheDocument();
  });

  it("reflects current user status title from websocket state", () => {
    mockConnectionStatus = "reconnecting";
    renderUsersPanel();

    expect(screen.getByTitle("Reconnecting...")).toBeInTheDocument();
  });

  it('shows empty message when no users are online', () => {
    renderUsersPanel({ onlineUsers: [] });
    expect(screen.getByText("No one here yet...")).toBeInTheDocument();
  });

  it("closes panel on mobile backdrop click", async () => {
    const user = userEvent.setup();
    renderUsersPanel();

    const backdrop = screen.getByTestId("users-panel-backdrop");
    await user.click(backdrop);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { act, fireEvent, render, screen } from "@testing-library/react";
import MessageInput from "../MessageInput";

const mockSendMessage = vi.fn();
const mockSendTypingIndicator = vi.fn();
const mockOnMessageSent = vi.fn();
let mockConnected = true;

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    token: "test-token",
  }),
}));

vi.mock("../../context/useWebSocketContext", () => ({
  useWebSocketContext: () => ({
    connected: mockConnected,
    sendMessage: mockSendMessage,
    sendTypingIndicator: mockSendTypingIndicator,
  }),
}));

describe("MessageInput", () => {
  beforeEach(() => {
    mockSendMessage.mockReset();
    mockSendTypingIndicator.mockReset();
    mockOnMessageSent.mockReset();
    mockConnected = true;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders textarea placeholder with formatted room name", () => {
    render(<MessageInput roomId={1} roomName="General Discussion" />);
    expect(
      screen.getByPlaceholderText("Message #General-Discussion"),
    ).toBeInTheDocument();
  });

  it("keeps send disabled when input is empty", () => {
    render(<MessageInput roomId={1} roomName="General Discussion" />);
    expect(screen.getByRole("button", { name: /SEND/i })).toBeDisabled();
  });

  it("submits on Enter and clears input", async () => {
    const user = userEvent.setup();
    render(
      <MessageInput
        roomId={5}
        roomName="General Discussion"
        onMessageSent={mockOnMessageSent}
      />,
    );

    const textarea = screen.getByPlaceholderText("Message #General-Discussion");
    await user.type(textarea, "Hello world");
    fireEvent.keyDown(textarea, { key: "Enter", code: "Enter", shiftKey: false });

    expect(mockSendMessage).toHaveBeenCalledWith(5, "Hello world");
    expect(mockOnMessageSent).toHaveBeenCalledTimes(1);
    expect(textarea).toHaveValue("");
  });

  it("does not submit on Shift+Enter", async () => {
    const user = userEvent.setup();
    render(<MessageInput roomId={2} roomName="General Discussion" />);

    const textarea = screen.getByPlaceholderText("Message #General-Discussion");
    await user.type(textarea, "Line one");
    fireEvent.keyDown(textarea, { key: "Enter", code: "Enter", shiftKey: true });

    expect(mockSendMessage).not.toHaveBeenCalled();
    expect(textarea).toHaveValue("Line one");
  });

  it("does not submit whitespace-only input", async () => {
    const user = userEvent.setup();
    render(<MessageInput roomId={3} roomName="General Discussion" />);

    const textarea = screen.getByPlaceholderText("Message #General-Discussion");
    await user.type(textarea, "   ");
    await user.click(screen.getByRole("button", { name: /SEND/i }));

    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("throttles typing indicator to once per 2 seconds", () => {
    vi.useFakeTimers();

    render(<MessageInput roomId={9} roomName="General Discussion" />);
    const textarea = screen.getByPlaceholderText("Message #General-Discussion");

    fireEvent.change(textarea, { target: { value: "a" } });
    fireEvent.change(textarea, { target: { value: "ab" } });
    expect(mockSendTypingIndicator).toHaveBeenCalledTimes(1);
    expect(mockSendTypingIndicator).toHaveBeenCalledWith(9);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    fireEvent.change(textarea, { target: { value: "abc" } });
    expect(mockSendTypingIndicator).toHaveBeenCalledTimes(2);
  });

  it("preserves input and shows error when websocket is disconnected", async () => {
    const user = userEvent.setup();
    mockConnected = false;
    render(<MessageInput roomId={8} roomName="General Discussion" />);

    const textarea = screen.getByPlaceholderText("Message #General-Discussion");
    await user.type(textarea, "Will retry");
    await user.click(screen.getByRole("button", { name: /SEND/i }));

    expect(mockSendMessage).not.toHaveBeenCalled();
    expect(textarea).toHaveValue("Will retry");
    expect(
      screen.getByText("Not connected. Wait for reconnection and try again."),
    ).toBeInTheDocument();
  });
});

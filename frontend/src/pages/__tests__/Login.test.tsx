import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, beforeEach, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@testing-library/react";
import Login from "../Login";

const mockNavigate = vi.fn();
const mockAuthLogin = vi.fn();
const mockLogin = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    login: mockAuthLogin,
  }),
}));

vi.mock("../../context/ThemeContext", () => ({
  useTheme: () => ({
    theme: "neon" as const,
  }),
}));

vi.mock("../../services/api", () => ({
  login: (...args: unknown[]) => mockLogin(...args),
}));

describe("Login", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockAuthLogin.mockReset();
    mockLogin.mockReset();
    mockAuthLogin.mockResolvedValue(undefined);
  });

  it("renders username/password inputs and sign in button", () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText("USERNAME")).toBeInTheDocument();
    expect(screen.getByLabelText("PASSWORD")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "SIGN IN" })).toBeInTheDocument();
  });

  it("submits valid credentials and navigates to chat", async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValue({
      access_token: "token-123",
      token_type: "bearer",
    });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText("USERNAME"), "alice");
    await user.type(screen.getByLabelText("PASSWORD"), "password123");
    await user.click(screen.getByRole("button", { name: "SIGN IN" }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        username: "alice",
        password: "password123",
      });
    });
    await waitFor(() => {
      expect(mockAuthLogin).toHaveBeenCalledWith("token-123");
    });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/chat");
    });
  });

  it("shows loading state while request is in flight", async () => {
    const user = userEvent.setup();
    let resolveLogin: (value: { access_token: string; token_type: string }) => void;
    const loginPromise = new Promise<{ access_token: string; token_type: string }>(
      (resolve) => {
        resolveLogin = resolve;
      },
    );
    mockLogin.mockReturnValue(loginPromise);

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText("USERNAME"), "alice");
    await user.type(screen.getByLabelText("PASSWORD"), "password123");
    await user.click(screen.getByRole("button", { name: "SIGN IN" }));

    expect(
      screen.getByRole("button", { name: /SIGNING IN\.\.\./i }),
    ).toBeDisabled();

    resolveLogin!({ access_token: "token-123", token_type: "bearer" });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/chat");
    });
  });

  it("shows API error message for invalid credentials", async () => {
    const user = userEvent.setup();
    mockLogin.mockRejectedValue(new Error("Invalid username or password"));

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText("USERNAME"), "alice");
    await user.type(screen.getByLabelText("PASSWORD"), "wrong");
    await user.click(screen.getByRole("button", { name: "SIGN IN" }));

    expect(
      await screen.findByText("Invalid username or password"),
    ).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("shows fallback message for non-Error failures", async () => {
    const user = userEvent.setup();
    mockLogin.mockRejectedValue("network failed");

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText("USERNAME"), "alice");
    await user.type(screen.getByLabelText("PASSWORD"), "wrong");
    await user.click(screen.getByRole("button", { name: "SIGN IN" }));

    expect(await screen.findByText("Login failed")).toBeInTheDocument();
  });

  it("does not submit when required fields are empty", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "SIGN IN" }));

    expect(mockLogin).not.toHaveBeenCalled();
  });

  it("toggles password visibility", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    const passwordInput = screen.getByLabelText("PASSWORD");
    const toggleButton = screen.getByRole("button", { name: "" });

    expect(passwordInput).toHaveAttribute("type", "password");
    await user.click(toggleButton);
    expect(passwordInput).toHaveAttribute("type", "text");
    await user.click(toggleButton);
    expect(passwordInput).toHaveAttribute("type", "password");
  });

  it("renders cold-start notice and register link", () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    expect(
      screen.getByText(/Initial requests may take up to a minute/i),
    ).toBeInTheDocument();

    const registerLink = screen.getByRole("link", { name: /Register/i });
    expect(registerLink).toHaveAttribute("href", "/register");
  });
});

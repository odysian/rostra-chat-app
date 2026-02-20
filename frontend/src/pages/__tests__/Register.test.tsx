import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@testing-library/react";
import Register from "../Register";

const mockNavigate = vi.fn();
const mockAuthLogin = vi.fn();
const mockRegister = vi.fn();

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
  register: (...args: unknown[]) => mockRegister(...args),
}));

describe("Register", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockAuthLogin.mockReset();
    mockRegister.mockReset();
    mockAuthLogin.mockResolvedValue(undefined);
  });

  it("renders username, email, and password fields", () => {
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText("USERNAME")).toBeInTheDocument();
    expect(screen.getByLabelText("EMAIL")).toBeInTheDocument();
    expect(screen.getByLabelText("PASSWORD")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "CREATE ACCOUNT" }),
    ).toBeInTheDocument();
  });

  it("submits valid input, logs in, and navigates to chat", async () => {
    const user = userEvent.setup();
    mockRegister.mockResolvedValue({
      access_token: "new-token",
      token_type: "bearer",
    });

    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText("USERNAME"), "alice");
    await user.type(screen.getByLabelText("EMAIL"), "alice@example.com");
    await user.type(screen.getByLabelText("PASSWORD"), "password123");
    await user.click(screen.getByRole("button", { name: "CREATE ACCOUNT" }));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        username: "alice",
        email: "alice@example.com",
        password: "password123",
      });
    });
    await waitFor(() => {
      expect(mockAuthLogin).toHaveBeenCalledWith("new-token");
    });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/chat");
    });
  });

  it("shows loading state during registration", async () => {
    const user = userEvent.setup();
    let resolveRegister: (value: {
      access_token: string;
      token_type: string;
    }) => void;
    const registerPromise = new Promise<{
      access_token: string;
      token_type: string;
    }>((resolve) => {
      resolveRegister = resolve;
    });
    mockRegister.mockReturnValue(registerPromise);

    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText("USERNAME"), "alice");
    await user.type(screen.getByLabelText("EMAIL"), "alice@example.com");
    await user.type(screen.getByLabelText("PASSWORD"), "password123");
    await user.click(screen.getByRole("button", { name: "CREATE ACCOUNT" }));

    expect(
      screen.getByRole("button", { name: /REGISTERING\.\.\./i }),
    ).toBeDisabled();

    resolveRegister!({ access_token: "new-token", token_type: "bearer" });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/chat");
    });
  });

  it("shows API error for duplicate username or email", async () => {
    const user = userEvent.setup();
    mockRegister.mockRejectedValue(new Error("Username already exists"));

    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText("USERNAME"), "alice");
    await user.type(screen.getByLabelText("EMAIL"), "alice@example.com");
    await user.type(screen.getByLabelText("PASSWORD"), "password123");
    await user.click(screen.getByRole("button", { name: "CREATE ACCOUNT" }));

    expect(await screen.findByText("Username already exists")).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("uses fallback message for non-Error failures", async () => {
    const user = userEvent.setup();
    mockRegister.mockRejectedValue("network failed");

    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText("USERNAME"), "alice");
    await user.type(screen.getByLabelText("EMAIL"), "alice@example.com");
    await user.type(screen.getByLabelText("PASSWORD"), "password123");
    await user.click(screen.getByRole("button", { name: "CREATE ACCOUNT" }));

    expect(await screen.findByText("Registration failed")).toBeInTheDocument();
  });

  it("toggles password visibility", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Register />
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

  it("renders sign-in link with login href", () => {
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>,
    );

    const signInLink = screen.getByRole("link", { name: /Sign in/i });
    expect(signInLink).toHaveAttribute("href", "/login");
  });
});

import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { act, render, screen, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "../AuthContext";
import type { User } from "../../types";

const mockGetCurrentUser = vi.fn();
const mockSetUnauthorizedHandler = vi.fn();

vi.mock("../../services/api", () => ({
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
  setUnauthorizedHandler: (...args: unknown[]) =>
    mockSetUnauthorizedHandler(...args),
}));

const demoUser: User = {
  id: 1,
  username: "alice",
  email: "alice@example.com",
  created_at: "2024-01-01T00:00:00",
};

function AuthConsumer() {
  const auth = useAuth();

  return (
    <div>
      <div data-testid="isAuthenticated">{String(auth.isAuthenticated)}</div>
      <div data-testid="isAuthenticating">{String(auth.isAuthenticating)}</div>
      <div data-testid="isColdStart">{String(auth.isColdStart)}</div>
      <div data-testid="user">{auth.user?.username ?? "none"}</div>
      <div data-testid="authError">{auth.authError ?? "none"}</div>
      <button type="button" onClick={() => void auth.login("new-token")}>
        login
      </button>
      <button type="button" onClick={() => auth.logout()}>
        logout
      </button>
      <button type="button" onClick={auth.retryAuth}>
        retry
      </button>
    </div>
  );
}

function renderAuthProvider() {
  return render(
    <AuthProvider>
      <AuthConsumer />
    </AuthProvider>,
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    mockGetCurrentUser.mockReset();
    mockSetUnauthorizedHandler.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts unauthenticated when no token is stored", () => {
    renderAuthProvider();

    expect(screen.getByTestId("isAuthenticated")).toHaveTextContent("false");
    expect(screen.getByTestId("user")).toHaveTextContent("none");
    expect(mockGetCurrentUser).not.toHaveBeenCalled();
    expect(mockSetUnauthorizedHandler).toHaveBeenCalledTimes(1);
  });

  it("loads current user when a valid token exists", async () => {
    localStorage.setItem("token", "stored-token");
    mockGetCurrentUser.mockResolvedValue(demoUser);

    renderAuthProvider();

    await waitFor(() => {
      expect(mockGetCurrentUser).toHaveBeenCalledWith("stored-token");
    });
    await waitFor(() => {
      expect(screen.getByTestId("isAuthenticated")).toHaveTextContent("true");
    });
    expect(screen.getByTestId("user")).toHaveTextContent("alice");
  });

  it("clears invalid token on 401 auth errors", async () => {
    localStorage.setItem("token", "expired-token");
    mockGetCurrentUser.mockRejectedValue(new Error("401 Unauthorized"));

    renderAuthProvider();

    await waitFor(() => {
      expect(mockGetCurrentUser).toHaveBeenCalledWith("expired-token");
    });
    await waitFor(() => {
      expect(localStorage.getItem("token")).toBeNull();
    });
    expect(screen.getByTestId("isAuthenticated")).toHaveTextContent("false");
    expect(screen.getByTestId("authError")).toHaveTextContent("none");
  });

  it("keeps token and shows retryable error on network failures", async () => {
    localStorage.setItem("token", "stored-token");
    mockGetCurrentUser.mockRejectedValue(new Error("Failed to fetch"));

    renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId("authError")).toHaveTextContent(
        "Couldn't reach the server. It may still be starting up.",
      );
    });
    expect(localStorage.getItem("token")).toBe("stored-token");
    expect(screen.getByTestId("isAuthenticated")).toHaveTextContent("false");
  });

  it("login stores token and triggers current-user fetch", async () => {
    const user = userEvent.setup();
    mockGetCurrentUser.mockResolvedValue(demoUser);

    renderAuthProvider();

    await user.click(screen.getByRole("button", { name: "login" }));

    await waitFor(() => {
      expect(localStorage.getItem("token")).toBe("new-token");
    });
    await waitFor(() => {
      expect(mockGetCurrentUser).toHaveBeenCalledWith("new-token");
    });
    await waitFor(() => {
      expect(screen.getByTestId("isAuthenticated")).toHaveTextContent("true");
    });
  });

  it("logout clears auth state and local storage", async () => {
    const user = userEvent.setup();
    localStorage.setItem("token", "stored-token");
    mockGetCurrentUser.mockResolvedValue(demoUser);

    renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId("isAuthenticated")).toHaveTextContent("true");
    });

    await user.click(screen.getByRole("button", { name: "logout" }));

    expect(localStorage.getItem("token")).toBeNull();
    expect(screen.getByTestId("isAuthenticated")).toHaveTextContent("false");
    expect(screen.getByTestId("user")).toHaveTextContent("none");
  });

  it("marks cold start true after 5 seconds of pending auth", async () => {
    vi.useFakeTimers();
    localStorage.setItem("token", "slow-token");
    mockGetCurrentUser.mockReturnValue(new Promise(() => {}));

    renderAuthProvider();

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByTestId("isColdStart")).toHaveTextContent("true");
  });

  it("retryAuth triggers a second auth attempt", async () => {
    const user = userEvent.setup();
    localStorage.setItem("token", "stored-token");
    mockGetCurrentUser
      .mockRejectedValueOnce(new Error("Failed to fetch"))
      .mockResolvedValueOnce(demoUser);

    renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId("authError")).not.toHaveTextContent("none");
    });
    expect(mockGetCurrentUser).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "retry" }));

    await waitFor(() => {
      expect(mockGetCurrentUser).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(screen.getByTestId("isAuthenticated")).toHaveTextContent("true");
    });
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { delay, http, HttpResponse } from "msw";
import { server } from "../../test/mocks/server";
import {
  deleteRoom,
  getMessageContext,
  getCurrentUser,
  getRoomMessages,
  getRoomMessagesNewer,
  login,
  setUnauthorizedHandler,
} from "../api";

describe("api service", () => {
  beforeEach(() => {
    setUnauthorizedHandler(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("returns parsed JSON for a successful request", async () => {
    server.use(
      http.post("*/api/auth/login", () =>
        HttpResponse.json({
          access_token: "token-123",
          token_type: "bearer",
        }),
      ),
    );

    await expect(
      login({ username: "alice", password: "password123" }),
    ).resolves.toEqual({
      access_token: "token-123",
      token_type: "bearer",
    });
  });

  it("calls unauthorized handler on 401 and throws", async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);

    server.use(
      http.get("*/api/auth/me", () =>
        HttpResponse.json({ detail: "Unauthorized" }, { status: 401 }),
      ),
    );

    await expect(getCurrentUser("expired-token")).rejects.toThrow("Unauthorized");
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("throws detail for non-401 client errors", async () => {
    server.use(
      http.post("*/api/auth/login", () =>
        HttpResponse.json({ detail: "Invalid username or password" }, { status: 400 }),
      ),
    );

    await expect(
      login({ username: "alice", password: "wrong" }),
    ).rejects.toThrow("Invalid username or password");
  });

  it("retries 5xx responses up to max retries and then succeeds", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);

    let attempts = 0;
    server.use(
      http.post("*/api/auth/login", () => {
        attempts += 1;
        if (attempts < 5) {
          return HttpResponse.json({ detail: "server error" }, { status: 503 });
        }
        return HttpResponse.json({
          access_token: "token-123",
          token_type: "bearer",
        });
      }),
    );

    const request = login({ username: "alice", password: "password123" });
    await vi.runAllTimersAsync();

    await expect(request).resolves.toEqual({
      access_token: "token-123",
      token_type: "bearer",
    });
    expect(attempts).toBe(5);
  });

  it("retries network errors and succeeds", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);

    let attempts = 0;
    server.use(
      http.post("*/api/auth/login", () => {
        attempts += 1;
        if (attempts < 5) {
          return HttpResponse.error();
        }
        return HttpResponse.json({
          access_token: "token-123",
          token_type: "bearer",
        });
      }),
    );

    const request = login({ username: "alice", password: "password123" });
    await vi.runAllTimersAsync();

    await expect(request).resolves.toEqual({
      access_token: "token-123",
      token_type: "bearer",
    });
    expect(attempts).toBe(5);
  });

  it('throws "Request timeout" after timeout and retries are exhausted', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);

    server.use(
      http.post("*/api/auth/login", async () => {
        await delay("infinite");
        return HttpResponse.json({
          access_token: "never",
          token_type: "bearer",
        });
      }),
    );

    const request = login({ username: "alice", password: "password123" });
    const assertion = expect(request).rejects.toThrow("Request timeout");
    // 5 attempts * 10s + retry backoffs (1 + 2 + 4 + 8)
    await vi.advanceTimersByTimeAsync(70_000);
    await assertion;
  });

  it("propagates external AbortSignal cancellation without retry", async () => {
    server.use(
      http.get("*/api/rooms/:roomId/messages", async () => {
        await delay("infinite");
        return HttpResponse.json({ messages: [], next_cursor: null });
      }),
    );

    const controller = new AbortController();
    const request = getRoomMessages(1, "test-token", controller.signal);
    controller.abort();

    await expect(request).rejects.toThrow(/AbortError/i);
  });

  it("fetches jump-to-message context with default 25/25 window", async () => {
    server.use(
      http.get("*/api/rooms/:roomId/messages/:messageId/context", ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("before")).toBe("25");
        expect(url.searchParams.get("after")).toBe("25");
        return HttpResponse.json({
          messages: [],
          target_message_id: 22,
          older_cursor: "older-token",
          newer_cursor: "newer-token",
        });
      }),
    );

    await expect(
      getMessageContext(1, 22, "test-token"),
    ).resolves.toEqual({
      messages: [],
      target_message_id: 22,
      older_cursor: "older-token",
      newer_cursor: "newer-token",
    });
  });

  it("fetches newer messages from cursor", async () => {
    server.use(
      http.get("*/api/rooms/:roomId/messages/newer", ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("cursor")).toBe("abc123");
        return HttpResponse.json({
          messages: [],
          next_cursor: null,
        });
      }),
    );

    await expect(
      getRoomMessagesNewer(1, "test-token", "abc123"),
    ).resolves.toEqual({
      messages: [],
      next_cursor: null,
    });
  });

  it("handles 204 no-content responses without throwing", async () => {
    server.use(
      http.delete("*/api/rooms/:roomId", () => new HttpResponse(null, { status: 204 })),
    );

    await expect(deleteRoom(1, "test-token")).resolves.toEqual({});
  });
});

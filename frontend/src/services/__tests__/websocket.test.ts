import { describe, expect, it } from "vitest";
import { resolveWebSocketBaseUrl } from "../websocket";

describe("websocket service URL resolution", () => {
  it("uses explicit VITE_WS_URL when provided", () => {
    expect(
      resolveWebSocketBaseUrl("https://api.example.com", "wss://ws.example.com/"),
    ).toBe("wss://ws.example.com");
  });

  it("converts explicit HTTP(S) websocket base URL to WS(S)", () => {
    expect(
      resolveWebSocketBaseUrl("https://api.example.com", "https://ws.example.com"),
    ).toBe("wss://ws.example.com");
  });

  it("derives websocket base from API URL and strips trailing /api", () => {
    expect(resolveWebSocketBaseUrl("https://api.example.com/api/")).toBe(
      "wss://api.example.com",
    );
  });
});

import { describe, expect, it } from "vitest";
import { formatRoomNameForDisplay } from "../roomNames";

describe("formatRoomNameForDisplay", () => {
  it("replaces whitespace with hyphens", () => {
    expect(formatRoomNameForDisplay("General Discussion")).toBe(
      "General-Discussion",
    );
    expect(formatRoomNameForDisplay("hello\tworld")).toBe("hello-world");
    expect(formatRoomNameForDisplay("no spaces")).toBe("no-spaces");
  });

  it("keeps pre-hyphenated names unchanged", () => {
    expect(formatRoomNameForDisplay("already-hyphenated")).toBe(
      "already-hyphenated",
    );
  });

  it("returns empty string for empty input", () => {
    expect(formatRoomNameForDisplay("")).toBe("");
  });
});

import { describe, expect, it } from "vitest";
import { getUserColorPalette } from "../userColors";

function extractHue(hslColor: string): number {
  const match = hslColor.match(/hsla?\((\d+),/);
  return match ? Number(match[1]) : -1;
}

describe("getUserColorPalette", () => {
  it("returns deterministic palette for the same username", () => {
    const first = getUserColorPalette("alice");
    const second = getUserColorPalette("alice");

    expect(first).toEqual(second);
  });

  it("is case and whitespace insensitive", () => {
    expect(getUserColorPalette(" Alice ")).toEqual(getUserColorPalette("alice"));
  });

  it("returns different palettes for different usernames", () => {
    expect(getUserColorPalette("alice")).not.toEqual(getUserColorPalette("bob"));
  });

  it("keeps hue inside the configured range", () => {
    const palette = getUserColorPalette("charlie");
    const hue = extractHue(palette.textColor);

    expect(hue).toBeGreaterThanOrEqual(205);
    expect(hue).toBeLessThanOrEqual(318);
  });

  it("returns all expected color keys", () => {
    const palette = getUserColorPalette("delta");

    expect(palette).toHaveProperty("textColor");
    expect(palette).toHaveProperty("borderColor");
    expect(palette).toHaveProperty("backgroundColor");
    expect(palette).toHaveProperty("glowColor");
  });
});

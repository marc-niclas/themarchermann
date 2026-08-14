import { describe, expect, it } from "vitest";
import { shouldShowAppBar } from "./app-bar";

describe("app bar visibility", () => {
  it("stays hidden until the splash has passed the viewport top", () => {
    expect(shouldShowAppBar(900)).toBe(false);
    expect(shouldShowAppBar(97)).toBe(false);
  });

  it("shows shortly before the boundary so anchored sections keep it visible", () => {
    expect(shouldShowAppBar(96)).toBe(true);
    expect(shouldShowAppBar(0)).toBe(true);
    expect(shouldShowAppBar(-120)).toBe(true);
  });
});

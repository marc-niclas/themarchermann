import { describe, expect, it } from "vitest";

import { site } from "./site";

describe("site metadata", () => {
  it("stays internally consistent and production-safe", () => {
    const url = new URL(site.url);
    const normalizedStatus = site.status.replace(/\.$/, "").toLowerCase();

    expect(url.protocol).toBe("https:");
    expect(url.pathname).toBe("/");
    expect(site.title).toContain(site.name);
    expect(site.description.toLowerCase()).toContain(normalizedStatus);
  });
});

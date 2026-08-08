import { describe, expect, it } from "vitest";

import { site } from "./site";

describe("site metadata", () => {
  it("publishes the temporary construction state for Marc Hermann", () => {
    expect(site.name).toBe("Marc Hermann");
    expect(site.title).toBe("Marc Hermann — Under Construction");
    expect(site.status).toBe("Under construction.");
    expect(site.url).toBe("https://themarchermann.com");
  });
});

// @ts-check
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://themarchermann.com",
  build: {
    /**
     * The splash is the whole page, so its CSS must not cost a render-blocking
     * round trip. The default "auto" only inlines under 4kB, and the page sits
     * right on that line — the grain data URI alone tipped it over and silently
     * turned the stylesheet into a separate request. Pin it.
     */
    inlineStylesheets: "always",
  },
  vite: {
    plugins: [vanillaExtractPlugin()],
  },
});

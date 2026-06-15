import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  cacheDir: ".vitest-cache",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, ".")
    }
  },
  test: {
    cache: false,
    globals: true,
    include: ["**/*.test.ts", "**/*.test.tsx"],
    setupFiles: ["./testing/setup.ts"]
  }
});

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./testing/e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3003",
    trace: "on-first-retry"
  },
  webServer: {
    command: "E2E_USE_FALLBACK_FIXTURES=1 E2E_NOW=2026-06-14T19:45:00Z npm run dev",
    url: "http://127.0.0.1:3003",
    reuseExistingServer: false,
    timeout: 120_000
  },
  projects: [
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] }
    }
  ]
});

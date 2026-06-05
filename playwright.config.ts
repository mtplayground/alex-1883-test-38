import { defineConfig, devices } from "@playwright/test";

const port = 4173;

export default defineConfig({
  expect: {
    timeout: 5_000
  },
  fullyParallel: true,
  reporter: "list",
  testDir: "./tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "on-first-retry"
  },
  webServer: {
    command: `npm exec --workspace web vite -- --host 127.0.0.1 --port ${port}`,
    env: {
      VITE_OBJECT_STORAGE_PUBLIC_BASE_URL: `http://127.0.0.1:${port}/__objects`
    },
    reuseExistingServer: false,
    timeout: 30_000,
    url: `http://127.0.0.1:${port}`
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"]
      }
    }
  ]
});

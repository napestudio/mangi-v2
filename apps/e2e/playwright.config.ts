import path from "node:path";
import { defineConfig } from "@playwright/test";

const REPO_ROOT = path.resolve(__dirname, "../..");

const API_URL = process.env["E2E_API_URL"] ?? "http://localhost:3000";
const APP_URL = process.env["E2E_APP_URL"] ?? "http://localhost:5173";

export default defineConfig({
  testDir: ".",
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  timeout: 30_000,
  use: {
    baseURL: APP_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "pnpm --filter api dev",
      url: `${API_URL}/health`,
      reuseExistingServer: true,
      timeout: 60_000,
      cwd: REPO_ROOT,
    },
    {
      command: "pnpm --filter app dev",
      url: APP_URL,
      reuseExistingServer: true,
      timeout: 60_000,
      cwd: REPO_ROOT,
    },
  ],
  projects: [
    {
      name: "chromium",
      testDir: "./tests",
      use: { browserName: "chromium" },
    },
    {
      name: "electron",
      testDir: "./electron",
    },
  ],
});

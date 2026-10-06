import path from "node:path";
import { test as base, type Page } from "@playwright/test";
import { _electron as electron, type ElectronApplication } from "playwright";

const DESKTOP_ROOT = path.resolve(__dirname, "../../desktop");
const MAIN_ENTRY = path.join(DESKTOP_ROOT, "dist/main/index.js");
// Resolve the Electron binary from apps/desktop's own node_modules — it's the exact
// version that better-sqlite3 was rebuilt against (electron-rebuild), so launching
// any other copy risks a native-module ABI mismatch.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ELECTRON_BINARY = require(path.join(DESKTOP_ROOT, "node_modules/electron")) as unknown as string;

export const test = base.extend<{ electronApp: ElectronApplication; page: Page }>({
  electronApp: async ({}, use) => {
    const app = await electron.launch({
      executablePath: ELECTRON_BINARY,
      args: [MAIN_ENTRY],
      env: { ...process.env, NODE_ENV: "development" },
    });
    await use(app);
    await app.close();
  },

  page: async ({ electronApp }, use) => {
    const window = await electronApp.firstWindow();
    await use(window);
  },
});

export { expect } from "@playwright/test";

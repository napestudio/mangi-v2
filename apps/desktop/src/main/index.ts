import path from "node:path";
import { app, BrowserWindow, globalShortcut, Menu } from "electron";
import { registerIpcHandlers } from "./ipc-handlers";

const isDev = process.env["NODE_ENV"] === "development";

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    void win.loadURL("http://localhost:5173");
  } else {
    void win.loadFile(path.join(__dirname, "../../../app/dist/index.html"));
  }
}

void app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  registerIpcHandlers();
  createWindow();

  if (isDev) {
    globalShortcut.register("F12", () => {
      BrowserWindow.getFocusedWindow()?.webContents.toggleDevTools();
    });
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

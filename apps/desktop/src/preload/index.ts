import { contextBridge, ipcRenderer, shell } from "electron";

contextBridge.exposeInMainWorld("electron", {
  db: {
    query: (sqlText: string, params: unknown[] = []) => ipcRenderer.invoke("db:query", sqlText, params),
  },
  store: {
    get: (key: string) => ipcRenderer.invoke("store:get", key),
    set: (key: string, value: unknown) => ipcRenderer.invoke("store:set", key, value),
  },
  shell: {
    openExternal: (url: string) => shell.openExternal(url),
  },
  platform: process.platform,
});

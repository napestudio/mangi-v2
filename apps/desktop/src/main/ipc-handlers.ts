import { ipcMain } from "electron";
import { sqlite } from "./db";
import { handlePrintJob, type IncomingPrintJob } from "./printing";
import { store } from "./store";

export function registerIpcHandlers(): void {
  ipcMain.handle("db:query", (_event, sqlText: string, params: unknown[] = []) => {
    const statement = sqlite.prepare(sqlText);
    if (statement.reader) {
      return statement.all(...params);
    }
    return statement.run(...params);
  });

  ipcMain.handle("store:get", (_event, key: string) => store.get(key));

  ipcMain.handle("store:set", (_event, key: string, value: unknown) => {
    if (value === undefined) {
      store.delete(key);
      return;
    }
    store.set(key, value);
  });

  ipcMain.handle("print:job", (_event, printJob: IncomingPrintJob, accessToken: string | null) =>
    handlePrintJob(printJob, accessToken),
  );
}

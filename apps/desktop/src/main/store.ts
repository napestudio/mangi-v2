import { randomUUID } from "node:crypto";
import Store from "electron-store";

export const store = new Store<Record<string, unknown>>({ name: "mangiar-config" });

if (!store.has("deviceId")) {
  store.set("deviceId", randomUUID());
}

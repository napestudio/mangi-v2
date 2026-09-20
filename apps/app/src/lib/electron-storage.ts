import type { StateStorage } from "zustand/middleware";

export const electronStorage: StateStorage = {
  getItem: async (name) => {
    const value = await window.electron?.store.get<string>(name);
    return value ?? null;
  },
  setItem: async (name, value) => {
    await window.electron?.store.set(name, value);
  },
  removeItem: async (name) => {
    await window.electron?.store.set(name, undefined);
  },
};

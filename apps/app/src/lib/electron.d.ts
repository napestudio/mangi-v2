export {};

declare global {
  interface Window {
    electron?: {
      db: {
        query: <T = unknown>(sql: string, params?: unknown[]) => Promise<T>;
      };
      store: {
        get: <T = unknown>(key: string) => Promise<T | undefined>;
        set: (key: string, value: unknown) => Promise<void>;
      };
      shell: {
        openExternal: (url: string) => Promise<void>;
      };
      print: {
        job: (printJob: unknown, accessToken: string | null) => Promise<void>;
      };
      platform: "win32" | "darwin" | "linux";
    };
  }
}

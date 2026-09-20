export interface AppConfig {
  port: number;
  corsOrigin: string;
  redisUrl: string;
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessExpires: string;
    refreshExpires: string;
  };
}

export default (): { app: AppConfig } => ({
  app: {
    port: parseInt(process.env["PORT"] ?? "3000", 10),
    corsOrigin: process.env["CORS_ORIGIN"] ?? "http://localhost:5173",
    redisUrl: process.env["REDIS_URL"] ?? "redis://localhost:6379",
    jwt: {
      accessSecret: process.env["JWT_ACCESS_SECRET"] ?? "",
      refreshSecret: process.env["JWT_REFRESH_SECRET"] ?? "",
      accessExpires: process.env["JWT_ACCESS_EXPIRES"] ?? "15m",
      refreshExpires: process.env["JWT_REFRESH_EXPIRES"] ?? "30d",
    },
  },
});

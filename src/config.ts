process.loadEnvFile();
import { MigrationConfig } from "drizzle-orm/migrator";
import { migrationConfig } from "./drizzle.config.js";

type APIConfig = {
  fileserverHits: number;
  port: number;
};

type DBConfig = {
  dbURL: string;
  migrationConfig: MigrationConfig;
};

export const config: APIConfig & DBConfig = {
  fileserverHits: 0,
  dbURL: envOrThrow("DB_URL"),
  migrationConfig: migrationConfig,
  port: Number(envOrThrow("PORT")),
};

function envOrThrow(key: string) {
  const value = process.env[key];
  if (!value) throw new Error(`Doesn't ${key} exist`);
  return value;
}

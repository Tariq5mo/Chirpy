import { defineConfig } from "drizzle-kit";
import { MigrationConfig } from "drizzle-orm/migrator";
import { config } from "./config.js";

export default defineConfig({
  schema: "./src/db/",
  out: "./src/db/migration",
  dialect: "postgresql",
  dbCredentials: {
    url: config.dbURL,
  },
});

export const migrationConfig: MigrationConfig = {
  migrationsFolder: "./src/db/migration",
};

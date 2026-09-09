import { defineConfig } from "drizzle-kit";
import { MigrationConfig } from "drizzle-orm/migrator";
import { config } from "./config.js";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/",
  out: "./src/db/migration",
  dbCredentials: {
    url: config.db.url,
  },
});

export const migrationConfig: MigrationConfig = {
  migrationsFolder: "./src/db/migration",
};

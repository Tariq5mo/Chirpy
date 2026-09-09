import { defineConfig } from "drizzle-kit";
import { MigrationConfig } from "drizzle-orm/migrator";

export default defineConfig({
  schema: "./src/db/",
  out: "./src/db/migration",
  dialect: "postgresql",
  dbCredentials: {
    url: "postgres://postgres:postgres@localhost:5432/chirpy?sslmode=disable",
  },
});

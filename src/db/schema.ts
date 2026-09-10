import { pgTable, timestamp, varchar, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  email: varchar("email", { length: 256 }).unique().notNull(),
  hashedPassword: varchar("hashed_password").notNull(),
});

export const chirps = pgTable("chirps", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  body: varchar("body").notNull(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
});

export type NewUser = typeof users.$inferInsert;
export type Newchirp = typeof chirps.$inferInsert;
import { z } from "zod";

export const InsertNewChirpSchema = createInsertSchema(chirps).omit({ userId: true }).extend({
    token: z.string().nonempty().optional(),
});
export const InsertNewUserSchema = createInsertSchema(users)
  .omit({ hashedPassword: true })
  .extend({
    password: z.string().nonempty(),
    expiresInSeconds: z.string().optional()
  });
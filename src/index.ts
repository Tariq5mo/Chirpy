import express, { type Express, type Request, type Response } from "express";
import { config } from "./config.js";
import { z } from "zod";
import {
  errorHandler,
  middlewareLogResponses,
  middlewareMetricsInc,
} from "./api/middleware.js";
import { badRequestError } from "./api/error.js";
import postgres from "postgres";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import { handlerMetrics } from "./api/metrics.js";
import { db } from "./db/index.js";
import {
  InsertNewUserSchema,
  NewUser,
  users,
} from "./db/schema.js";
import { createChirp, getAllChirps, getOneChirp } from "./db/queries/chirps.js";
import { checkPasswordHash, getBearerToken, hashPassword, makeJWT, validateJWT } from "./api/auth.js";
import { eq } from "drizzle-orm";

const migrationClient = postgres(config.db.url, { max: 1 });
await migrate(drizzle(migrationClient), config.db.migrationConfig);

const app: Express = express();

app.use(middlewareLogResponses, express.json());

app.use("/app", middlewareMetricsInc, express.static("./src/app"));

app.post("/api/users", async (req: Request, res: Response) => {
  try {
    const parsedBody = InsertNewUserSchema.parse(req.body);
    const [newUser] = await db
      .insert(users)
      .values({
        email: parsedBody.email,
        hashedPassword: await hashPassword(parsedBody.password),
      })
      .returning();
    type NewUserClean = Omit<NewUser, "hashedPassword">;
    const newUserClean: NewUserClean = {
      id: newUser.id,
      email: newUser.email,
      createdAt: newUser.createdAt,
      updatedAt: newUser.updatedAt,
    };
    return res.status(201).send(newUserClean);
  } catch (error) {
    throw new badRequestError("Invalid input");
  }
});

app.post("/api/login", async (req: Request, res: Response) => {
  try {
    const parsedBody = InsertNewUserSchema.parse(req.body);
    const [result] = await db
      .select()
      .from(users)
      .where(eq(users.email, parsedBody.email))
      .limit(1);
    if (!result) {
      return res.status(401).send();
    }
    const valid = await checkPasswordHash(
      parsedBody.password,
      result.hashedPassword,
    );
    if (valid) {
      const token = makeJWT(result.id, parsedBody.expiresInSeconds && Number(parsedBody.expiresInSeconds) < 3600 ? Number(parsedBody.expiresInSeconds) : 3600, config.api.jwtSecret)

      const newUserClean = {
        id: result.id,
        email: result.email,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
        token: token
      };
      return res.status(200).send(newUserClean);
    } else return res.status(401).send();
  } catch (error) {
    throw new badRequestError("Invalid input");
  }
});

app.post("/api/chirps", createChirp);
app.get("/api/chirps", getAllChirps);
app.get("/api/chirps/:chirp", getOneChirp);

app.get("/api/healthz", (req: Request, res: Response) => {
  res.set({
    "Content-Type": "text/plain",
    charset: "utf-8",
  });
  return res.send("OK");
});

app.get("/admin/metrics", handlerMetrics);

app.post("/admin/reset", async (req: Request, res: Response) => {
  if (config.api.platform !== "dev") return res.status(403).send();
  await db.delete(users);
  res.set({
    "Content-Type": "text/plain",
    charset: "utf-8",
  });
  return res.send();
});

app.use(errorHandler);

app.listen(config.api.port);

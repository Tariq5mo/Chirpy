import express, { type Express, type Request, type Response } from "express";
import { config } from "./config.js";
import { z } from "zod";
import {
  errorHandler,
  middlewareLogResponses,
  middlewareMetricsInc,
} from "./api/middleware.js";
import {
  badRequestError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "./api/error.js";
import postgres from "postgres";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import { handlerMetrics } from "./api/metrics.js";
import { db } from "./db/index.js";
import {
  chirps,
  InsertNewUserSchema,
  NewUser,
  refreshTokens,
  users,
} from "./db/schema.js";
import { createChirp, getAllChirps, getOneChirp } from "./db/queries/chirps.js";
import {
  checkPasswordHash,
  getBearerToken,
  hashPassword,
  makeJWT,
  makeRefreshToken,
  validateJWT,
} from "./api/auth.js";
import { eq } from "drizzle-orm";
import { upgradeUser } from "./db/queries/users.js";

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
      .returning({
        id: users.id,
        email: users.email,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        isChirpyRed: users.isChirpyRed,
      });
    return res.status(201).send(newUser);
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
      throw new badRequestError("Invalid input");
    }
    const valid = await checkPasswordHash(
      parsedBody.password,
      result.hashedPassword,
    );
    if (valid) {
      const token = makeJWT(result.id, 3600, config.api.jwtSecret);
      let [userRefreshToken] = await db
        .select()
        .from(refreshTokens)
        .where(eq(refreshTokens.userId, result.id))
        .limit(1);
      if (!userRefreshToken) {
        const [newRefreshToken] = await db
          .insert(refreshTokens)
          .values({
            token: makeRefreshToken(),
            userId: result.id,
          })
          .returning();
        userRefreshToken = newRefreshToken;
      }

      const userInfo = {
        id: result.id,
        email: result.email,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
        token: token,
        refreshToken: userRefreshToken.token,
        isChirpyRed: result.isChirpyRed
      };
      return res.status(200).send(userInfo);
    } else return res.status(401).send();
  } catch (error) {
    throw new badRequestError("Invalid input");
  }
});

app.post("/api/refresh", async (req: Request, res: Response) => {
  const refreshToken = getBearerToken(req);
  let [userRefreshToken] = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.token, refreshToken))
    .limit(1);
  if (
    !userRefreshToken ||
    userRefreshToken.revoked_at ||
    new Date(userRefreshToken.expiresAt) < new Date()
  )
    throw new UnauthorizedError("Invalid payload");
  const token = makeJWT(userRefreshToken.userId, 3600, config.api.jwtSecret);
  return res.status(200).send({ token: token });
});

app.post("/api/revoke", async (req: Request, res: Response) => {
  const refreshToken = getBearerToken(req);
  let [userRefreshToken] = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.token, refreshToken))
    .limit(1);
  if (
    !userRefreshToken ||
    userRefreshToken.revoked_at ||
    new Date(userRefreshToken.expiresAt) < new Date()
  )
    throw new UnauthorizedError("Unauthorized");
  await db
    .update(refreshTokens)
    .set({ revoked_at: new Date() })
    .where(eq(refreshTokens.token, refreshToken));
  return res.status(204).send();
});

app.put("/api/users", async (req: Request, res: Response) => {
  const accessToken = getBearerToken(req);
  if (!req.body.email || !req.body.password)
    throw new badRequestError("email and password must be exits");
  const userId = validateJWT(accessToken, config.api.jwtSecret);
  if (!userId) throw new UnauthorizedError("Not valid");
  const hashedPass = await hashPassword(req.body.password);
  const [updatedUser] = await db
    .update(users)
    .set({ hashedPassword: hashedPass, email: req.body.email })
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      email: users.email,
      isChirpyRed: users.isChirpyRed,
    });
  return res.status(200).send(updatedUser);
});

app.delete("/api/chirps/:chirpId", async (req: Request, res: Response) => {
  const accessToken = getBearerToken(req);

  const userId = validateJWT(accessToken, config.api.jwtSecret);
  if (!userId) throw new ForbiddenError("Forbidden");
  const chirpId = req.params.chirpId;
  const [chirp] = await db
    .select()
    .from(chirps)
    .where(eq(chirps.id, Array.isArray(chirpId) ? chirpId[0] : chirpId))
    .limit(1);
  if (!chirp) throw new NotFoundError("Not Found");

  if (chirp.userId !== userId) throw new ForbiddenError("Forbidden");

  await db
    .delete(chirps)
    .where(eq(chirps.id, Array.isArray(chirpId) ? chirpId[0] : chirpId));
  return res.status(204).send();
});

app.post("/api/polka/webhooks", async (req: Request, res: Response) => {
  type webhookData = {
    event: string;
    data: {
      userId: string;
    };
  };
  const parsedBody: webhookData = req.body;
  if (parsedBody.event !== "user.upgraded") return res.status(204).send();
  const user = await upgradeUser(parsedBody.data.userId);
  if (!user) throw new NotFoundError("Not Found");
  return res.status(204).send();
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

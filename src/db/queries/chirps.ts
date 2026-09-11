import { Request, Response } from "express";
import { UnauthorizedError, badRequestError } from "../../api/error.js";
import { db } from "../index.js";
import { chirps, InsertNewChirpSchema, Newchirp } from "../schema.js";
import { asc, desc, eq } from "drizzle-orm";
import { getBearerToken, validateJWT } from "../../api/auth.js";
import { config } from "../../config.js";

export async function createChirp(req: Request, res: Response) {
  const parsedBody: Newchirp = req.body;
  try {
    const userId = validateJWT(getBearerToken(req), config.api.jwtSecret);
    const cleanedBody = InsertNewChirpSchema.parse(parsedBody);
    const [newChirp] = await db
      .insert(chirps)
      .values({
        body: cleanedBody.body,
        userId: userId,
      })
      .returning();
    return res.status(201).send(newChirp);
  } catch (error) {
    throw new UnauthorizedError(`Invalid input ${error}`);
  }
}

export async function getAllChirps(req: Request, res: Response) {
  try {
    let authorId = "";
    let sort = "";
    let authorIdQuery = req.query.authorId;
    let sortQuery = req.query.sort;
    if (typeof authorIdQuery === "string") {
      authorId = authorIdQuery;
    }
    if (typeof sortQuery === "string") {
      sort = sortQuery;
    }
    let allChirps;
    const sortFn = sort === "asc" ? asc : desc
    if (authorId)
      allChirps = await db
        .select()
        .from(chirps)
        .where(eq(chirps.userId, authorId))
        .orderBy(chirps.createdAt);
    else allChirps = await db.select().from(chirps).orderBy(sortFn(chirps.createdAt));

    return res.status(200).send(allChirps);
  } catch (error) {
    throw new Error("Failed to retrieves all chirps");
  }
}

export async function getOneChirp(req: Request, res: Response) {
  try {
    const chirpId = req.params.chirp;
    const result = await db
      .select()
      .from(chirps)
      .where(eq(chirps.id, Array.isArray(chirpId) ? chirpId[0] : chirpId))
      .limit(1);
    if (result.length === 0) {
      return res.status(404).json({ error: "Chirp not found" });
    }
    return res.status(200).send(result[0]);
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
}

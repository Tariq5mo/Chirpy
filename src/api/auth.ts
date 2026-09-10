import { hash, verify } from "argon2";
import { Request } from "express";
import jwt from "jsonwebtoken";
import type { JwtPayload } from "jsonwebtoken";
import { randomBytes } from "node:crypto";
import { badRequestError, UnauthorizedError } from "./error.js";

type payload = Pick<JwtPayload, "iss" | "sub" | "iat" | "exp">;

export function hashPassword(password: string): Promise<string> {
  return hash(password);
}

export function checkPasswordHash(
  password: string,
  hash: string,
): Promise<boolean> {
  return verify(hash, password);
}

export function makeJWT(
  userID: string,
  expiresIn: number,
  secret: string,
): string {
  const iat = Math.floor(Date.now() / 1000);
  const pay: payload = {
    iss: "chirpy",
    sub: userID,
    iat: iat,
    exp: iat + expiresIn,
  };
  return jwt.sign(pay, secret);
}

export function validateJWT(tokenString: string, secret: string): string {
  try {
    const decoded = jwt.verify(tokenString, secret);
    if (typeof decoded === "string" || !decoded.sub) {
      throw new UnauthorizedError("Invalid payload");
    }
    return decoded.sub;
  } catch (error) {
    throw new UnauthorizedError("Invalid payload");
  }
}

export function getBearerToken(req: {
  get(name: string): string | undefined;
}): string {
  const authHead = req.get("Authorization");
  if (!authHead) throw new UnauthorizedError("Unauthorized Request");
  return authHead
    .replace(/^Bearer\s+/i, "")
    .trim();
}

export function getAPIKey(req: Request) {
  const authHead = req.get("Authorization");
  if (!authHead) throw new UnauthorizedError("Unauthorized Request");
  return authHead
    .replace(/^ApiKey\s+/i, "")
    .trim();
}

export function makeRefreshToken(): string {
  return randomBytes(32).toString("hex");
}

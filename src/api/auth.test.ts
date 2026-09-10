import { describe, it, expect, beforeAll } from "vitest";
import { makeJWT, validateJWT, hashPassword, checkPasswordHash, getBearerToken } from "./auth.js";

describe("Password Hashing", () => {
  const password1 = "correctPassword123!";
  const password2 = "anotherPassword456!";
  let hash1: string;
  let hash2: string;

  beforeAll(async () => {
    hash1 = await hashPassword(password1);
    hash2 = await hashPassword(password2);
  });

  it("should return true for the correct password", async () => {
    const result = await checkPasswordHash(password1, hash1);
    expect(result).toBe(true);
  });
});

describe("JWT Functions", () => {
  const secret = "my-secret-key";
  const userID = "user-12345";

  it("should create and validate a valid JWT", () => {
    const token = makeJWT(userID, 3600, secret);
    const result = validateJWT(token, secret);
    expect(result).toBe(userID);
  });

  it("should reject an expired JWT", () => {
    const expiredToken = makeJWT(userID, -10, secret);
    expect(() => validateJWT(expiredToken, secret)).toThrow();
  });

  it("should reject a JWT signed with the wrong secret", () => {
    const token = makeJWT(userID, 3600, secret);
    expect(() => validateJWT(token, "wrong-secret")).toThrow();
  });
});

describe("getBearerToken", () => {
  it("should extract the bearer token from Authorization header", () => {
    const req = {
      get: (header: string) => (header.toLowerCase() === "authorization" ? "Bearer token123" : undefined),
    };
    expect(getBearerToken(req)).toBe("token123");
  });

  it("should handle case-insensitive 'bearer' prefix", () => {
    const req = {
      get: (header: string) => (header.toLowerCase() === "authorization" ? "bearer token123" : undefined),
    };
    expect(getBearerToken(req)).toBe("token123");
  });

  it("should trim extra whitespace around the token", () => {
    const req = {
      get: (header: string) => (header.toLowerCase() === "authorization" ? "Bearer   token123  " : undefined),
    };
    expect(getBearerToken(req)).toBe("token123");
  });

  it("should throw an error when Authorization header is missing", () => {
    const req = {
      get: (_header: string) => undefined,
    };
    expect(() => getBearerToken(req)).toThrow("Invalid Request");
  });
});
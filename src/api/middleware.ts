import type { NextFunction, Request, Response } from "express";
import { config } from "../config.js";
import {
  badRequestError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "./error.js";

export function middlewareLogResponses(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  res.on("finish", () => {
    if (res.statusCode !== 200) {
      console.log(
        `[NON-OK] ${req.method} ${req.url} - Status: ${res.statusCode}`,
      );
    }
  });
  return next();
}

export function middlewareMetricsInc(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  ++config.api.fileServerHits;
  return next();
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (err instanceof badRequestError)
    return res.status(400).send({ error: err.message });
  if (err instanceof UnauthorizedError)
    return res.status(401).send({ error: err.message });
  if (err instanceof ForbiddenError)
    return res.status(403).send({ error: err.message });
  if (err instanceof NotFoundError)
    return res.status(404).send({ error: err.message });
}

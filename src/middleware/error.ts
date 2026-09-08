import { type Request, type Response, type NextFunction } from "express";

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  console.error(err);
  return res.status(500).json({
    error: "Something went wrong on our end",
  });
}

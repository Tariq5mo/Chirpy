import {type Request, type Response, type NextFunction} from "express";
import { config } from "../config.js";

export function middlewareMetricsInc(req: Request, res: Response, next: NextFunction) {
	++config.fileserverHits
	return next()
}
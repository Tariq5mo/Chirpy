import express, { type Express, type Request, type Response } from "express";
import { middlewareLogResponses } from "./middleware/middlewareLogResponses.js";
import { middlewareMetricsInc } from "./middleware/middlewareMetricsInc.js";
import { config } from "./config.js";
import { z } from "zod";
import { errorHandler } from "./middleware/error.js";

const app = express();
const port = 8080;
// 1. Define your array of banned words
const bannedWords = ["kerfuffle", "sharbert", "fornax"];

// 2. Create a dynamic Regex pattern: /apple|banana|cherry/gi
const bannedWordsRegex = new RegExp(bannedWords.join("|"), "gi");

const bodyResSchema = z.object({
  body: z
    .string()
    .max(140, { message: "Chirp is too long" })
    .transform((val) => {
      // Replace all matching words with asterisks
      return val.replace(bannedWordsRegex, "****");
    }),
});

type bodyResType = z.infer<typeof bodyResSchema>;

app.use(middlewareLogResponses, express.json());

app.use("/app", middlewareMetricsInc, express.static("./src/app"));

app.post("/api/validate_chirp", (req: Request, res: Response) => {
    const parsedBody: bodyResType = req.body;
    const cleanedBody = bodyResSchema.parse(parsedBody);
    return res.send({cleanedBody: cleanedBody.body});
});

app.get("/api/healthz", (req: Request, res: Response) => {
  res.set({
    "Content-Type": "text/plain",
    charset: "utf-8",
  });
  return res.send("OK");
});

app.get("/admin/metrics", (req: Request, res: Response): Response => {
  res.set({
    "Content-Type": "text/html",
    charset: "utf-8",
  });
  return res.send(`<html>
  <body>
    <h1>Welcome, Chirpy Admin</h1>
    <p>Chirpy has been visited ${config.fileserverHits} times!</p>
  </body>
</html>`);
});

app.post("/admin/reset", (req: Request, res: Response): Response => {
  config.fileserverHits = 0;
  res.set({
    "Content-Type": "text/plain",
    charset: "utf-8",
  });
  return res.send();
});

app.use(errorHandler);

app.listen(port);

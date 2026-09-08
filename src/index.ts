import express, { type Express, type Request, type Response } from "express";
import { middlewareLogResponses } from "./middleware/middlewareLogResponses.js";
import { middlewareMetricsInc } from "./middleware/middlewareMetricsInc.js";
import { config } from "./config.js";
import { z } from "zod";

const app = express();
const port = 8080;

const bodyResSchema = z.object({
  body: z.string().max(140, { message: "Chirp is too long" }),
});

type bodyResType = z.infer<typeof bodyResSchema>;

app.use(middlewareLogResponses, express.json());

app.use("/app", middlewareMetricsInc, express.static("./src/app"));

app.post("/api/validate_chirp", (req: Request, res: Response) => {
  try {
    const parsedBody: bodyResType = req.body;
    bodyResSchema.parse(parsedBody);
    return res.send({
      valid: true,
    });
  } catch (error) {
    res.status(400);
    if (error instanceof z.ZodError)
      return res.send({ error: error.issues[0].message });
    if (error instanceof Error) return res.send({ error: error.message });
  }
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

app.listen(port);

import express from "express";
import { experimentsRouter } from "./routes/experiments.js";
import { trustGameRouter } from "./routes/trustGame.js";

const app = express();

app.use(express.json());
app.use("/api/experiments", experimentsRouter);
app.use("/api/trust-game", trustGameRouter);

export default app;

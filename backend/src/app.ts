import express from "express";
import { experimentsRouter } from "./routes/experiments.js";

const app = express();

app.use(express.json());
app.use("/api/experiments", experimentsRouter);

export default app;

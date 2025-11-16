import { Router } from "express";
import { sessionManager, SessionManagerError } from "../session/trustGameSession.js";

export const trustGameRouter = Router();

trustGameRouter.post("/:gameId/s1/send", (req, res) => {
  const { gameId } = req.params;
  const body = req.body ?? {};
  const subjectId = typeof body.subjectId === "string" ? body.subjectId.trim() : "";
  const amount = body.amount;

  if (!subjectId) {
    res.status(400).json({ error: "subjectId is required" });
    return;
  }

  if (typeof amount !== "number" || Number.isNaN(amount)) {
    res.status(400).json({ error: "amount must be a number" });
    return;
  }

  try {
    const updatedGame = sessionManager.applyS1SendDecision({
      gameId,
      subjectId,
      amount,
    });

    res.status(200).json(updatedGame);
  } catch (error) {
    if (error instanceof SessionManagerError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }

    console.error("Error applying S1 send decision", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

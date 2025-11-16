import { Router } from "express";
import { sessionManager, TreatmentTiming } from "../session/trustGameSession.js";

export const experimentsRouter = Router();

experimentsRouter.post("/:experimentId/subjects/consent", (req, res) => {
  const { experimentId } = req.params;
  const body = req.body ?? {};
  const wallet = typeof body.wallet === "string" ? body.wallet.trim() : "";
  const providedSubjectId =
    typeof body.subjectId === "string" && body.subjectId.trim().length > 0 ? body.subjectId.trim() : "";

  if (!wallet) {
    res.status(400).json({ error: "wallet is required" });
    return;
  }

  const resolvedSubjectId = providedSubjectId || wallet;

  const participation = sessionManager.upsertSubjectParticipation({
    experimentId,
    subjectId: resolvedSubjectId,
    wallet,
    treatmentTiming: TreatmentTiming.Synchronous,
  });

  res.status(200).json({
    subjectId: participation.subjectId,
    experimentId: participation.experimentId,
    wallet: participation.wallet,
    outerState: participation.outerState,
    role: participation.role,
    gameId: participation.gameId,
  });
});

experimentsRouter.get("/:experimentId/subjects/:subjectId/state", (req, res) => {
  const { experimentId, subjectId } = req.params;
  const participation = sessionManager.getSubjectParticipation(experimentId, subjectId);

  if (!participation) {
    res.status(404).json({ error: "Subject participation not found" });
    return;
  }

  res.status(200).json({
    subjectId: participation.subjectId,
    experimentId: participation.experimentId,
    wallet: participation.wallet,
    outerState: participation.outerState,
    role: participation.role,
    gameId: participation.gameId,
    innerStateS1: participation.innerStateS1,
    innerStateS2: participation.innerStateS2,
    payoff: participation.payoff,
  });
});

import { sessionManager, TreatmentTiming } from "../session/trustGameSession.js";

function main() {
  const experimentId = "demo-1";
  const wallet1 = "WALLET-TEST-1-ABC";
  const wallet2 = "WALLET-TEST-2-XYZ";

  sessionManager.setExperimentConfig({
    experimentId,
    s1Endowment: 10,
  });

  const s1 = sessionManager.upsertSubjectParticipation({
    wallet: wallet1,
    subjectId: wallet1,
    experimentId,
    treatmentTiming: TreatmentTiming.Synchronous,
  });

  const s2 = sessionManager.upsertSubjectParticipation({
    wallet: wallet2,
    subjectId: wallet2,
    experimentId,
    treatmentTiming: TreatmentTiming.Synchronous,
  });

  const game = sessionManager.matchNextPair({
    experimentId,
    treatmentTiming: TreatmentTiming.Synchronous,
  });

  if (!game) {
    throw new Error("Failed to match subjects into a game");
  }

  console.log("=== Before S1 send ===");
  console.log(s1);
  console.log(s2);
  console.log(game);

  const updatedGame = sessionManager.applyS1SendDecision({
    gameId: game.gameId,
    subjectId: wallet1,
    amount: 5,
  });

  console.log("=== S1 Send Test Result ===");
  console.dir(updatedGame, { depth: null });

  console.log("=== Updated subjects ===");
  console.dir(sessionManager.getSubjectParticipation(experimentId, wallet1), { depth: null });
  console.dir(sessionManager.getSubjectParticipation(experimentId, wallet2), { depth: null });
}

main();

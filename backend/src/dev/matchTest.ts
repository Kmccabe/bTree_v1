import { sessionManager, TreatmentTiming } from "../session/trustGameSession.js";

function main() {
  const experimentId = "demo-1";
  const wallet1 = "WALLET-TEST-1-ABC";
  const wallet2 = "WALLET-TEST-2-XYZ";

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

  console.log("=== Before matching ===");
  console.log(s1);
  console.log(s2);

  const game = sessionManager.matchNextPair({
    experimentId,
    treatmentTiming: TreatmentTiming.Synchronous,
  });

  console.log("=== Match result (GameInstance) ===");
  console.log(game);

  console.log("=== After matching: subjects ===");
  const updated1 = sessionManager.getSubjectParticipation(experimentId, wallet1);
  const updated2 = sessionManager.getSubjectParticipation(experimentId, wallet2);
  console.log(updated1);
  console.log(updated2);

  console.log("=== Games for experiment ===");
  console.log(sessionManager.listGames(experimentId));
}

main();

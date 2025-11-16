// D:\repo\bTree_v1\backend\src\dev\consentTest.ts

// D:\repo\bTree_v1\backend\src\dev\consentTest.ts

import { sessionManager, TreatmentTiming } from "../session/trustGameSession.js";

function main() {
  const wallet =
    "5LHXG4QJZDSFSX35HOIDG4WEQ43NWIVDTGAKYCUNGJZYNWW4JNBESWYD5U";

  const subjectRecord = sessionManager.upsertSubjectParticipation({
    wallet,
    subjectId: wallet,
    experimentId: "demo-1",
    treatmentTiming: TreatmentTiming.Synchronous, // <- key change
  });

  console.log("=== Consent Test Result ===");
  console.log(subjectRecord);
}

main();

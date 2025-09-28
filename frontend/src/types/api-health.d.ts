// frontend/src/types/api-health.d.ts

export type ProbeStatus = "OK" | "DEGRADED" | "DOWN";
export type Consistency = "OK" | "WARN" | "FAIL";

export interface ProbeResult {
  ok: boolean;
  status: ProbeStatus;
  latencyMs: number | null;
  round: number | null;
  details?: string;
  at: string;
}

export interface HealthSummary {
  network: "testnet" | "mainnet" | "localnet";
  algod: ProbeResult;
  indexer: ProbeResult;
  consistency: Consistency;
  roundGap: number | null;
}

// If some code imports the server handler module path for types or values,
// provide a permissive declaration so type-checking doesn’t fail.
declare module "../../api/health.js" {
  export type { ProbeStatus, Consistency, ProbeResult, HealthSummary };
  const _default: any; // handler function (not used client-side)
  export default _default;
}

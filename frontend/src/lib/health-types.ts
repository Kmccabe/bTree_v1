// frontend/src/lib/health-types.ts

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

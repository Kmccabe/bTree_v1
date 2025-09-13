// Simple in-memory selected App ID store for the SPA lifecycle
// No external deps; resolves to env fallback when not explicitly set.

let selectedAppId: number | undefined;

export function setSelectedAppId(id: number): void {
  if (Number.isInteger(id) && id > 0) {
    selectedAppId = id;
  } else {
    // Ignore invalid values; callers should validate before calling
    console.warn("[appId] ignoring invalid setSelectedAppId:", id);
  }
}

export function getSelectedAppId(): number | undefined {
  return selectedAppId;
}

export function clearSelectedAppId(): void {
  selectedAppId = undefined;
}

export function resolveAppId(): number {
  if (Number.isInteger(selectedAppId) && (selectedAppId as number) > 0) {
    return selectedAppId as number;
  }
  const envAny = (import.meta as any)?.env || {};
  const rawPrimary = envAny?.VITE_APP_ID as string | undefined;
  const rawTestnet = envAny?.VITE_TESTNET_APP_ID as string | undefined;
  const parsedPrimary = rawPrimary != null ? Number(rawPrimary) : NaN;
  const parsedTestnet = rawTestnet != null ? Number(rawTestnet) : NaN;
  if (Number.isInteger(parsedPrimary) && parsedPrimary > 0) return parsedPrimary;
  if (Number.isInteger(parsedTestnet) && parsedTestnet > 0) return parsedTestnet;
  throw new Error("No App ID selected and VITE_TESTNET_APP_ID is missing or invalid");
}

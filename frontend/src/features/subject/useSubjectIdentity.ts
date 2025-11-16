import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@txnlab/use-wallet";
import { registryApi, reputationApi, type SubjectReputation } from "./identityApi";

const buildDefaultReputation = (): SubjectReputation => ({ score: 0, completed: 0 });

const shortenAddress = (address?: string | null): string | null => {
  if (!address) return null;
  if (address.length <= 10) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
};

export type SubjectIdentityState = {
  subjectId: string | null;
  walletShort: string | null;
  reputation: SubjectReputation;
  loading: boolean;
  error: string | null;
};

export function useSubjectIdentity(): SubjectIdentityState {
  const { activeAddress, activeAccount, connectedAccounts = [] } = useWallet();

  const accountAddress = activeAccount?.address ?? null;
  const fallbackConnectedAddress = connectedAccounts.length > 0 ? connectedAccounts[0].address : null;

  const address = useMemo(() => {
    if (activeAddress) return activeAddress;
    if (accountAddress) return accountAddress;
    if (fallbackConnectedAddress) return fallbackConnectedAddress;
    return null;
  }, [activeAddress, accountAddress, fallbackConnectedAddress]);

  const walletShort = useMemo(() => shortenAddress(address), [address]);

  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [reputation, setReputation] = useState<SubjectReputation>(() => buildDefaultReputation());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setSubjectId(null);
      setReputation(buildDefaultReputation());
      setLoading(false);
      setError(null);
      return;
    }

    let alive = true;
    setLoading(true);
    setError(null);
    setReputation(buildDefaultReputation());
    setSubjectId(null);

    (async () => {
      try {
        const subject = await registryApi.getSubjectIdForAddress(address);
        if (!alive) return;
        setSubjectId(subject);
        if (!subject) return;

        const rep = await reputationApi.getReputation(subject);
        if (!alive) return;
        setReputation(rep ?? buildDefaultReputation());
      } catch (err) {
        if (!alive) return;
        console.error("[SubjectIdentity] lookup failed", err);
        const message = err instanceof Error ? err.message : String(err ?? "identity lookup failed");
        setError(message);
        setSubjectId(null);
        setReputation(buildDefaultReputation());
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [address]);

  return {
    subjectId,
    walletShort,
    reputation,
    loading,
    error,
  };
}

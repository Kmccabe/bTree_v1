import { useCallback, useMemo, useState } from "react";
import * as algosdk from "algosdk";
import { useWallet, PROVIDER_ID } from "@txnlab/use-wallet";
import { feeFor } from "../../features/registry/fees";
import { boxesForRegister } from "../../features/registry/boxes";
import { mRegisterIntent } from "../../features/registry/abi";

const ALGOD_URL = (import.meta.env.VITE_ALGOD_URL as string | undefined) || "http://localhost:4001";
const ALGOD_TOKEN = (import.meta.env.VITE_ALGOD_TOKEN as string | undefined) || "a".repeat(64);
const encoder = new TextEncoder();

export default function Register(): JSX.Element {
  const { activeAddress, providers, clients, signTransactions } = useWallet();
  const [appIdInput, setAppIdInput] = useState<string>("");
  const [subjectCode, setSubjectCode] = useState<string>("");
  const [contactHint, setContactHint] = useState<string>("");
  const [payoutCipher, setPayoutCipher] = useState<string>("X");
  const [status, setStatus] = useState<{ txId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const algodClient = useMemo(() => new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_URL, ""), []);

  const peraProvider = useMemo(() => providers?.find((p) => p.metadata.id === PROVIDER_ID.PERA), [providers]);
  const peraClient = clients?.[PROVIDER_ID.PERA];

  const handleConnect = useCallback(async () => {
    if (!peraProvider) {
      setError("Pera wallet provider not ready");
      return;
    }
    try {
      await peraProvider.connect();
      if (!peraProvider.isActive) peraProvider.setActiveProvider();
    } catch (err: any) {
      const msg = String(err?.message || err);
      if (msg.toLowerCase().includes("currently connected") && peraClient) {
        try {
          await peraClient.reconnect(() => {});
          if (!peraProvider.isActive) peraProvider.setActiveProvider();
        } catch (reconnectErr) {
          setError(String((reconnectErr as Error)?.message || reconnectErr));
        }
      } else {
        setError(msg);
      }
    }
  }, [peraProvider, peraClient]);

  const disabled = !activeAddress || !signTransactions || busy || !appIdInput.trim();

  const handleRegister = useCallback(async () => {
    if (!activeAddress || !signTransactions) {
      setError("Connect a wallet first");
      return;
    }
    const appId = Number(appIdInput);
    if (!Number.isInteger(appId) || appId <= 0) {
      setError("Enter a valid App ID");
      return;
    }

    setBusy(true);
    setError(null);
    setStatus(null);

    try {
      const sp = await algodClient.getTransactionParams().do();
      sp.flatFee = true;
      sp.fee = feeFor(2);

      const signer: algosdk.TransactionSigner = async (txns) => signTransactions(txns);

      const methodArgs = [
        subjectCode ? encoder.encode(subjectCode) : new Uint8Array(),
        contactHint ? encoder.encode(contactHint) : new Uint8Array(),
        encoder.encode(payoutCipher || "X"),
      ];
      const boxes = boxesForRegister(appId, activeAddress);

      const atc = new algosdk.AtomicTransactionComposer();
      atc.addMethodCall({
        appID: appId,
        method: mRegisterIntent,
        methodArgs,
        sender: activeAddress,
        suggestedParams: sp,
        signer,
        boxes,
      });

      const result = await atc.execute(algodClient, 4);
      const txId = result.txIDs[0];
      setStatus({ txId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setBusy(false);
    }
  }, [activeAddress, signTransactions, appIdInput, subjectCode, contactHint, payoutCipher, algodClient]);

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Register Intent</h1>
        <p className="text-sm text-neutral-600">
          Submit a registration call to the Registry application. Supply an App ID and connect a wallet to continue.
        </p>
      </header>

      <section className="space-y-2 rounded border p-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">Wallet:</span>
          {activeAddress ? <code className="text-xs">{activeAddress}</code> : <span className="text-xs text-neutral-600">Not connected</span>}
          <button
            className="rounded border px-2 py-1 text-xs"
            onClick={handleConnect}
            type="button"
          >
            {activeAddress ? "Reconnect" : "Connect"}
          </button>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Application ID</span>
          <input
            value={appIdInput}
            onChange={(e) => setAppIdInput(e.target.value.replace(/[^\d]/g, ""))}
            className="rounded border px-3 py-2"
            placeholder="e.g. 12345"
            inputMode="numeric"
            pattern="\d*"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Subject code (optional)</span>
          <input
            value={subjectCode}
            onChange={(e) => setSubjectCode(e.target.value)}
            className="rounded border px-3 py-2"
            placeholder="public bytes"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Contact hint (optional)</span>
          <input
            value={contactHint}
            onChange={(e) => setContactHint(e.target.value)}
            className="rounded border px-3 py-2"
            placeholder="email/handle (public)"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Payout cipher</span>
          <input
            value={payoutCipher}
            onChange={(e) => setPayoutCipher(e.target.value)}
            className="rounded border px-3 py-2"
            placeholder="cipher text"
          />
        </label>
        <button
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          onClick={handleRegister}
          disabled={disabled}
          type="button"
        >
          {busy ? "Submitting..." : "Register intent"}
        </button>
        {status && (
          <p className="text-sm text-green-700">Registered (txid {status.txId})</p>
        )}
        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
      </section>
    </main>
  );
}


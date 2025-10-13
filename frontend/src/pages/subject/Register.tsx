import { useCallback, useMemo, useState } from "react";
import algosdk, { AtomicTransactionComposer, TransactionSigner } from "algosdk";
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
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const algodClient = useMemo(() => new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_URL, ""), []);
  const peraProvider = useMemo(() => providers?.find((p) => p.metadata.id === PROVIDER_ID.PERA), [providers]);
  const peraClient = clients?.[PROVIDER_ID.PERA];

  // --- Explorer link helpers (TestNet) ---
  const explorerTxUrl = (txid: string) => `https://testnet.algoexplorer.io/tx/${txid}`;
  const explorerAppUrl = (appId: number) => `https://testnet.algoexplorer.io/application/${appId}`;

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
      sp.fee = BigInt(feeFor(2));

      const signer: TransactionSigner = async (txnGroup, indexes) => {
        const toSign = indexes.map((idx) => txnGroup[idx].toByte());
        const signed = await signTransactions(toSign);
        return signed.map((blob) => (blob instanceof Uint8Array ? blob : new Uint8Array(blob)));
      };

      const methodArgs = [
        subjectCode ? encoder.encode(subjectCode) : new Uint8Array(),
        contactHint ? encoder.encode(contactHint) : new Uint8Array(),
        encoder.encode(payoutCipher || "X"),
      ];
      const boxRefs = boxesForRegister(appId, activeAddress).map(([appIndex, name]) => ({ appIndex, name }));

      const atc = new AtomicTransactionComposer();
      atc.addMethodCall({
        appID: appId,
        method: mRegisterIntent,
        methodArgs,
        sender: activeAddress,
        suggestedParams: sp,
        signer,
        boxes: boxRefs,
      });

      const result = await atc.execute(algodClient, 4);
      setStatus(result.txIDs[0]);
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
            type="button"
            onClick={handleConnect}
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
          type="button"
          disabled={disabled}
          onClick={handleRegister}
        >
          {busy ? "Submitting..." : "Register intent"}
        </button>

        {status && (
          <div className="mt-2 rounded border p-3 text-sm">
            <div className="text-green-700 font-medium">Registered ✓</div>
            <div className="mt-1">
              txid:&nbsp;
              <a
                className="underline"
                href={explorerTxUrl(status)}
                target="_blank"
                rel="noreferrer"
              >
                {status}
              </a>
            </div>
            {!!appIdInput && (
              <div className="mt-1">
                app:&nbsp;
                <a
                  className="underline"
                  href={explorerAppUrl(Number(appIdInput))}
                  target="_blank"
                  rel="noreferrer"
                >
                  {appIdInput}
                </a>
              </div>
            )}
            <div className="mt-2 text-neutral-700">
              You’ll get an invite when you’re assigned.
            </div>
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </section>
    </main>
  );
}

import { useCallback, useMemo, useState } from "react";
import algosdk, { TransactionSigner } from "algosdk";
import { useWallet, PROVIDER_ID } from "@txnlab/use-wallet";
import { feeFor } from "../../features/registry/fees";
import {
  mAdminAddCapacity,
  mAdminClose,
  mAdminOpen,
  mAdminSetReward,
} from "../../features/registry/abi";

const ALGOD_URL =
  (import.meta.env.VITE_ALGOD_URL as string | undefined) || "https://testnet-api.algonode.cloud";
const ALGOD_TOKEN = (import.meta.env.VITE_ALGOD_TOKEN as string | undefined) || "";

const explorerTx = (txId: string) => `https://testnet.algoexplorer.io/tx/${txId}`;
const explorerApp = (appId: number) => `https://testnet.algoexplorer.io/application/${appId}`;

type ActionKind = "open" | "close" | "addCap" | "setReward";

type Result = {
  kind: ActionKind;
  txId: string;
};

export default function RegistryControls(): JSX.Element {
  const [appIdInput, setAppIdInput] = useState<string>("");
  const [capacityDeltaInput, setCapacityDeltaInput] = useState<string>("1");
  const [rewardInput, setRewardInput] = useState<string>("1000");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const { providers, clients, activeAddress, signTransactions } = useWallet();
  const peraProvider = useMemo(
    () => providers?.find((p) => p.metadata.id === PROVIDER_ID.PERA),
    [providers],
  );
  const peraClient = clients?.[PROVIDER_ID.PERA];
  const algod = useMemo(() => new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_URL, ""), []);

  const appId = useMemo(() => {
    const num = Number(appIdInput);
    return Number.isInteger(num) && num > 0 ? num : null;
  }, [appIdInput]);

  const capDelta = useMemo(() => {
    const num = Number(capacityDeltaInput);
    return Number.isInteger(num) && num >= 0 ? num : null;
  }, [capacityDeltaInput]);

  const rewardAmount = useMemo(() => {
    const num = Number(rewardInput);
    return Number.isInteger(num) && num >= 1000 ? num : null;
  }, [rewardInput]);

  const canSubmit = !!activeAddress && !!signTransactions && !!appId && !busy;

  const handleConnect = useCallback(async () => {
    if (!peraProvider) return;
    try {
      await peraProvider.connect();
      if (!peraProvider.isActive) peraProvider.setActiveProvider?.();
    } catch (err: any) {
      const msg = String(err?.message || err);
      if (msg.toLowerCase().includes("currently connected") && peraClient) {
        try {
          await peraClient.reconnect(() => {});
          if (!peraProvider.isActive) peraProvider.setActiveProvider?.();
        } catch (reconnectErr) {
          setError(String((reconnectErr as Error)?.message || reconnectErr));
        }
      } else {
        setError(msg);
      }
    }
  }, [peraProvider, peraClient]);

  const handleDisconnect = useCallback(async () => {
    try {
      await peraProvider?.disconnect();
    } catch {}
    try {
      await peraClient?.disconnect?.();
    } catch {}
  }, [peraProvider, peraClient]);

  const submit = useCallback(
    async (kind: ActionKind) => {
      if (!activeAddress || !signTransactions || !appId) return;
      setBusy(true);
      setError(null);
      setResult(null);
      try {
        const suggested = await algod.getTransactionParams().do();
        suggested.flatFee = true;
        suggested.fee = BigInt(feeFor(0));

        const signer: TransactionSigner = async (txnGroup, indexes) => {
          const toSign = indexes.map((idx) => txnGroup[idx].toByte());
          const signed = await signTransactions(toSign);
          return signed.map((blob) => (blob instanceof Uint8Array ? blob : new Uint8Array(blob)));
        };

        const atc = new algosdk.AtomicTransactionComposer();
        const baseCall = {
          sender: activeAddress,
          appID: appId,
          suggestedParams: suggested,
          signer,
        };

        switch (kind) {
          case "open":
            atc.addMethodCall({
              method: mAdminOpen,
              ...baseCall,
              methodArgs: [],
            });
            break;
          case "close":
            atc.addMethodCall({
              method: mAdminClose,
              ...baseCall,
              methodArgs: [],
            });
            break;
          case "addCap":
            if (capDelta == null) throw new Error("Enter a valid capacity delta");
            atc.addMethodCall({
              method: mAdminAddCapacity,
              ...baseCall,
              methodArgs: [BigInt(capDelta)],
            });
            break;
          case "setReward":
            if (rewardAmount == null) throw new Error("Reward must be at least 1000 microAlgos");
            atc.addMethodCall({
              method: mAdminSetReward,
              ...baseCall,
              methodArgs: [BigInt(rewardAmount)],
            });
            break;
          default:
            throw new Error("Unsupported action");
        }

        const res = await atc.execute(algod, 4);
        setResult({ kind, txId: res.txIDs[0] });
      } catch (err: any) {
        setError(String(err?.message || err));
      } finally {
        setBusy(false);
      }
    },
    [activeAddress, signTransactions, appId, capDelta, rewardAmount, algod],
  );

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Registry Controls</h1>
        <p className="text-sm text-neutral-600">
          Send admin method calls to the registry contract on Algorand TestNet.
        </p>
      </header>

      <section className="rounded border p-4 space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="flex flex-col text-sm">
            <span className="font-medium">Application ID</span>
            <input
              className="rounded border px-3 py-2"
              value={appIdInput}
              onChange={(e) => setAppIdInput(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="e.g. 747540520"
              inputMode="numeric"
              pattern="\d*"
            />
          </label>

          <label className="flex flex-col text-sm">
            <span className="font-medium">Capacity delta</span>
            <input
              className="rounded border px-3 py-2"
              value={capacityDeltaInput}
              onChange={(e) => setCapacityDeltaInput(e.target.value.replace(/[^\d]/g, ""))}
              inputMode="numeric"
              pattern="\d*"
              min={0}
            />
          </label>

          <label className="flex flex-col text-sm">
            <span className="font-medium">Reward (uAlgos)</span>
            <input
              className="rounded border px-3 py-2"
              value={rewardInput}
              onChange={(e) => setRewardInput(e.target.value.replace(/[^\d]/g, ""))}
              inputMode="numeric"
              pattern="\d*"
              min={1000}
            />
          </label>
        </div>

        <div className="flex items-center gap-3 rounded border px-3 py-2 text-sm">
          {activeAddress ? (
            <>
              <div className="flex-1">
                Connected wallet:{" "}
                <code>
                  {activeAddress.slice(0, 6)}...{activeAddress.slice(-6)}
                </code>
              </div>
              <button className="underline" onClick={handleDisconnect}>
                Disconnect
              </button>
            </>
          ) : (
            <>
              <div className="flex-1 text-neutral-600">
                Connect Pera wallet to submit admin calls.
              </div>
              <button
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white"
                onClick={handleConnect}
              >
                Connect
              </button>
            </>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            disabled={!canSubmit}
            onClick={() => submit("open")}
          >
            {busy ? "Submitting..." : "Open"}
          </button>
          <button
            type="button"
            className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            disabled={!canSubmit}
            onClick={() => submit("close")}
          >
            {busy ? "Submitting..." : "Close"}
          </button>
          <button
            type="button"
            className="rounded bg-purple-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            disabled={!canSubmit}
            onClick={() => submit("addCap")}
          >
            {busy ? "Submitting..." : "Add Capacity"}
          </button>
          <button
            type="button"
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            disabled={!canSubmit}
            onClick={() => submit("setReward")}
          >
            {busy ? "Submitting..." : "Set Reward"}
          </button>
        </div>

        {appId && (
          <div className="text-xs text-neutral-500">
            Target app:{" "}
            <a className="underline" href={explorerApp(appId)} target="_blank" rel="noreferrer">
              {appId}
            </a>
          </div>
        )}

        {error && (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-1 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
            <div>Action: {result.kind}</div>
            <div>
              Tx:{" "}
              <a className="underline" href={explorerTx(result.txId)} target="_blank" rel="noreferrer">
                {result.txId}
              </a>
            </div>
            <div>
              View registry status via{" "}
              <a className="underline" href="/admin/subject-pool">
                Subject Pool
              </a>
              .
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

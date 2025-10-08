import { useCallback, useMemo, useState } from "react";
import algosdk from "algosdk";
import { useWallet, PROVIDER_ID } from "@txnlab/use-wallet";
import { feeFor } from "../../features/registry/fees";
import { addrBytes, bLink, bLinkPending, bPaymentCipher } from "../../features/registry/boxes";
import { abiAppArgs } from "../../features/registry/abi";

const ALGOD_URL = (import.meta.env.VITE_ALGOD_URL as string | undefined) || "http://localhost:4001";
const ALGOD_TOKEN = (import.meta.env.VITE_ALGOD_TOKEN as string | undefined) || "a".repeat(64);
const encoder = new TextEncoder();

const normalizeSigned = (signed: (Uint8Array | ArrayLike<number>)[]): Uint8Array[] =>
  signed.map((blob) => (blob instanceof Uint8Array ? blob : new Uint8Array(blob)));

export default function LinkWallets(): JSX.Element {
  const { providers, clients, activeAddress, signTransactions } = useWallet();
  const [appIdInput, setAppIdInput] = useState<string>("");
  const [cipher, setCipher] = useState<string>("ENC");
  const [paymentAddress, setPaymentAddress] = useState<string>("");
  const [experimentAddress, setExperimentAddress] = useState<string>("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const algodClient = useMemo(() => new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_URL, ""), []);
  const peraProvider = useMemo(() => providers?.find((p) => p.metadata.id === PROVIDER_ID.PERA), [providers]);
  const peraClient = clients?.[PROVIDER_ID.PERA];
  const peraAccounts = peraProvider?.accounts || [];

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

  const ensureActiveAccount = useCallback(async (addr: string) => {
    const provider = peraProvider;
    if (!provider) throw new Error("Wallet provider unavailable");
    const belongs = provider.accounts?.some((a) => a.address === addr);
    if (!belongs) {
      throw new Error("Address not available in connected wallet");
    }
    if (!provider.isActive) {
      try { provider.setActiveProvider(); } catch {}
    }
    try {
      provider.setActiveAccount?.(addr);
    } catch (err) {
      console.warn("setActiveAccount failed", err);
    }
  }, [peraProvider]);

  const signWithAddress = useCallback(async (addr: string, txn: algosdk.Transaction) => {
    if (!signTransactions) throw new Error("Wallet signing unavailable");
    await ensureActiveAccount(addr);
    const signed = await signTransactions([txn.toByte()]);
    return normalizeSigned(signed)[0];
  }, [ensureActiveAccount, signTransactions]);

  const handleLink = useCallback(async () => {
    if (!signTransactions) {
      setError("Connect wallet first");
      return;
    }
    const appId = Number(appIdInput);
    if (!Number.isInteger(appId) || appId <= 0) {
      setError("Enter a valid App ID");
      return;
    }
    if (!paymentAddress) {
      setError("Select a payment wallet address");
      return;
    }
    if (!experimentAddress) {
      setError("Select an experiment wallet address");
      return;
    }

    setBusy(true);
    setError(null);
    setStatus(null);

    try {
      const baseSp = await algodClient.getTransactionParams().do();
      const sp0: algosdk.SuggestedParams = { ...baseSp, fee: feeFor(1), flatFee: true };
      const sp1: algosdk.SuggestedParams = { ...baseSp, fee: feeFor(3), flatFee: true };

      const payBytes = addrBytes(paymentAddress);
      const expBytes = addrBytes(experimentAddress);
      const cipherBytes = encoder.encode(cipher || "ENC");
      const pendingKey = bLinkPending(payBytes);

      const txn0 = algosdk.makeApplicationNoOpTxnFromObject({
        from: paymentAddress,
        appIndex: appId,
        suggestedParams: sp0,
        appArgs: abiAppArgs("link_payment_begin", [cipherBytes]),
        boxes: [{ appIndex: appId, name: pendingKey }],
      });

      const txn1 = algosdk.makeApplicationNoOpTxnFromObject({
        from: experimentAddress,
        appIndex: appId,
        suggestedParams: sp1,
        appArgs: abiAppArgs("link_finish", [paymentAddress]),
        boxes: [
          { appIndex: appId, name: bLink(expBytes) },
          { appIndex: appId, name: bPaymentCipher(expBytes) },
          { appIndex: appId, name: pendingKey },
        ],
      });

      const gid = algosdk.computeGroupID([txn0, txn1]);
      txn0.group = gid;
      txn1.group = gid;

      const signed0 = await signWithAddress(paymentAddress, txn0);
      const signed1 = await signWithAddress(experimentAddress, txn1);
      const response = await algodClient.sendRawTransaction([signed0, signed1]).do();
      const txId = (response as { txId?: string; txid?: string }).txId || (response as { txid?: string }).txid;
      if (!txId) throw new Error("Unable to retrieve transaction ID");
      await algosdk.waitForConfirmation(algodClient, txId, 4);
      setStatus(txId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setBusy(false);
    }
  }, [signTransactions, appIdInput, paymentAddress, experimentAddress, cipher, algodClient, signWithAddress]);

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Link Wallets</h1>
        <p className="text-sm text-neutral-600">Establish a dual-wallet link for the Registry application.</p>
      </header>

      <section className="rounded border p-4 space-y-3">
        <button className="rounded border px-3 py-1 text-xs" type="button" onClick={handleConnect}>
          Connect Pera Wallet
        </button>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Application ID</span>
          <input
            value={appIdInput}
            onChange={(e) => setAppIdInput(e.target.value.replace(/[^\d]/g, ""))}
            className="rounded border px-3 py-2"
            inputMode="numeric"
            pattern="\d*"
            placeholder="e.g. 12345"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Cipher bytes</span>
          <input
            value={cipher}
            onChange={(e) => setCipher(e.target.value)}
            className="rounded border px-3 py-2"
          />
        </label>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 rounded border p-4">
          <h2 className="text-lg font-medium">Payment wallet</h2>
          <p className="text-xs text-neutral-600">Account that initiates the link.</p>
          <select
            className="w-full rounded border px-3 py-2 text-sm"
            value={paymentAddress}
            onChange={(e) => setPaymentAddress(e.target.value)}
          >
            <option value="">Choose account</option>
            {peraAccounts.map((acct) => (
              <option key={acct.address} value={acct.address}>{acct.address}</option>
            ))}
          </select>
          {activeAddress && (
            <button
              className="rounded border px-3 py-1 text-xs"
              type="button"
              onClick={() => setPaymentAddress(activeAddress)}
            >
              Use active ({activeAddress.slice(0, 6)}…)
            </button>
          )}
          {paymentAddress && <p className="text-xs text-neutral-600">Selected: <code>{paymentAddress}</code></p>}
        </div>

        <div className="space-y-2 rounded border p-4">
          <h2 className="text-lg font-medium">Experiment wallet</h2>
          <p className="text-xs text-neutral-600">Account that completes the link.</p>
          <select
            className="w-full rounded border px-3 py-2 text-sm"
            value={experimentAddress}
            onChange={(e) => setExperimentAddress(e.target.value)}
          >
            <option value="">Choose account</option>
            {peraAccounts.map((acct) => (
              <option key={acct.address} value={acct.address}>{acct.address}</option>
            ))}
          </select>
          {activeAddress && (
            <button
              className="rounded border px-3 py-1 text-xs"
              type="button"
              onClick={() => setExperimentAddress(activeAddress)}
            >
              Use active ({activeAddress.slice(0, 6)}…)
            </button>
          )}
          {experimentAddress && <p className="text-xs text-neutral-600">Selected: <code>{experimentAddress}</code></p>}
        </div>
      </section>

      <button
        className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        type="button"
        onClick={handleLink}
        disabled={busy || !paymentAddress || !experimentAddress || !appIdInput.trim()}
      >
        {busy ? "Linking..." : "Link wallets"}
      </button>

      {status && <p className="text-sm text-green-700">Linked (group txid {status})</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </main>
  );
}

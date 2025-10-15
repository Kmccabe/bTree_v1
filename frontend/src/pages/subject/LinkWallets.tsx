import { useCallback, useMemo, useState } from "react";
import algosdk from "algosdk";
import { PROVIDER_ID, useWallet } from "@txnlab/use-wallet";
import { feeFor } from "../../features/registry/fees";
import { addrBytes, bLink, bLinkPending, bPaymentCipher } from "../../features/registry/boxes";
import { abiAppArgs, mLinkBegin, mLinkFinish } from "../../features/registry/abi";

const ALGOD_URL = (import.meta.env.VITE_ALGOD_URL as string | undefined) || "http://localhost:4001";
const ALGOD_TOKEN = (import.meta.env.VITE_ALGOD_TOKEN as string | undefined) || "a".repeat(64);
const encoder = new TextEncoder();

type LinkSuccess = {
  groupTxId: string;
  paymentAddress: string;
  experimentAddress: string;
};

const normalizeSigned = (signed: (Uint8Array | ArrayLike<number>)[]): Uint8Array[] =>
  signed.map((blob) => (blob instanceof Uint8Array ? blob : new Uint8Array(blob)));

const shortAddress = (addr: string): string =>
  (addr.length <= 12 ? addr : `${addr.slice(0, 6)}...${addr.slice(-4)}`);

export default function LinkWallets(): JSX.Element {
  const { providers, clients, activeAccount, activeAddress, signTransactions } = useWallet();
  const [appIdInput, setAppIdInput] = useState<string>("");
  const [cipher, setCipher] = useState<string>("ENC");
  const [paymentAddress, setPaymentAddress] = useState<string>("");
  const [experimentAddress, setExperimentAddress] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<LinkSuccess | null>(null);

  const algodClient = useMemo(() => new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_URL, ""), []);
  const peraProvider = useMemo(
    () => providers?.find((p) => p.metadata.id === PROVIDER_ID.PERA),
    [providers]
  );
  const peraClient = clients?.[PROVIDER_ID.PERA];
  const peraAccounts = peraProvider?.accounts ?? [];
  const activeAddr = activeAddress || activeAccount?.address;

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

  const ensureActiveAccount = useCallback(
    async (addr: string) => {
      if (!peraProvider) throw new Error("Wallet provider unavailable");
      const belongs = peraProvider.accounts?.some((acct) => acct.address === addr);
      if (!belongs) throw new Error("Address not available in connected wallet");
      if (!peraProvider.isActive) {
        try {
          peraProvider.setActiveProvider();
        } catch {
          /* noop */
        }
      }
      try {
        peraProvider.setActiveAccount?.(addr);
      } catch {
        /* optional */
      }
    },
    [peraProvider]
  );

  const signWithAddress = useCallback(
    async (addr: string, txn: algosdk.Transaction) => {
      if (!signTransactions) throw new Error("Wallet signing unavailable");
      await ensureActiveAccount(addr);
      const signed = await signTransactions([txn.toByte()]);
      return normalizeSigned(signed)[0];
    },
    [ensureActiveAccount, signTransactions]
  );

  const handleLink = useCallback(async () => {
    if (!signTransactions) {
      setError("Connect both wallets first");
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
    setSuccess(null);

    try {
      const baseSp = await algodClient.getTransactionParams().do();
      const sp0: algosdk.SuggestedParams = { ...baseSp, fee: BigInt(feeFor(1)), flatFee: true };
      const sp1: algosdk.SuggestedParams = { ...baseSp, fee: BigInt(feeFor(3)), flatFee: true };

      const payBytes = addrBytes(paymentAddress);
      const expBytes = addrBytes(experimentAddress);
      const pendingKey = bLinkPending(payBytes);
      const cipherBytes = encoder.encode(cipher || "ENC");

      const txn0 = algosdk.makeApplicationNoOpTxnFromObject({
        sender: paymentAddress,
        appIndex: appId,
        suggestedParams: sp0,
        appArgs: abiAppArgs(mLinkBegin.name, [cipherBytes]),
        boxes: [{ appIndex: appId, name: pendingKey }],
      });

      const txn1 = algosdk.makeApplicationNoOpTxnFromObject({
        sender: experimentAddress,
        appIndex: appId,
        suggestedParams: sp1,
        appArgs: abiAppArgs(mLinkFinish.name, [paymentAddress]),
        boxes: [
          { appIndex: appId, name: bLink(expBytes) },
          { appIndex: appId, name: bPaymentCipher(expBytes) },
          { appIndex: appId, name: pendingKey },
        ],
      });

      const gid = algosdk.computeGroupID([txn0, txn1]);
      txn0.group = gid;
      txn1.group = gid;

      const paymentSigned = await signWithAddress(paymentAddress, txn0);
      const experimentSigned = await signWithAddress(experimentAddress, txn1);

      const tx0Id = txn0.txID();
      await algodClient.sendRawTransaction([paymentSigned, experimentSigned]).do();
      await algosdk.waitForConfirmation(algodClient, tx0Id, 4);

      setSuccess({
        groupTxId: tx0Id,
        paymentAddress,
        experimentAddress,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setBusy(false);
    }
  }, [
    signTransactions,
    appIdInput,
    paymentAddress,
    experimentAddress,
    cipher,
    algodClient,
    signWithAddress,
  ]);

  const explorerTxUrl = (txId: string) => `https://testnet.algoexplorer.io/tx/${txId}`;
  const connectLabel = peraProvider?.isConnected ? "Reconnect Pera Wallet" : "Connect Pera Wallet";

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Link Wallets</h1>
        <p className="text-sm text-neutral-600">Run the optional dual-wallet link for the Registry app.</p>
        <p className="text-xs text-neutral-500">Optional now; enables private payout wallet later.</p>
      </header>

      <section className="space-y-3 rounded border p-4">
        <div className="flex items-center gap-3 text-sm">
          <button
            className="rounded border px-3 py-1 text-xs"
            type="button"
            onClick={handleConnect}
          >
            {connectLabel}
          </button>
          <span className="text-xs text-neutral-600">Accounts detected: {peraAccounts.length}</span>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Application ID</span>
          <input
            value={appIdInput}
            onChange={(event) => setAppIdInput(event.target.value.replace(/[^\d]/g, ""))}
            className="rounded border px-3 py-2"
            inputMode="numeric"
            pattern="\d*"
            placeholder="e.g. 12345"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Cipher</span>
          <input
            value={cipher}
            onChange={(event) => setCipher(event.target.value)}
            className="rounded border px-3 py-2"
            placeholder="ENC"
          />
        </label>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <WalletColumn
          title="Payment wallet"
          subtitle="Signs link_payment_begin"
          accounts={peraAccounts}
          selected={paymentAddress}
          onSelect={setPaymentAddress}
          activeAccountAddress={activeAddr}
        />
        <WalletColumn
          title="Experiment wallet"
          subtitle="Signs link_finish"
          accounts={peraAccounts}
          selected={experimentAddress}
          onSelect={setExperimentAddress}
          activeAccountAddress={activeAddr}
        />
      </section>

      <button
        className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        type="button"
        onClick={handleLink}
        disabled={busy || !paymentAddress || !experimentAddress || !appIdInput.trim()}
      >
        {busy ? "Linking..." : "Link Wallets"}
      </button>

      {success && (
        <div className="space-y-2 rounded border border-green-200 bg-green-50 p-4 text-sm">
          <div className="font-medium text-green-700">✅ Linked ✓</div>
          <div>
            Group tx:&nbsp;
            <a className="underline" href={explorerTxUrl(success.groupTxId)} target="_blank" rel="noreferrer">
              {success.groupTxId}
            </a>
          </div>
          <div className="text-neutral-700">Payment: {shortAddress(success.paymentAddress)}</div>
          <div className="text-neutral-700">Experiment: {shortAddress(success.experimentAddress)}</div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </main>
  );
}

type WalletColumnProps = {
  title: string;
  subtitle: string;
  accounts: { address: string }[];
  selected: string;
  onSelect: (addr: string) => void;
  activeAccountAddress?: string;
};

function WalletColumn({
  title,
  subtitle,
  accounts,
  selected,
  onSelect,
  activeAccountAddress,
}: WalletColumnProps) {
  return (
    <div className="space-y-2 rounded border p-4">
      <h2 className="text-lg font-medium">{title}</h2>
      <p className="text-xs text-neutral-600">{subtitle}</p>
      <select
        className="w-full rounded border px-3 py-2 text-sm"
        value={selected}
        onChange={(event) => onSelect(event.target.value)}
      >
        <option value="">Choose account</option>
        {accounts.map((acct) => (
          <option key={acct.address} value={acct.address}>
            {acct.address}
          </option>
        ))}
      </select>
      {activeAccountAddress && (
        <button
          className="rounded border px-3 py-1 text-xs"
          type="button"
          onClick={() => onSelect(activeAccountAddress)}
        >
          Use active ({shortAddress(activeAccountAddress)})
        </button>
      )}
      {selected && (
        <p className="text-xs text-neutral-600">
          Selected:&nbsp;
          <code>{selected}</code>
        </p>
      )}
    </div>
  );
}

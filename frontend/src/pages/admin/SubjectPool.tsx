import { useCallback, useMemo, useState } from "react";
import algosdk from "algosdk";

const ALGOD_URL = (import.meta.env.VITE_ALGOD_URL as string | undefined) || "https://testnet-api.algonode.cloud";
const ALGOD_TOKEN = (import.meta.env.VITE_ALGOD_TOKEN as string | undefined) || "";

type Globals = {
  is_open: number;
  cap_total: number;
  registered_count: number;
  micro_reward: number;
  admin_addr?: string;
};

export default function AdminSubjectPool(): JSX.Element {
  const [appIdInput, setAppIdInput] = useState<string>("");
  const [addrInput, setAddrInput] = useState<string>("");
  const [globals, setGlobals] = useState<Globals | null>(null);
  const [boxProfile, setBoxProfile] = useState<string | null>(null);
  const [boxCipher, setBoxCipher] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const algod = useMemo(() => new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_URL, ""), []);

  const explorerApp = (appId: number) => `https://testnet.algoexplorer.io/application/${appId}`;
  const explorerAddr = (addr: string) => `https://testnet.algoexplorer.io/address/${addr}`;

  const td = new TextDecoder();

  // defensive base64 → bytes (null if invalid)
  const b64ToBytes = (v: unknown): Uint8Array | null => {
    if (typeof v !== "string" || !v) return null;
    try {
      return Uint8Array.from(atob(v), (c) => c.charCodeAt(0));
    } catch {
      return null;
    }
  };

  // cheap address validator
  const isValidAddr = (addr: string) => {
    try {
      algosdk.decodeAddress(addr);
      return true;
    } catch {
      return false;
    }
  };

  const keyToString = (key: string | Uint8Array): string => {
    if (typeof key === "string") {
      const decoded = b64ToBytes(key);
      return decoded ? td.decode(decoded) : "";
    }
    return td.decode(key);
  };

  const valueBytes = (
    val: string | Uint8Array | ArrayLike<number> | null | undefined
  ): Uint8Array | null => {
    if (!val) return null;
    if (typeof val === "string") return b64ToBytes(val);
    if (val instanceof Uint8Array) return val;
    if (Array.isArray(val)) return Uint8Array.from(val);
    if (typeof (val as ArrayLike<number>).length === "number") {
      return Uint8Array.from(val as ArrayLike<number>);
    }
    return null;
  };

  const toNumber = (val: bigint | number | undefined): number =>
    typeof val === "bigint" ? Number(val) : Number(val ?? 0);

  const parseGlobals = (raw: any): Globals => {
    const params = raw?.params ?? raw ?? {};
    const entries =
      params["global-state"] ??
      params["globalState"] ??
      params.globalState ??
      [];

    const state: Record<string, any> = {};

    if (Array.isArray(entries)) {
      for (const entry of entries) {
        if (!entry) continue;
        const keyRaw = entry.key ?? entry.Key;
        const value = entry.value ?? entry.Value;
        if (!keyRaw || !value) continue;

        const key = keyToString(keyRaw);
        if (!key) continue;

        const type = toNumber(value.type ?? value.Type);

        if (type === 1) {
          const bytes = valueBytes(value.bytes ?? value.Bytes);
          if (bytes) state[key] = bytes;
        } else {
          state[key] = toNumber(value.uint ?? value.Uint);
        }
      }
    }

    const adminRaw = state["admin_addr"];
    const adminBytes =
      adminRaw instanceof Uint8Array
        ? adminRaw
        : typeof adminRaw === "string"
        ? b64ToBytes(adminRaw)
        : null;
    const admin_addr =
      adminBytes && adminBytes.length === 32 ? algosdk.encodeAddress(adminBytes) : undefined;

    return {
      is_open: Number(state["is_open"] ?? 0),
      cap_total: Number(state["cap_total"] ?? 0),
      registered_count: Number(state["registered_count"] ?? 0),
      micro_reward: Number(state["micro_reward"] ?? 0),
      admin_addr,
    };
  };

  const addrBytes = (addr: string) => algosdk.decodeAddress(addr).publicKey;
  const te = new TextEncoder();
  const bnProfile = (addr: string) => new Uint8Array([...te.encode("profile:"), ...addrBytes(addr)]);
  const bnCipher = (addr: string) => new Uint8Array([...te.encode("payment_cipher:"), ...addrBytes(addr)]);

  const toAscii = (u8: Uint8Array | null) => {
    if (!u8) return null;
    const printable = Array.from(u8).every((c) => c >= 32 && c <= 126);
    return printable ? new TextDecoder().decode(u8) : Array.from(u8).map((b) => b.toString(16).padStart(2, "0")).join("");
  };

  const onReadGlobals = useCallback(async () => {
    setBusy(true);
    setError(null);
    setGlobals(null);
    try {
      const appId = Number(appIdInput);
      if (!Number.isInteger(appId) || appId <= 0) throw new Error("Enter a valid App ID");
      const info = await algod.getApplicationByID(appId).do();
      setGlobals(parseGlobals(info));
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }, [algod, appIdInput]);

  const onReadBoxes = useCallback(async () => {
    setBusy(true);
    setError(null);
    setBoxProfile(null);
    setBoxCipher(null);
    try {
      const appId = Number(appIdInput);
      if (!Number.isInteger(appId) || appId <= 0) throw new Error("Enter a valid App ID");
      const addr = addrInput.trim();
      if (!addr) throw new Error("Enter a wallet address");
      if (!isValidAddr(addr)) throw new Error("Enter a valid Algorand address");

      const profRes = await algod.getApplicationBoxByName(appId, bnProfile(addr)).do().catch(() => null);
      const ciphRes = await algod.getApplicationBoxByName(appId, bnCipher(addr)).do().catch(() => null);

      const profVal = profRes && ((profRes as any).value ?? (profRes as any).Value);
      const ciphVal = ciphRes && ((ciphRes as any).value ?? (ciphRes as any).Value);

      const profBytes = valueBytes(profVal);
      const ciphBytes = valueBytes(ciphVal);

      setBoxProfile(profBytes ? "set" : null);
      setBoxCipher(toAscii(ciphBytes));
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }, [algod, appIdInput, addrInput]);

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Admin — Subject Pool</h1>
        <p className="text-sm text-neutral-600">
          Read registry status and per-subject boxes directly from Algod (TestNet).
        </p>
      </header>

      <section className="rounded border p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="flex flex-col text-sm">
            <span className="font-medium">Application ID</span>
            <input
              value={appIdInput}
              onChange={(e) => setAppIdInput(e.target.value.replace(/[^\d]/g, ""))}
              className="rounded border px-3 py-2"
              placeholder="e.g. 747540520"
              inputMode="numeric"
              pattern="\d*"
            />
          </label>
          <label className="flex flex-col text-sm md:col-span-2">
            <span className="font-medium">Wallet address (subject)</span>
            <input
              value={addrInput}
              onChange={(e) => setAddrInput(e.target.value)}
              className="rounded border px-3 py-2"
              placeholder="N... (TestNet)"
            />
          </label>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            disabled={busy || !appIdInput}
            onClick={onReadGlobals}
          >
            {busy ? "Reading…" : "Read Status"}
          </button>
          <button
            type="button"
            className="rounded bg-purple-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            disabled={busy || !appIdInput || !addrInput}
            onClick={onReadBoxes}
          >
            {busy ? "Reading…" : "Read Boxes"}
          </button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {globals && (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded border p-3 text-sm">
              <div className="font-medium">Globals</div>
              <div>is_open: <code>{globals.is_open}</code></div>
              <div>cap_total: <code>{globals.cap_total}</code></div>
              <div>registered_count: <code>{globals.registered_count}</code></div>
              <div>micro_reward: <code>{globals.micro_reward}</code></div>
              {globals.admin_addr && (
                <div className="mt-1 text-neutral-600">
                  admin: <a className="underline" href={explorerAddr(globals.admin_addr)} target="_blank" rel="noreferrer">
                    {globals.admin_addr}
                  </a>
                </div>
              )}
              {!!appIdInput && (
                <div className="mt-1">
                  app: <a className="underline" href={explorerApp(Number(appIdInput))} target="_blank" rel="noreferrer">
                    {appIdInput}
                  </a>
                </div>
              )}
            </div>

            <div className="rounded border p-3 text-sm">
              <div className="font-medium">Subject</div>
              <div>wallet: {addrInput ? <a className="underline" href={explorerAddr(addrInput)} target="_blank" rel="noreferrer">{addrInput}</a> : "-"}</div>
              <div className="mt-1">profile: {boxProfile ? <code>set</code> : <span className="text-neutral-500">not found</span>}</div>
              <div>payment_cipher: {boxCipher ? <code>{boxCipher}</code> : <span className="text-neutral-500">not found</span>}</div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}


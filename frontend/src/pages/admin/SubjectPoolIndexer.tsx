import { useMemo, useState } from "react";
import { mRegisterIntent } from "../../features/registry/abi";

const INDEXER_BASE_URL = "https://testnet-idx.algonode.cloud";
const TX_LIMIT = "1000";
const SELECTOR_BYTES = mRegisterIntent.getSelector();

interface IndexerTransaction {
  id: string;
  sender: string;
  ["round-time"]?: number;
  ["application-transaction"]?: {
    ["application-args"]?: string[];
  };
}

interface IndexerResponse {
  transactions?: IndexerTransaction[];
  ["next-token"]?: string;
}

interface DecodedArg {
  display: string;
  csv: string;
  hasValue: boolean;
}

interface SubjectRecord {
  address: string;
  firstSeen: number | null;
  firstTxId: string;
  count: number;
  contactDisplay: string;
  contactCsv: string;
  campaignCsv: string;
  campaignDisplay: string;
}

const NO_ARG: DecodedArg = { display: "-", csv: "", hasValue: false };

const selectorEquals = (bytes: Uint8Array): boolean => {
  if (bytes.length !== SELECTOR_BYTES.length) return false;
  for (let i = 0; i < bytes.length; i += 1) {
    if (bytes[i] !== SELECTOR_BYTES[i]) return false;
  }
  return true;
};

const base64ToBytes = (value: string): Uint8Array => {
  const binary = atob(value);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const isPrintableAscii = (bytes: Uint8Array): boolean =>
  bytes.every((b) => b >= 32 && b <= 126);

const bytesToAscii = (bytes: Uint8Array): string =>
  String.fromCharCode(...bytes);

const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

const decodeArg = (arg?: string): DecodedArg => {
  if (!arg) return NO_ARG;
  try {
    const bytes = base64ToBytes(arg);
    if (!bytes.length) return NO_ARG;
    if (isPrintableAscii(bytes)) {
      const ascii = bytesToAscii(bytes);
      return { display: ascii, csv: ascii, hasValue: true };
    }
    const hex = bytesToHex(bytes);
    const shortened = hex.length > 16 ? `0x${hex.slice(0, 16)}...` : `0x${hex}`;
    return { display: shortened, csv: `0x${hex}`, hasValue: true };
  } catch (err) {
    return NO_ARG;
  }
};

const formatDate = (value: number | null): string =>
  value !== null ? new Date(value * 1000).toISOString() : "-";

const csvEscape = (value: string): string => {
  const safe = value ?? "";
  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
};

const buildUrl = (appId: number, nextToken?: string): string => {
  const url = new URL("/v2/transactions", INDEXER_BASE_URL);
  url.searchParams.set("application-id", appId.toString());
  url.searchParams.set("tx-type", "appl");
  url.searchParams.set("limit", TX_LIMIT);
  if (nextToken) {
    url.searchParams.set("next", nextToken);
  }
  return url.toString();
};

const mergeTransactions = (
  txs: IndexerTransaction[],
  since: number | undefined,
  existing: Map<string, SubjectRecord>
): Map<string, SubjectRecord> => {
  const map = existing.size ? new Map(existing) : new Map<string, SubjectRecord>();

  txs.forEach((tx) => {
    const roundTime = tx["round-time"] ?? null;
    if (since !== undefined) {
      if (roundTime === null || roundTime < since) return;
    }

    const appCall = tx["application-transaction"];
    const args = appCall?.["application-args"];
    if (!args || args.length === 0) return;

    const selectorArg = args[0];
    if (!selectorArg) return;

    let selector: Uint8Array;
    try {
      selector = base64ToBytes(selectorArg);
    } catch (error) {
      return;
    }
    if (!selectorEquals(selector)) return;

    const campaign = decodeArg(args[1]);
    const contact = decodeArg(args[2]);

    const address = tx.sender;
    const existingRecord = map.get(address);

    if (!existingRecord) {
      map.set(address, {
        address,
        firstSeen: roundTime,
        firstTxId: tx.id,
        count: 1,
        contactDisplay: contact.display,
        contactCsv: contact.csv,
        campaignCsv: campaign.csv,
        campaignDisplay: campaign.display,
      });
      return;
    }

    let updated: SubjectRecord = {
      ...existingRecord,
      count: existingRecord.count + 1,
    };

    const roundTimeIsEarlier =
      roundTime !== null &&
      (existingRecord.firstSeen === null || roundTime < existingRecord.firstSeen);

    if (roundTimeIsEarlier) {
      const contactDisplay = contact.hasValue
        ? contact.display
        : existingRecord.contactDisplay;
      const contactCsv = contact.hasValue
        ? contact.csv
        : existingRecord.contactCsv;
      const campaignDisplay = campaign.hasValue
        ? campaign.display
        : existingRecord.campaignDisplay;
      const campaignCsv = campaign.hasValue
        ? campaign.csv
        : existingRecord.campaignCsv;

      updated = {
        ...updated,
        firstSeen: roundTime,
        firstTxId: tx.id,
        contactDisplay,
        contactCsv,
        campaignCsv,
        campaignDisplay,
      };
    } else {
      if (!existingRecord.contactDisplay || existingRecord.contactDisplay === "-") {
        if (contact.hasValue) {
          updated = {
            ...updated,
            contactDisplay: contact.display,
            contactCsv: contact.csv,
          };
        }
      }
      if (!existingRecord.campaignDisplay || existingRecord.campaignDisplay === "-") {
        if (campaign.hasValue) {
          updated = {
            ...updated,
            campaignDisplay: campaign.display,
            campaignCsv: campaign.csv,
          };
        }
      }
    }

    map.set(address, updated);
  });

  return map;
};

const fetchTransactions = async (
  appId: number,
  nextToken?: string
): Promise<IndexerResponse> => {
  const response = await fetch(buildUrl(appId, nextToken));
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Indexer error ${response.status}: ${text || response.statusText}`
    );
  }
  return (await response.json()) as IndexerResponse;
};

const SubjectPoolIndexer = (): JSX.Element => {
  const [appIdInput, setAppIdInput] = useState<string>("");
  const [sinceInput, setSinceInput] = useState<string>("");
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<Map<string, SubjectRecord>>(
    () => new Map()
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);

  const rows = useMemo(() => {
    const arr = Array.from(subjects.values());
    arr.sort((a, b) => {
      const aTime = a.firstSeen ?? Number.POSITIVE_INFINITY;
      const bTime = b.firstSeen ?? Number.POSITIVE_INFINITY;
      return aTime - bTime;
    });
    return arr;
  }, [subjects]);

  const parseAppId = (): number | null => {
    const trimmed = appIdInput.trim();
    if (!trimmed) {
      setError("App ID is required.");
      return null;
    }
    const parsed = Number(trimmed);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      setError("App ID must be a positive integer.");
      return null;
    }
    return parsed;
  };

  const parseSince = (): number | undefined | null => {
    const trimmed = sinceInput.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError("Since must be a unix timestamp (non-negative number).");
      return null;
    }
    return parsed;
  };

  const loadPage = async (reset: boolean): Promise<void> => {
    const appId = parseAppId();
    if (appId === null) return;
    const since = parseSince();
    if (since === null) return;

    setBusy(true);
    setError(null);

    try {
      const response = await fetchTransactions(
        appId,
        reset ? undefined : nextToken || undefined
      );
      const txs = response.transactions ?? [];
      setSubjects((prev) =>
        mergeTransactions(
          txs,
          since,
          reset ? new Map<string, SubjectRecord>() : prev
        )
      );
      setNextToken(response["next-token"] ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error fetching indexer.");
    } finally {
      setBusy(false);
    }
  };

  const handleLoad = (): void => {
    setNextToken(null);
    setSubjects(new Map());
    void loadPage(true);
  };

  const handleLoadMore = (): void => {
    if (!nextToken) return;
    void loadPage(false);
  };

  const handleExportCsv = (): void => {
    if (!rows.length) return;
    const header = "address,campaign,contact,first_seen,first_txid,count";
    const lines = rows.map((row) =>
      [
        csvEscape(row.address),
        csvEscape(row.campaignCsv),
        csvEscape(row.contactCsv),
        csvEscape(row.firstSeen !== null ? String(row.firstSeen) : ""),
        csvEscape(row.firstTxId),
        csvEscape(String(row.count)),
      ].join(",")
    );
    const csv = [header, ...lines].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `subject-pool-${appIdInput.trim() || "export"}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section>
      <h1>Subject Pool Indexer</h1>
      <p>
        Scan the Algonode Indexer for <code>register_intent</code> activity and export
        a deduplicated roster of subjects.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
        <label style={{ display: "flex", flexDirection: "column" }}>
          App ID
          <input
            type="number"
            min="1"
            placeholder="Registry app ID"
            value={appIdInput}
            onChange={(e) => setAppIdInput(e.target.value)}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column" }}>
          Since (unix seconds)
          <input
            type="number"
            min="0"
            placeholder="Optional"
            value={sinceInput}
            onChange={(e) => setSinceInput(e.target.value)}
          />
        </label>
      </div>

      <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem" }}>
        <button onClick={handleLoad} disabled={busy}>
          {busy ? "Loading..." : "Load"}
        </button>
        <button onClick={handleLoadMore} disabled={busy || !nextToken}>
          Load more
        </button>
        <button onClick={handleExportCsv} disabled={!rows.length}>
          Export CSV
        </button>
      </div>

      {error ? (
        <div
          role="alert"
          style={{
            marginTop: "1rem",
            color: "#b00020",
            whiteSpace: "pre-wrap",
          }}
        >
          {error}
        </div>
      ) : null}

      <div style={{ marginTop: "1rem" }}>
        <div>Results: {rows.length}</div>
        <div>Next token: {nextToken ?? "-"}</div>
      </div>

      <div style={{ marginTop: "1rem", overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Address</th>
              <th>Contact</th>
              <th>First Seen (UTC)</th>
              <th>First Tx</th>
              <th>Count</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: "1rem" }}>
                  {busy ? "Loading transactions..." : "No results yet."}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.address}>
                  <td>
                    <a
                      href={`https://testnet.algoexplorer.io/address/${row.address}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {row.address}
                    </a>
                  </td>
                  <td>{row.contactDisplay}</td>
                  <td>{formatDate(row.firstSeen)}</td>
                  <td>
                    <a
                      href={`https://testnet.algoexplorer.io/tx/${row.firstTxId}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {row.firstTxId}
                    </a>
                  </td>
                  <td>{row.count}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default SubjectPoolIndexer;

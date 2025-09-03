import algosdk from "algosdk";

function getAlgodClient(): algosdk.Algodv2 {
  const net = ((import.meta as any).env?.VITE_NETWORK as string | undefined)?.toUpperCase?.() || "TESTNET";
  let server = "";
  let token = "";
  if (net === "MAINNET") {
    server = ((import.meta as any).env?.VITE_MAINNET_ALGOD_URL as string) || "https://mainnet-api.algonode.cloud";
    token = ((import.meta as any).env?.VITE_MAINNET_ALGOD_TOKEN as string) || "";
  } else {
    server = ((import.meta as any).env?.VITE_TESTNET_ALGOD_URL as string) || "https://testnet-api.algonode.cloud";
    token = ((import.meta as any).env?.VITE_TESTNET_ALGOD_TOKEN as string) || "";
  }
  return new algosdk.Algodv2(token, server, "");
}

export async function getAccountBalanceMicroAlgos(addr: string): Promise<number> {
  const client = getAlgodClient();
  const resp = await client.accountInformation(addr).do();
  return Number(resp?.amount ?? 0);
}


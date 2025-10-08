import algosdk, {
  SuggestedParams,
  AtomicTransactionComposer,
  makeApplicationNoOpTxnFromObject,
} from "algosdk";
import type { Wallet } from "@txnlab/use-wallet";

export function makeATCForWallet(wallet: Wallet, sp: SuggestedParams) {
  const atc = new AtomicTransactionComposer();
  const signer = async (txns: Uint8Array[]) => {
    const signed = await wallet.signTransactions(txns);
    return signed.map((blob) => (blob instanceof Uint8Array ? blob : new Uint8Array(blob)));
  };
  return { atc, signer, sp } as const;
}

export async function signAndSend(
  wallet: Wallet,
  client: algosdk.Algodv2,
  txn: algosdk.Transaction,
) {
  const signed = await wallet.signTransactions([txn.toByte()]);
  const blob = signed[0] instanceof Uint8Array ? signed[0] : new Uint8Array(signed[0]);
  const { txId } = await client.sendRawTransaction(blob).do();
  await algosdk.waitForConfirmation(client, txId, 4);
  return txId;
}

// Re-export helper for convenience in callers that prefer object syntax
export const makeNoOpTxnFromObject = makeApplicationNoOpTxnFromObject;

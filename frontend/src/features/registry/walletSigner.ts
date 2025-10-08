import algosdk, { AtomicTransactionComposer, SuggestedParams, TransactionSigner } from "algosdk";

export interface WalletLike {
  signTransactions(txns: Uint8Array[]): Promise<(Uint8Array | ArrayLike<number>)[]>;
}

const normalizeSigned = (signed: (Uint8Array | ArrayLike<number>)[]): Uint8Array[] =>
  signed.map((blob) => (blob instanceof Uint8Array ? blob : new Uint8Array(blob)));

export const walletTransactionSigner = (wallet: WalletLike): TransactionSigner =>
  async (txnGroup, indexes) => {
    const toSign = indexes.map((idx) => txnGroup[idx].toByte());
    const signed = await wallet.signTransactions(toSign);
    return normalizeSigned(signed);
  };

export function makeATCForWallet(wallet: WalletLike, sp: SuggestedParams) {
  return {
    atc: new AtomicTransactionComposer(),
    signer: walletTransactionSigner(wallet),
    sp,
  } as const;
}

export async function signAndSend(
  wallet: WalletLike,
  client: algosdk.Algodv2,
  txn: algosdk.Transaction,
) {
  const signed = await wallet.signTransactions([txn.toByte()]);
  const blob = normalizeSigned(signed)[0];
  const response = await client.sendRawTransaction(blob).do();
  const txId = (response as { txId?: string; txid?: string }).txId || (response as { txid?: string }).txid;
  if (!txId) throw new Error("Unable to retrieve transaction ID");
  await algosdk.waitForConfirmation(client, txId, 4);
  return txId;
}

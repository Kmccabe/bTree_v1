import { decodeAddress } from "algosdk";

const encoder = new TextEncoder();

export const addrBytes = (addr: string): Uint8Array => decodeAddress(addr).publicKey;

const prefixed = (prefix: string, ab: Uint8Array): Uint8Array => {
  const prefixBytes = encoder.encode(prefix);
  const merged = new Uint8Array(prefixBytes.length + ab.length);
  merged.set(prefixBytes, 0);
  merged.set(ab, prefixBytes.length);
  return merged;
};

export const bProfile = (ab: Uint8Array): Uint8Array => prefixed("profile:", ab);
export const bPaymentCipher = (ab: Uint8Array): Uint8Array => prefixed("payment_cipher:", ab);
export const bLink = (ab: Uint8Array): Uint8Array => prefixed("link:", ab);
export const bLinkPending = (ab: Uint8Array): Uint8Array => prefixed("link_pending:", ab);

export const boxesForRegister = (appId: number, addr: string) => {
  const ab = addrBytes(addr);
  return [
    [appId, bProfile(ab)],
    [appId, bPaymentCipher(ab)],
  ] as [number, Uint8Array][];
};

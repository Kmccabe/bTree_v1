// frontend/src/chain/enc.ts

/**
 * Encode a UTF-8 string into a Uint8Array (for Algorand appArgs).
 * Usage: appArgs: [str("register"), str("KAM_TEST_001")]
 */
export function str(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

/**
 * Encode an unsigned 64-bit integer to 8 bytes (big-endian).
 * Accepts number (must be a safe integer) or bigint.
 * Usage: appArgs: [str("bid"), u64(100000)]
 */
export function u64(n: number | bigint): Uint8Array {
  let v: bigint;

  if (typeof n === "number") {
    if (!Number.isFinite(n) || !Number.isInteger(n)) {
      throw new Error("u64: number must be a finite integer");
    }
    if (!Number.isSafeInteger(n)) {
      throw new Error("u64: number exceeds JS safe integer range; pass a bigint instead");
    }
    if (n < 0) {
      throw new Error("u64: value must be >= 0");
    }
    v = BigInt(n);
  } else {
    v = n;
    if (v < 0n) throw new Error("u64: value must be >= 0");
  }

  const U64_MAX = 0xFFFF_FFFF_FFFF_FFFFn;
  if (v > U64_MAX) {
    throw new Error("u64: value exceeds 2^64 - 1");
  }

  const out = new Uint8Array(8);
  let x = v;
  for (let i = 7; i >= 0; i--) {
    out[i] = Number(x & 0xffn);
    x >>= 8n;
  }
  return out;
}

/** Compatibility alias if older code refers to itob8() */
export const itob8 = u64;

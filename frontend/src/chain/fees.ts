// frontend/src/chain/fees.ts
export const MIN_FEE = 1000; // µAlgos

/**
 * Fee for an AppCall that must cover itself + inner transactions.
 * @param innerCount number of inner txns emitted by the AppCall
 * @param headroom optional extra units of min-fee (default 0)
 */
export function appCallFee(innerCount: number, headroom = 0): number {
  if (innerCount < 0) innerCount = 0;
  if (headroom < 0) headroom = 0;
  return MIN_FEE * (1 + innerCount + headroom);
}

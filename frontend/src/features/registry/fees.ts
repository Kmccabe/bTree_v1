export const BASE_FEE_MICRO = 1_000;
export const BOX_FEE_MICRO = 2_000;

export const feeFor = (boxCount: number): number => BASE_FEE_MICRO + BOX_FEE_MICRO * boxCount;

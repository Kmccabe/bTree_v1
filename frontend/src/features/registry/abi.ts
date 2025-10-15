// src/features/registry/abi.ts
// Works with algosdk v2 (no 'algosdk/abi' submodule)

import { ABIMethod, ABIType, type ABIValue } from "algosdk";

// Signatures MUST include the return type (`void`)
export const sig_register_intent = "register_intent(byte[],byte[],byte[])void";
export const sig_admin_set_reward = "admin_set_reward(uint64)void";
export const sig_admin_open = "admin_open()void";
export const sig_admin_close = "admin_close()void";
export const sig_admin_add_capacity = "admin_add_capacity(uint64)void";
export const sig_link_begin = "link_payment_begin(byte[])void";
export const sig_link_finish = "link_finish(address)void";

// Method objects (use with ATC addMethodCall)
export const mRegisterIntent = ABIMethod.fromSignature("register_intent(byte[],byte[],byte[])void");
export const mAdminSetReward = ABIMethod.fromSignature(sig_admin_set_reward);
export const mAdminOpen = ABIMethod.fromSignature(sig_admin_open);
export const mAdminClose = ABIMethod.fromSignature(sig_admin_close);
export const mAdminAddCapacity = ABIMethod.fromSignature(sig_admin_add_capacity);
export const mLinkBegin      = ABIMethod.fromSignature(sig_link_begin);
export const mLinkFinish     = ABIMethod.fromSignature(sig_link_finish);

// Optional lookup by name
const METHOD_MAP: Record<string, ABIMethod> = {
  register_intent: mRegisterIntent,
  admin_set_reward: mAdminSetReward,
  admin_open: mAdminOpen,
  admin_close: mAdminClose,
  admin_add_capacity: mAdminAddCapacity,
  link_payment_begin: mLinkBegin,
  link_finish: mLinkFinish,
};

export const methodLookup = (name: string): ABIMethod => {
  const m = METHOD_MAP[name];
  if (!m) throw new Error(`Unknown registry method: ${name}`);
  return m;
};

const te = new TextEncoder();

/**
 * Build app_args for a method using plain JS values.
 * - byte[]: pass Uint8Array or a string (auto UTF-8 encoded)
 * - address: pass base32 string
 * - uint64: pass number or bigint
 */
export function abiAppArgs(methodName: string, values: unknown[]): Uint8Array[] {
  const method = methodLookup(methodName);
  if (values.length !== method.args.length) {
    throw new Error(
      `Argument count mismatch for ${methodName}: expected ${method.args.length}, got ${values.length}`
    );
  }

  const appArgs: Uint8Array[] = [method.getSelector()];

  method.args.forEach((arg, i) => {
    const abiType = arg.type as ABIType; // ABIMethod already gives ABIType here
    const raw = values[i];

    // Convenience: allow string for byte[]
    let val: ABIValue = raw as ABIValue;
    if (abiType.toString() === "byte[]" && typeof raw === "string") {
      val = te.encode(raw) as unknown as ABIValue;
    }

    appArgs.push(abiType.encode(val));
  });

  return appArgs;
}

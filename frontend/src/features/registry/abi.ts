import { Method, ABIType } from "algosdk/abi";

export const sig_register_intent = "register_intent(byte[],byte[],byte[])";
export const sig_admin_set_reward = "admin_set_reward(uint64)";
export const sig_link_begin = "link_payment_begin(byte[])";
export const sig_link_finish = "link_finish(address)";

export const mRegisterIntent = Method.fromSignature(sig_register_intent);
export const mAdminSetReward = Method.fromSignature(sig_admin_set_reward);
export const mLinkBegin = Method.fromSignature(sig_link_begin);
export const mLinkFinish = Method.fromSignature(sig_link_finish);

const METHOD_MAP: Record<string, Method> = {
  register_intent: mRegisterIntent,
  admin_set_reward: mAdminSetReward,
  link_payment_begin: mLinkBegin,
  link_finish: mLinkFinish,
};

const encoder = new TextEncoder();

export const methodLookup = (name: string): Method => {
  const method = METHOD_MAP[name];
  if (!method) {
    throw new Error(`Unknown registry method: ${name}`);
  }
  return method;
};

export const abiAppArgs = (methodName: string, values: any[]): Uint8Array[] => {
  const method = methodLookup(methodName);
  if (values.length !== method.args.length) {
    throw new Error(`Argument count mismatch for ${methodName}`);
  }
  const encoded: Uint8Array[] = [method.getSelector()];
  method.args.forEach((arg, idx) => {
    const type = arg.type;
    let abiType: ABIType;
    if (typeof type === "string") {
      abiType = ABIType.fromString(type);
    } else {
      abiType = type;
    }
    const value = values[idx];
    // Accept string shortcuts for byte[] arguments
    let finalValue = value;
    if (typeof value === "string" && arg.type === "byte[]") {
      finalValue = encoder.encode(value);
    }
    encoded.push(abiType.encode(finalValue));
  });
  return encoded;
};

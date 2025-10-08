import { ABIType, Method } from "algosdk";

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

const textEncoder = new TextEncoder();

export const methodLookup = (name: string): Method => {
  const method = METHOD_MAP[name];
  if (!method) {
    throw new Error(`Unknown registry method: ${name}`);
  }
  return method;
};

export const abiAppArgs = (methodName: string, values: unknown[]): Uint8Array[] => {
  const method = methodLookup(methodName);
  if (values.length !== method.args.length) {
    throw new Error(`Argument count mismatch for ${methodName}`);
  }
  const encoded: Uint8Array[] = [method.getSelector()];
  method.args.forEach((arg, idx) => {
    const argType = typeof arg.type === "string" ? ABIType.fromString(arg.type) : arg.type;
    const rawValue = values[idx];
    const value = typeof rawValue === "string" && arg.type === "byte[]"
      ? textEncoder.encode(rawValue)
      : rawValue;
    encoded.push(argType.encode(value as unknown));
  });
  return encoded;
};

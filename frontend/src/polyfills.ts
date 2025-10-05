// frontend/src/polyfills.ts
// Makes Node-ish globals available in the browser bundle when needed.
// Vite won't polyfill these by default.

import { Buffer } from "buffer";
import process from "process";

// Attach only if missing to avoid double-defining in different environments.
if (!(globalThis as any).Buffer) (globalThis as any).Buffer = Buffer;
if (!(globalThis as any).process) (globalThis as any).process = process;
if (!(globalThis as any).global) (globalThis as any).global = globalThis;

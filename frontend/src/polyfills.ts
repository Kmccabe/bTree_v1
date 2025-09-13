// src/polyfills.ts
import { Buffer } from "buffer";
import process from "process";

if (typeof (window as any).global === "undefined") {
  (window as any).global = window; // polyfill 'global'
}
if (typeof (window as any).Buffer === "undefined") {
  (window as any).Buffer = Buffer; // polyfill 'Buffer'
}
if (typeof (window as any).process === "undefined") {
  (window as any).process = process; // polyfill 'process'
}

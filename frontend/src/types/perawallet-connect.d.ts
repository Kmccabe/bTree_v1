// frontend/src/types/perawallet-connect.d.ts
declare module '@perawallet/connect' {
  export class PeraWalletConnect {
    constructor(opts?: any);
    connect(): Promise<string[]>;
    reconnectSession(): Promise<string[]>;
    disconnect(): Promise<void>;
    connector?: { on?: (event: string, cb: (...args: any[]) => void) => void };
    on?: (event: string, cb: (...args: any[]) => void) => void;
  }
}

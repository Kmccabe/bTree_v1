/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_COMPILE_STREAM_MODE?: "chunk" | "sse";
  readonly VITE_DEV_MOCK_COMPILE?: string;
  readonly VITE_DEV_MOCK_LINES?: string;
  readonly VITE_DEV_MOCK_DELAY_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

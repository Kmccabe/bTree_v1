/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_COMPILE_STREAM_MODE?: "chunk" | "sse";
  readonly VITE_DEV_MOCK_COMPILE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

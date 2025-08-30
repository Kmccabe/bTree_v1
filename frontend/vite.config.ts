import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite config with React plugin and a dev proxy for Vercel functions.
// Run `vercel dev` in parallel so `/api` is available at :3000.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});


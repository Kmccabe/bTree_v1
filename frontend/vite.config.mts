import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'        // ✅ added

export default defineConfig({
  plugins: [react()],
  resolve: {                       // ✅ added
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  css: {
    // Force Vite to use an empty PostCSS config (so it DOESN'T try to load any files)
    postcss: {},
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})



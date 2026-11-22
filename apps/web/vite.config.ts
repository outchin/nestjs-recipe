import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// /api/* is proxied to the Nest server, so the UI never hard-codes the API URL.
// --mode labs (npm run build:labs): the build served at zawwaisoe.dev/labs (see src/site.ts, vercel.json).
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  ...(mode === 'labs' && {
    base: '/labs/',
    // files land under /labs/ so the portfolio can forward /labs/* here unchanged
    build: { outDir: 'dist-labs/labs', emptyOutDir: true },
  }),
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3000' },
  },
}));

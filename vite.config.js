import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173, // optional: change if you want a different local dev port
  },
  build: {
    outDir: 'dist',
    sourcemap: true, // helpful for debugging in production
  },
});

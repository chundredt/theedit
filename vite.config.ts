import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build:single` produces one self-contained HTML file (dist-single/index.html)
// that can be opened directly or hosted anywhere.
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'single' ? [viteSingleFile()] : [])],
  build: mode === 'single' ? { outDir: 'dist-single' } : undefined,
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
}));

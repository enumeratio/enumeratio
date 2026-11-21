import { defineConfig } from 'vite-plus';
import { prerenderPlugin } from './prerender.ts';

export default defineConfig({
  build: { outDir: 'dist', emptyOutDir: true },
  plugins: [prerenderPlugin()],
});

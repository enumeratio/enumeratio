import { notatioData } from '@enumeratio/kernel/data-plugin';
import { defineConfig } from 'vite-plus';
import { prerenderPlugin } from './prerender.ts';

export default defineConfig({
  build: { outDir: 'dist', emptyOutDir: true },
  // The kernel imports each library as its own chunk, which only a module worker can do.
  worker: { format: 'es' },
  plugins: [notatioData(), prerenderPlugin()],
});

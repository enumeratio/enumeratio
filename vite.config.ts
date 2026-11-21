import { notatioData } from '@enumeratio/kernel/data-plugin';
import { defineConfig } from 'vite-plus';

export default defineConfig({
  plugins: [notatioData()],
  test: {
    include: ['packages/*/test/**/*.test.ts', 'site/test/**/*.test.ts'],
    environment: 'node',
  },
  fmt: {
    singleQuote: true,
    // The site map is a specification written by hand; the route file is a table.
    ignorePatterns: ['docs/**', 'routes/**', 'pnpm-lock.yaml', 'vendor/**'],
  },
  lint: {
    options: { typeAware: false },
  },
});

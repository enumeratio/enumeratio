import { defineConfig } from 'vite-plus';

export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.test.ts', 'site/test/**/*.test.ts'],
    environment: 'node',
  },
  fmt: {
    singleQuote: true,
    // The site map is a specification written by hand; the route file is a table.
    ignorePatterns: ['docs/**', 'routes/**', 'pnpm-lock.yaml'],
  },
  lint: {
    options: { typeAware: false },
  },
});

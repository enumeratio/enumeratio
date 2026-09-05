import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // .scratch holds the cloned pglite build tree (see packages/pglite-enumeratio/scripts/build-wasm.ts),
    // which carries its own ~80 test files; .claude/worktrees holds sibling worktrees (task branches at
    // other commits) with their own copies of these suites — keep both out of THIS checkout's run.
    exclude: [...configDefaults.exclude, '.scratch/**', '.claude/**'],
  },
})

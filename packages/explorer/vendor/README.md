# Vendored PrimeVue overlay (temporary)

`primevue-rowgroup/{datatable,virtualscroller}/index.mjs` are the two self-contained built modules from
PrimeVue **4.5.5 + PR [#8579](https://github.com/primefaces/primevue/pull/8579)** (fork
`oliversluke/primevue:fix-rowgroup-spacer`), which fixes `rowGroupMode="subheader"` spacer drift under
`virtualScroller` and adds the `getItemSize` callback — for the grade-grouped spanning view (a subheader
per grade with per-grade stats).

We keep the **registry** `primevue@^4.5.5` (its wildcard `exports` are correct — a full-package fork
tarball broke them by pointing at `./src/…`), and `scripts/patch-primevue.mjs` (a `postinstall` hook)
overlays just these two modules over `node_modules/primevue`. Idempotent; survives `npm install`.

**When PR #8579 ships in a release:** delete `scripts/patch-primevue.mjs`, remove the `postinstall` hook
from `package.json`, delete `vendor/primevue-rowgroup`, bump `primevue`, and `npm install`.

To rebuild the modules from the fork:
```
git clone --depth 1 -b fix-rowgroup-spacer https://github.com/oliversluke/primevue
cd primevue && pnpm install && pnpm --filter @primevue/metadata build && pnpm --filter @primevue/auto-import-resolver build && pnpm --filter @primevue/core build && pnpm --filter primevue build
# copy packages/primevue/dist/{datatable,virtualscroller}/index.mjs into vendor/primevue-rowgroup/
```

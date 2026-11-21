# enumeratio

enumeratio is a home for mathematical objects, each at an address meant to last, at [enumeratio.dev](https://enumeratio.dev).

The site map ([docs/site-map.md](docs/site-map.md)) leads and the code follows it. The structure of an address is settled enough to build on; its characters (separators, parameter words) are provisional and live in one table, so that changing one is a one-line edit.

## Layout

- `docs/site-map.md`: the specification.
- `packages/address`: parse and format addresses (§2, §3 and §5 of the map); the table of marks. Pure TypeScript, no dependencies.
- `routes/`: the route file (§6): every route, its status and what is behind it. To propose or reserve a route, add a row by pull request.
- `packages/routes`: the one module that reads the route file, and the expressions behind a row.
- `packages/codecs`: how an element is written in an address: a reader and a writer for each shape of value, built on the table of marks.
- `packages/kernel`: notatio's libraries as one catalogue, for the page's worker and for the tests in Node; and what the pages know of notatio's records at build time (the statistics and maps of each carrier).
- `site/`: the static site. Pages are computed in the page, by notatio's kernel in a worker.
- `notatio.pin`, `tools/notatio/`: notatio as a dependency without a registry.

## notatio

Everything computed comes from [enumeratio/notatio](https://github.com/enumeratio/notatio), at the commit in `notatio.pin`. Nothing is installed from a registry: a script builds a checkout at that commit with notatio's own build, packs its packages with notatio's own tarball check, and unpacks them under `vendor/notatio` (not committed), where the workspace's overrides point.

```
git clone https://github.com/enumeratio/notatio && git -C notatio checkout "$(cat notatio.pin)"
NOTATIO_DIR=notatio node tools/notatio/pack.ts   # build, pack, unpack (needs notatio's Node version)
```

To move the pin, change `notatio.pin`, run the script with `--write-overrides` (it rewrites the overrides in `pnpm-workspace.yaml` when the set of packages changed), then `pnpm install` and the tests: one of them checks every expression in the route file against the pinned notatio.

## Commands

```
node tools/notatio/unpack.ts   # after pack.ts, or with the tarballs restored from a cache
pnpm install --frozen-lockfile
pnpm exec vp check          # format, lint, types
pnpm exec vp test run       # DEEP_TESTS=1 for the full cases
pnpm --filter @enumeratio/site build
node site/check-built-worker.ts   # the built worker answers, without a browser
```

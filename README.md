# enumeratio

enumeratio is a home for mathematical objects, each at an address meant to last, at [enumeratio.dev](https://enumeratio.dev).

The site map ([docs/site-map.md](docs/site-map.md)) leads and the code follows it. The structure of an address is settled enough to build on; its characters (separators, parameter words) are provisional and live in one table, so that changing one is a one-line edit.

## Layout

- `docs/site-map.md`: the specification.
- `packages/address`: parse and format addresses (§2, §3 and §5 of the map); the table of marks. Pure TypeScript, no dependencies.
- `routes/`: the route file (§6): every route, its status and what is behind it. To propose or reserve a route, add a row by pull request.
- `packages/routes`: the one module that reads the route file.
- `site/`: the static site.

## Commands

```
pnpm install --frozen-lockfile
pnpm exec vp check          # format, lint, types
pnpm exec vp test run       # DEEP_TESTS=1 for the full cases
pnpm --filter @enumeratio/site build
```

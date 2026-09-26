# @enumeratio/utils

Home of the repo-wide guard tests. Nothing imports it yet: `src/` still holds only the
starter's placeholder export, kept so `vp pack` has an entry.

- `tests/no-snapshots.test.ts`: no test under `packages/` calls `toMatchSnapshot` or
  `toMatchInlineSnapshot`. Tests assert against committed golden JSON instead, regenerated
  behind an `UPDATE_*` flag; snapshot matchers fail when the test task runs through `vp run`.
- `tests/no-yaml-imports.test.ts`: only `@enumeratio/entry` imports `yaml`; everything else
  reads and writes through its strict-schema `parseYaml` / `stringifyYaml`.

Each guard walks every package from the workspace root, so it runs with this package's tests
(`vp test`) and in CI's `pnpm -r run test`.

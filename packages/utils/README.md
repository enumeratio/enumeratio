# @enumeratio/utils

Home of the repo-wide guard tests, and a leaf of small Node helpers the tooling packages (and
the golden-collecting scripts of libraries) share without reaching into each other's source.

- `./bounded` (`src/bounded.ts`): `runBounded`/`runKernel`/`KernelKilled`/`memoryCapMb`/
  `groupRssMb`: run an external kernel under a resident-memory ceiling, since macOS has no
  per-process cap.

- `tests/no-snapshots.test.ts`: no test under `packages/` calls `toMatchSnapshot` or
  `toMatchInlineSnapshot`. Tests assert against committed golden JSON instead, regenerated
  behind an `UPDATE_*` flag; snapshot matchers fail when the test task runs through `vp run`.
- `tests/no-yaml-imports.test.ts`: only `@enumeratio/entry` imports `yaml`; everything else
  reads and writes through its strict-schema `parseYaml` / `stringifyYaml`.

Each guard walks every package from the workspace root, so it runs with this package's tests
(`vp test`) and in CI's `pnpm -r run test`.

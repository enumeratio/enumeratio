// The statistics compiled at build from their Epsil (each area's statistics.compiled.generated.js):
//   - compiled answers equal the interpreter's, exactly, over small subjects of every carrier;
//   - under DEEP_TESTS, compiled answers equal the hand-written kernels' over subjects spanning
//     orders of magnitude in size, and the timings are reported — the gap is what the compiler
//     has left to learn.

import { appendFileSync } from "node:fs";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { declareCombinatorics } from "../src/index.ts";
import { operationOf } from "@enumeratio/structures";
import { expect, test } from "vite-plus/test";
import { ALL_STATISTICS } from "../src/statistics/all.ts";
import { compiledStatistic } from "../src/statistics/compiled.ts";
import { interpretDefinition } from "../src/statistics/declare.ts";
import { signatureOf } from "../src/statistics/types.ts";
import { COMPILED as PERMUTATIONS_COMPILED } from "../permutations/src/statistics.compiled.generated.js";
import { COMPILED as PARTITIONS_COMPILED } from "../partitions/src/statistics.compiled.generated.js";
import { COMPILED as LATTICE_PATHS_COMPILED } from "../lattice-paths/src/statistics.compiled.generated.js";
import { COMPILED as SET_PARTITIONS_COMPILED } from "../set-partitions/src/statistics.compiled.generated.js";

const DEEP = process.env.DEEP_TESTS === "1";
const ce = new ComputeEngine();
const list = (values: readonly unknown[]): unknown => ["List", ...values];

/** Each area's own `scripts/compile-definitions.ts` (run by `build`) writes its own table. */
const AREAS = [
  { name: "permutations", compiled: PERMUTATIONS_COMPILED },
  { name: "partitions", compiled: PARTITIONS_COMPILED },
  { name: "lattice-paths", compiled: LATTICE_PATHS_COMPILED },
  { name: "set-partitions", compiled: SET_PARTITIONS_COMPILED },
] as const;

for (const area of AREAS) {
  test(`${area.name}: the build compiled definitions`, () => {
    expect(Object.keys(area.compiled).length).toBeGreaterThan(0);
  });
}

/** Every signature ANY area's compiled table has an entry for. */
const COMPILED_SIGNATURES = new Set(
  [PERMUTATIONS_COMPILED, PARTITIONS_COMPILED, LATTICE_PATHS_COMPILED, SET_PARTITIONS_COMPILED].flatMap((table) =>
    Object.keys(table),
  ),
);

function permutations(n: number): number[][] {
  if (n === 0) return [[]];
  return permutations(n - 1).flatMap((rest) =>
    Array.from({ length: n }, (_, i) => [...rest.slice(0, i), n, ...rest.slice(i)]),
  );
}
function partitions(n: number, max = n): number[][] {
  if (n === 0) return [[]];
  const out: number[][] = [];
  for (let first = Math.min(n, max); first >= 1; first--)
    for (const rest of partitions(n - first, first)) out.push([first, ...rest]);
  return out;
}
function dyckPaths(n: number): number[][] {
  const out: number[][] = [];
  const walk = (word: number[], ups: number, downs: number): void => {
    if (ups === n && downs === n) out.push(word);
    if (ups < n) walk([...word, 1], ups + 1, downs);
    if (downs < ups) walk([...word, 0], ups, downs + 1);
  };
  walk([], 0, 0);
  return out;
}
function setPartitions(n: number): number[][][] {
  if (n === 0) return [[]];
  return setPartitions(n - 1).flatMap((blocks) => [
    ...blocks.map((_, i) => blocks.map((block, j) => (i === j ? [...block, n] : block))),
    [...blocks, [n]],
  ]);
}

/** Small subjects of each carrier, as MathJSON contents. */
const SUBJECTS: Record<string, unknown[]> = {
  // Up to 4: the cubic statistics are slow to interpret, and the exhaustive sweeps elsewhere
  // already hold every statistic to an independent reading up to 6.
  Permutation: [0, 1, 2, 3, 4].flatMap(permutations).map(list),
  IntegerPartition: [0, 1, 2, 3, 4, 5, 6, 7].flatMap((n) => partitions(n)).map(list),
  DyckPath: [0, 1, 2, 3, 4].flatMap(dyckPaths).map(list),
  SetPartition: [0, 1, 2, 3, 4].flatMap(setPartitions).map((blocks) => list(blocks.map(list))),
};

for (const definition of ALL_STATISTICS.filter((d) => COMPILED_SIGNATURES.has(signatureOf(d)))) {
  test(`${signatureOf(definition)}: compiled agrees with interpreted`, () => {
    const run = compiledStatistic(ce, definition);
    expect(run).toBeDefined();
    for (const contents of SUBJECTS[definition.on] ?? []) {
      const interpreted = interpretDefinition(ce, definition, ce.box(contents as never)).json;
      expect(run!(contents), JSON.stringify(contents)).toEqual(interpreted);
    }
  });
}

// Hand-written kernels against the compiled definitions, over subjects up to n = 1000. A size
// that already takes long is the last one tried: the point is the ratio, not the wait.
test.runIf(DEEP)(
  "compiled statistics match the hand-written kernels, and how fast",
  () => {
    const engine = new ComputeEngine();
    declareCombinatorics(engine);
    const rows: string[] = [
      "| statistic | n | compiled (ms) | kernel (ms) | ratio |",
      "| --- | --- | --- | --- | --- |",
    ];
    const random = (n: number, seed: number): number[] => {
      const p = Array.from({ length: n }, (_, i) => i + 1);
      let s = seed;
      for (let i = n - 1; i > 0; i--) {
        s = (s * 1103515245 + 12345) % 2147483648;
        const j = s % (i + 1);
        [p[i], p[j]] = [p[j]!, p[i]!];
      }
      return p;
    };
    const time = (f: () => unknown): number => {
      const once = performance.now();
      f();
      const single = performance.now() - once;
      const reps = Math.max(1, Math.min(20, Math.floor(50 / Math.max(single, 0.001))));
      const start = performance.now();
      for (let k = 0; k < reps; k++) f();
      return (performance.now() - start) / reps;
    };
    for (const definition of ALL_STATISTICS.filter((d) => d.on === "Permutation")) {
      const kernel = operationOf(engine, "CombinatorialStat", "Permutation", definition.head)?.kernel;
      const run = compiledStatistic(ce, definition);
      if (kernel === undefined || run === undefined) continue;
      for (const n of [10, 100, 1000]) {
        const subject = list(random(n, n));
        const boxed = engine.box(["Permutation", subject] as never);
        expect(run(subject), `${definition.head}, n = ${n}`).toEqual(kernel(boxed)?.json);
        const compiledMs = time(() => run(subject));
        const kernelMs = time(() => kernel(boxed));
        rows.push(
          `| ${definition.head} | ${n} | ${compiledMs.toFixed(3)} | ${kernelMs.toFixed(3)} | ${(compiledMs / kernelMs).toFixed(1)}× |`,
        );
        // The next size is ten times larger; past a few milliseconds that is a wait, not a finding.
        if (compiledMs > 5) break;
      }
    }
    const table = `### Compiled statistics against hand-written kernels\n\n${rows.join("\n")}\n`;
    if (process.env.GITHUB_STEP_SUMMARY !== undefined) appendFileSync(process.env.GITHUB_STEP_SUMMARY, table);
    else process.stderr.write(table);
  },
  600_000,
);

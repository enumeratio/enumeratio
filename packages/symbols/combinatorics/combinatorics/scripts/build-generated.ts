// Everything the package generates from its own sources and the records, none of it committed
// (see .gitignore). Run by `build`; the stubs come first because the sources the later scripts
// load import the compiled caches.
//
// The compile steps take minutes between them and read only this package, the statistics
// records and the dists of what it depends on, so each is skipped while its inputs hash the
// same as at its last run (../../../manifest/scripts/stamp.ts) and the independent ones run
// in parallel. `BUILD_JOBS` caps how many.

import { execFileSync, spawn } from "node:child_process";
import { availableParallelism } from "node:os";
import { fileURLToPath } from "node:url";

// Imported by URL: a file outside the package in the program makes `vp pack` write its
// declarations beside it.
const { cached } = (await import(new URL("../../../../manifest/scripts/stamp.ts", import.meta.url).href)) as {
  cached: (
    name: string,
    inputs: { dir: string; roots: string[]; skip: (path: string) => boolean },
    outputs: string[],
    run: () => Promise<void> | void,
  ) => Promise<boolean>;
};

const dir = fileURLToPath(new URL("..", import.meta.url));
const at = (path: string): string => fileURLToPath(new URL(`../${path}`, import.meta.url));

const quick = ["scripts/collect-statistics-naming.ts", "scripts/stub-generated.ts", "scripts/generate-map-laws.ts"];

/** Each compile step and the one file it writes. */
const compiles: ReadonlyArray<readonly [script: string, output: string]> = [
  ["scripts/compile-maps.ts", "src/compiled-maps.generated.js"],
  ["scripts/compile-families.ts", "collections/src/families/compiled-families.generated.js"],
  ["lattice-paths/scripts/compile-definitions.ts", "lattice-paths/src/statistics.compiled.generated.js"],
  ["partitions/scripts/compile-definitions.ts", "partitions/src/statistics.compiled.generated.js"],
  ["permutations/scripts/compile-definitions.ts", "permutations/src/statistics.compiled.generated.js"],
  ["set-partitions/scripts/compile-definitions.ts", "set-partitions/src/statistics.compiled.generated.js"],
];

const jobs = Number(process.env.BUILD_JOBS) || Math.max(1, Math.min(3, Math.floor(availableParallelism() / 3)));

const run = (script: string): Promise<void> =>
  new Promise((resolve, reject) => {
    spawn("node", [script], { cwd: dir, stdio: "inherit" }).on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${script} exited with ${code}`)),
    );
  });

// What the steps write is not what they read; the records they generate from are.
const inputs = {
  dir,
  roots: [dir, at("../statistics/reference")],
  skip: (path: string) => /(naming-data\.ts|\.generated\.(js|ts))$|\/(tests|docs)(\/|$)/.test(path),
};

// The compile steps import the stubs, so they count as outputs here.
await cached(
  "quick",
  inputs,
  [at("src/statistics/naming-data.ts"), at("src/maps-laws.generated.ts"), ...compiles.map(([, output]) => at(output))],
  () => {
    for (const script of quick) execFileSync("node", [script], { cwd: dir, stdio: "inherit" });
  },
);

const queue = [...compiles];
const failures: unknown[] = [];
await Promise.all(
  Array.from({ length: jobs }, async () => {
    for (let step = queue.shift(); step !== undefined; step = queue.shift()) {
      const [script, output] = step;
      try {
        const ran = await cached(script, inputs, [at(output)], () => run(script));
        if (!ran) console.log(`${script}: up to date`);
      } catch (error) {
        failures.push(error);
      }
    }
  }),
);
if (failures.length > 0) throw failures[0];

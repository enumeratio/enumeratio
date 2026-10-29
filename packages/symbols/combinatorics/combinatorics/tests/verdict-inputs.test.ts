// The compile steps' verdict memo is keyed on the dists of CHECKED_ON (and what they import)
// and no others. This holds that claim to the checks' real module graph: a check that starts
// loading another workspace package's dist fails here until CHECKED_ON names it, rather than
// reusing a verdict the new dependency could have changed.

import { spawnSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { expect, test } from "vite-plus/test";
import { CHECKED_ON } from "../scripts/verdicts.ts";

const { workspaceDists } = (await import(new URL("../../../../manifest/scripts/stamp.ts", import.meta.url).href)) as {
  workspaceDists: (dir: string, omit?: readonly string[], from?: readonly string[]) => string[];
};

const here = (path: string): string => fileURLToPath(new URL(`../${path}`, import.meta.url));

/** Everything the six compile steps import, as their scripts do. */
const MODULES = [
  "scripts/compile-maps.ts",
  "scripts/family-checks.ts",
  "scripts/samples.ts",
  "src/statistics/generate-compiled.ts",
  "lattice-paths/src/statistics.ts",
  "partitions/src/statistics.ts",
  "permutations/src/statistics.ts",
  "set-partitions/src/statistics.ts",
];

test("the checks load only dists their verdicts are keyed on", () => {
  const driver = `
    import { registerHooks } from "node:module";
    const seen = new Set();
    registerHooks({ load: (url, context, next) => (seen.add(url), next(url, context)) });
    for (const url of ${JSON.stringify(MODULES.map((path) => pathToFileURL(here(path)).href))}) await import(url);
    console.log(JSON.stringify([...seen]));
  `;
  const run = spawnSync(process.execPath, ["--input-type=module", "-e", driver], { encoding: "utf8" });
  expect(run.status, run.stderr).toBe(0);
  const loaded = (JSON.parse(run.stdout) as string[])
    // Installed packages (compute-engine, keyed by version) are not workspace dists.
    .filter((url) => url.startsWith("file:") && url.includes("/dist/") && !url.includes("/node_modules/"))
    .map((url) => realpathSync(fileURLToPath(url)));

  // Manifest's dist is keyed by its source instead (see scripts/verdicts.ts).
  const keyed = workspaceDists(here(""), [], CHECKED_ON)
    .filter((dist) => existsSync(dist))
    .map((dist) => realpathSync(dist));
  const outside = loaded.filter((file) => !keyed.some((dist) => file.startsWith(`${dist}/`)));
  expect(outside).toEqual([]);
  expect(loaded.length).toBeGreaterThan(0);
});

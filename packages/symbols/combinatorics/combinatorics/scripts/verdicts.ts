// The memo of the compile steps' interpreter cross-checks (their one slow part), shared by
// the generators so an edit to one definition re-checks only that one. Answers hold while the
// checking code (these scripts, the interpreters in src/maps.ts and the family kernels) and the
// dists it runs on are unchanged.

import { fileURLToPath } from "node:url";
import type { Verdicts } from "../src/statistics/generate-compiled.ts";

// Imported by URL: a file outside the package in the program makes `vp pack` write its
// declarations beside it.
const { verdictCache } = (await import(new URL("../../../../manifest/scripts/stamp.ts", import.meta.url).href)) as {
  verdictCache: (step: string, inputs: { dir: string; roots: string[] }) => Verdicts & { save(): void };
};

const at = (path: string): string => fileURLToPath(new URL(`../${path}`, import.meta.url));

export const verdictsFor = (step: string) =>
  verdictCache(step, {
    dir: at(""),
    roots: [
      at("scripts"),
      at("lattice-paths/scripts"),
      at("partitions/scripts"),
      at("permutations/scripts"),
      at("set-partitions/scripts"),
      at("src/statistics/generate-compiled.ts"),
      at("collections/src/families/epsil.ts"),
    ],
  });

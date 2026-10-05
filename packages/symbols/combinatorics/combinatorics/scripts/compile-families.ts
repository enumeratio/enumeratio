// Compile every Epsil family's definitions (count, unrank, rank, valid) to JavaScript ahead of
// time, with compute-engine's own compiler, into
// collections/src/families/compiled-families.generated.js. Each entry carries the hash of the
// definitions it came from: at run time it is used only while the hash matches, so an edited
// family is compiled on first use until this is rerun. Operations the compiler can't take yet
// are left out, and interpreted; so are operations whose compiled code disagrees with the
// interpreter on a sample, which are listed so they are never compiled on first use either.
//
//   vp node packages/symbols/combinatorics/combinatorics/scripts/compile-families.ts

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Engine } from "@enumeratio/engine";
import { bareEngine } from "@enumeratio/engine/testing";
import { compileTyped } from "@enumeratio/engine/compiled";
import { evaluateEpsil } from "@enumeratio/structures";
import {
  elementJson,
  elementOf,
  type EpsilFamily,
  evaluateTables,
  familyHash,
  integerOf,
  isEpsilFamily,
  OPERATIONS,
  type Operation,
  operationsOf,
  operationTypes,
} from "../collections/src/families/epsil.ts";
import { allFamilies } from "../collections/src/families/index.ts";
import { noVerdicts, type Verdicts } from "../src/statistics/generate-compiled.ts";
import { verdictsFor } from "./verdicts.ts";

interface Entry {
  readonly head: string;
  readonly hash: string;
  readonly code: Partial<Record<Operation, string>>;
  readonly interpreted: readonly Operation[];
}

type Run = (vars: Record<string, unknown>) => unknown;

/** Params each in 0..4 and summing to at most 6: the small fibers compiled code is checked on. */
function sampleParams(count: number): number[][] {
  if (count === 0) return [[]];
  return sampleParams(count - 1).flatMap((p) =>
    [0, 1, 2, 3, 4].filter((x) => p.reduce((a, b) => a + b, x) <= 6).map((x) => [...p, x]),
  );
}

/** A member one entry away from itself, which the family may or may not contain. */
const nearMiss = (element: unknown): unknown =>
  Array.isArray(element)
    ? element.length > 0
      ? [nearMiss(element[0]), ...element.slice(1)]
      : [1] // the empty element's neighbour: one entry
    : Number(element) + 1;

/**
 * Whether each operation's compiled code gives the interpreter's answers over the sample: the
 * count, the element at the first, middle and last ranks, their ranks, and membership of each
 * and of a near miss, and the table the others read, where there is one. Compiled code is
 * otherwise trusted below 2^53, so a miscompile would answer wrong silently.
 */
export function disagreements(ce: Engine, family: EpsilFamily, runs: Partial<Record<Operation, Run>>): Operation[] {
  const wrong = new Set<Operation>();
  const attempt = (run: Run, vars: Record<string, unknown>): unknown => {
    try {
      return run(vars);
    } catch {
      return undefined;
    }
  };
  for (const p of sampleParams(family.paramCount)) {
    const params = Object.fromEntries(family.params.map((name, i) => [name, p[i]]));
    // The table the other definitions read: the interpreter's to the interpreter, as plain numbers to compiled code.
    const table = family.epsil.tables === undefined ? undefined : evaluateTables(ce, family.epsil.tables, params);
    const entries = Array.isArray(table) ? table.slice(1).map((entry) => Number(integerOf(entry))) : undefined;
    if (table !== undefined && runs.tables !== undefined) {
      if (JSON.stringify(attempt(runs.tables, params)) !== JSON.stringify(entries)) wrong.add("tables");
    }
    const bind = table === undefined ? params : { ...params, _tables: table };
    const compiledBind = entries === undefined ? params : { ...params, _tables: entries };
    const total = integerOf(evaluateEpsil(ce, family.epsil.count, bind));
    if (total === undefined || total > BigInt(Number.MAX_SAFE_INTEGER)) continue;
    if (runs.count !== undefined && attempt(runs.count, compiledBind) !== Number(total)) wrong.add("count");
    if (total === 0n) continue;
    for (const r of new Set([0n, total / 2n, total - 1n])) {
      const element = elementOf(evaluateEpsil(ce, family.epsil.unrank, { ...bind, _r: Number(r) }));
      if (
        runs.unrank !== undefined &&
        JSON.stringify(attempt(runs.unrank, { ...compiledBind, _r: Number(r) })) !== JSON.stringify(element)
      )
        wrong.add("unrank");
      if (runs.rank !== undefined && attempt(runs.rank, { ...compiledBind, _x: element }) !== Number(r))
        wrong.add("rank");
      if (runs.valid !== undefined)
        for (const candidate of [element, nearMiss(element)]) {
          const expected = evaluateEpsil(ce, family.epsil.valid, { ...bind, _x: elementJson(candidate) }) === "True";
          if (attempt(runs.valid, { ...compiledBind, _x: candidate }) !== expected) wrong.add("valid");
        }
    }
  }
  return OPERATIONS.filter((operation) => wrong.has(operation));
}

/** Each Epsil family's head, hash and the generated code of the operations that compile. */
export function compiledFamilies(verdicts: Verdicts = noVerdicts): Entry[] {
  const ce = bareEngine();
  const out: Entry[] = [];
  for (const family of allFamilies.filter(isEpsilFamily) as EpsilFamily[]) {
    const code: Partial<Record<Operation, string>> = {};
    const runs: Partial<Record<Operation, Run>> = {};
    for (const operation of operationsOf(family)) {
      const types = operationTypes(family, operation);
      const compiled = types === undefined ? undefined : compileTyped(ce, family.epsil[operation], types);
      if (compiled === undefined) continue;
      code[operation] = compiled.code;
      runs[operation] = compiled.run;
    }
    const interpreted = verdicts.remember({ params: family.params, epsil: family.epsil, code }, () =>
      disagreements(ce, family, runs),
    );
    for (const operation of interpreted) delete code[operation];
    out.push({ head: family.head, hash: familyHash(family), code, interpreted });
  }
  return out.toSorted((a, b) => (a.head < b.head ? -1 : a.head > b.head ? 1 : 0));
}

function render(entries: readonly Entry[]): string {
  const body = entries
    .map((e) =>
      [
        `  ${e.head}: {`,
        `    hash: ${JSON.stringify(e.hash)},`,
        // Code keys before the `interpreted` marker: tests/compiled-families.test.ts's drift
        // check builds its own key order the same way (code first, the marker last).
        ...OPERATIONS.flatMap((operation) =>
          e.code[operation] === undefined ? [] : [`    ${operation}: (_SYS, _) => ${e.code[operation]},`],
        ),
        ...(e.interpreted.length === 0 ? [] : [`    interpreted: ${JSON.stringify(e.interpreted)},`]),
        "  },",
      ].join("\n"),
    )
    .join("\n");
  return `// GENERATED by scripts/compile-families.ts from the families' Epsil definitions, by
// compute-engine's JavaScript compiler. Do not edit: rerun the script. Each entry is used only
// while \`hash\` matches its definitions; see ./epsil.ts.
// A definition that ignores one of its inputs compiles to code that never reads it.
// A \`Join\` of single-element \`List\`s (a fixed head or tail spliced onto a filtered range, e.g.
// IntegerCompositions' boundaries) compiles to a single-element array spread.
/* eslint-disable no-unused-vars, unicorn/no-useless-spread */

export const COMPILED_FAMILIES = {
${body}
};
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const verdicts = verdictsFor("compile-families");
  const entries = compiledFamilies(verdicts);
  const target = fileURLToPath(new URL("../collections/src/families/compiled-families.generated.js", import.meta.url));
  writeFileSync(target, render(entries));
  verdicts.save();
  // Laid out as `vp fmt` lays it out, so a rerun with nothing changed changes nothing.
  execFileSync("vp", ["fmt", target], { stdio: "ignore" });
  const operations = entries.reduce((sum, e) => sum + Object.keys(e.code).length, 0);
  const defined = (allFamilies.filter(isEpsilFamily) as EpsilFamily[]).reduce((n, f) => n + operationsOf(f).length, 0);
  console.log(`${operations} of ${defined} family operations compiled`);
  for (const e of entries.filter((entry) => entry.interpreted.length > 0))
    console.log(`${e.head}: compiled ${e.interpreted.join(", ")} disagreed with the interpreter; left interpreted`);
}

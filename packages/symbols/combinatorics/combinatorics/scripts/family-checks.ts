// What compile-families.ts does to each Epsil family: compile its definitions (count, unrank,
// rank, valid) to JavaScript with compute-engine's own compiler, and keep the operations whose
// compiled code agrees with the interpreter on a sample. Split from the script so that only the
// processes doing the work load the families.

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

export interface Entry {
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

/**
 * Fibers of the sample that the interpreter takes a minute or so over, checked only in the
 * nightly sweep (tests/compiled-families.test.ts, DEEP_TESTS), not at every build. Smaller fibers
 * of each family run the same definitions: BoxedPlanePartitions' table walks a row list the
 * interpreter re-evaluates exponentially in its length (the C(b + c, b) rows of a 1 × 2 × 3
 * box), and GelfandTsetlin's unrank searches the rows linearly in the rank.
 */
const DEEP_FIBERS: Readonly<Record<string, readonly (readonly number[])[]>> = {
  BoxedPlanePartitions: [
    [1, 2, 3],
    [1, 3, 2],
  ],
  GelfandTsetlin: [
    [3, 3],
    [4, 2],
  ],
};

/** The heads that have fibers in the nightly sweep. */
export const deepHeads = Object.keys(DEEP_FIBERS);

const isDeep = (head: string, p: readonly number[]): boolean =>
  DEEP_FIBERS[head]?.some((q) => q.every((x, i) => x === p[i])) ?? false;

/** The fibers a build checks, and those left to the nightly sweep. */
export const fibersOf = (family: EpsilFamily, deep: boolean): number[][] =>
  sampleParams(family.paramCount).filter((p) => isDeep(family.head, p) === deep);

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
export function disagreements(
  ce: Engine,
  family: EpsilFamily,
  runs: Partial<Record<Operation, Run>>,
  fibers: readonly (readonly number[])[] = fibersOf(family, false),
): Operation[] {
  const wrong = new Set<Operation>();
  const attempt = (run: Run, vars: Record<string, unknown>): unknown => {
    try {
      return run(vars);
    } catch {
      return undefined;
    }
  };
  for (const p of fibers) {
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

/** The generated code of the family's operations that compile, and each one's runnable form. */
export function compileFamily(
  ce: Engine,
  family: EpsilFamily,
): { code: Partial<Record<Operation, string>>; runs: Partial<Record<Operation, Run>> } {
  const code: Partial<Record<Operation, string>> = {};
  const runs: Partial<Record<Operation, Run>> = {};
  for (const operation of operationsOf(family)) {
    const types = operationTypes(family, operation);
    const compiled = types === undefined ? undefined : compileTyped(ce, family.epsil[operation], types);
    if (compiled === undefined) continue;
    code[operation] = compiled.code;
    runs[operation] = compiled.run;
  }
  return { code, runs };
}

/** Each Epsil family's head, hash and the generated code of the operations that compile. */
export function compiledFamilies(
  verdicts: Verdicts = noVerdicts,
  only: (head: string) => boolean = () => true,
): Entry[] {
  const ce = bareEngine();
  const out: Entry[] = [];
  for (const family of (allFamilies.filter(isEpsilFamily) as EpsilFamily[]).filter((f) => only(f.head))) {
    const { code, runs } = compileFamily(ce, family);
    const interpreted = verdicts.remember({ params: family.params, epsil: family.epsil, code }, () =>
      disagreements(ce, family, runs),
    );
    for (const operation of interpreted) delete code[operation];
    out.push({ head: family.head, hash: familyHash(family), code, interpreted });
  }
  return out.toSorted((a, b) => (a.head < b.head ? -1 : a.head > b.head ? 1 : 0));
}

/** An entry as the generated module spells it. */
export function renderEntry(e: Entry): string {
  return [
    `  ${e.head}: {`,
    `    hash: ${JSON.stringify(e.hash)},`,
    // Code keys before the `interpreted` marker: tests/compiled-families.test.ts's drift
    // check builds its own key order the same way (code first, the marker last).
    ...OPERATIONS.flatMap((operation) =>
      e.code[operation] === undefined ? [] : [`    ${operation}: (_SYS, _) => ${e.code[operation]},`],
    ),
    ...(e.interpreted.length === 0 ? [] : [`    interpreted: ${JSON.stringify(e.interpreted)},`]),
    "  },",
  ].join("\n");
}

/** How many operations the families define, compiled or not. */
export const definedOperations = (): number =>
  (allFamilies.filter(isEpsilFamily) as EpsilFamily[]).reduce((n, f) => n + operationsOf(f).length, 0);

/** The heads compiledFamilies covers. */
export const familyHeads = (): string[] => (allFamilies.filter(isEpsilFamily) as EpsilFamily[]).map((f) => f.head);

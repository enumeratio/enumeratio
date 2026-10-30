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
import { familySourceHash } from "./verdicts.ts";
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
 * Fibers of the sample that the interpreter takes tens of seconds over (cold, on one core), checked
 * only in the nightly sweep (tests/compiled-families.test.ts, DEEP_TESTS), not at every build: head
 * to fibers. List one here when a definition's interpreter cost warrants it; the smaller fibers of
 * the same head stay in the build.
 */
const DEEP_FIBERS: Readonly<Record<string, readonly (readonly number[])[]>> = {
  SeparablePermutations: [[4]],
  SkewStandardTableaux: [[4]],
  NonCrossingCycleSupportPermutations: [[4]],
};

/** The heads that have fibers in the nightly sweep. */
export const deepHeads = Object.keys(DEEP_FIBERS);

const isDeep = (head: string, p: readonly number[]): boolean =>
  DEEP_FIBERS[head]?.some((q) => q.length === p.length && q.every((x, i) => x === p[i])) ?? false;

/** The fibers a build checks, and those left to the nightly sweep. */
export const fibersOf = (family: EpsilFamily, deep: boolean): number[][] =>
  sampleParams(family.paramCount).filter((p) => isDeep(family.head, p) === deep);

/** The ranks sampled in a fiber with no end: the first few, some between, and the last ones whose term a double
 *  holds exactly. The last is found by doubling the rank until its term is out of reach (a fold over the
 *  ranks costs what the rank does), then bisecting, with the interpreter; a rank the family declines isn't tried. */
function unboundedRanks(ce: Engine, family: EpsilFamily, bind: Record<string, unknown>): bigint[] {
  const safe = (r: bigint): boolean => {
    const term = elementOf(evaluateEpsil(ce, family.epsil.unrank, { ...bind, _r: Number(r) }));
    return typeof term === "number" && Number.isSafeInteger(term);
  };
  const params = family.params.map((name) => Number(bind[name]));
  const reached = (r: bigint): boolean => family.early?.unrank?.(r, params) !== "decline";
  const ranks = new Set<bigint>([0n, 1n, 2n, 3n, 5n, 8n, 12n, 15n]);
  const top = 2n ** 53n - 1n;
  // The farthest rank tried: the top, or the last one the family answers.
  let limit = top;
  if (!reached(limit)) {
    let [near, far] = [0n, top];
    while (near + 1n < far) {
      const mid = (near + far) / 2n;
      if (reached(mid)) near = mid;
      else far = mid;
    }
    limit = near;
  }
  let [low, high] = [0n, 16n];
  while (high <= limit && safe(high)) [low, high] = [high, high * 2n];
  if (high > limit) {
    if (safe(limit)) {
      // Every rank tried has a term a double holds: a constant or slow sequence, or one that is reached no farther.
      for (const r of [limit / 3n, limit]) ranks.add(r);
      return [...ranks];
    }
    high = limit;
  }
  while (low + 1n < high) {
    const mid = (low + high) / 2n;
    if (safe(mid)) low = mid;
    else high = mid;
  }
  for (const r of [low - 2n, low - 1n, low, low / 2n, low / 7n, low / 1000n, 12345n])
    if (r >= 0n && r <= low) ranks.add(r);
  // The first few ranks are only sampled where their terms are safe.
  return [...ranks].filter((r) => r <= low);
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
    const counted = evaluateEpsil(ce, family.epsil.count, bind);
    // A fiber with no end is sampled by its first ranks, where a sequence's terms are small.
    const unbounded = counted === "PositiveInfinity";
    const total = unbounded ? 0n : integerOf(counted);
    if (total === undefined || total > BigInt(Number.MAX_SAFE_INTEGER)) continue;
    if (runs.count !== undefined && attempt(runs.count, compiledBind) !== (unbounded ? Infinity : Number(total)))
      wrong.add("count");
    if (total === 0n && !unbounded) continue;
    for (const r of unbounded ? unboundedRanks(ce, family, bind) : new Set([0n, total / 2n, total - 1n])) {
      const element = elementOf(evaluateEpsil(ce, family.epsil.unrank, { ...bind, _r: Number(r) }));
      if (
        runs.unrank !== undefined &&
        JSON.stringify(attempt(runs.unrank, { ...compiledBind, _r: Number(r) })) !== JSON.stringify(element)
      )
        wrong.add("unrank");
      // A sequence may repeat a term (a constant one), so its rank is the first place the term is found, as
      // the interpreter reads it; elsewhere a member's rank is the rank it came from.
      // A rank the family declines (a search too long to run) is not checked.
      if (!(unbounded && family.early?.rank?.(element as never, p) === "decline")) {
        const place = unbounded ? integerOf(evaluateEpsil(ce, family.epsil.rank, { ...bind, _x: element })) : BigInt(r);
        if (runs.rank !== undefined && attempt(runs.rank, { ...compiledBind, _x: element }) !== Number(place))
          wrong.add("rank");
      }
      if (runs.valid !== undefined)
        for (const candidate of [element, nearMiss(element)]) {
          // The kernel hands compiled code only safe integers (a neighbour of the last term may not be one).
          if (typeof candidate === "number" && !Number.isSafeInteger(candidate)) continue;
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
    // disagreements reads a family only through these fields, and `early.unrank`/`early.rank`,
    // whose closures may reach any family source: a family with either keys on all of it.
    const { early } = family;
    const data = { ...family, early: undefined, fast: undefined, fastCount: undefined };
    const reachesSource = early?.unrank !== undefined || early?.rank !== undefined;
    const interpreted = verdicts.remember(
      {
        data,
        code,
        source: reachesSource ? familySourceHash() : undefined,
      },
      () => disagreements(ce, family, runs),
      family.head,
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

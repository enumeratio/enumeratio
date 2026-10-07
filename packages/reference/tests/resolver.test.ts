// The resolver (`@enumeratio/manifest`'s `createResolver`) declares only what an expression
// names. It means what the full engine means when every example evaluates the same in an
// engine holding just the packages its head's examples name, and their requirements. The
// standard run checks a few heads across the packages; `DEEP_TESTS=1` checks every one. Triage
// rows are left out: one that reads state an earlier case left on the pooled engine (Transpose's
// `m`) differs with which cases share an engine.

import { isSettled } from "@enumeratio/entry";
import { runCases } from "@enumeratio/evaluation/node";
import { assembleDeclarers, packagesNeeded } from "@enumeratio/manifest";
import { expect, test } from "vite-plus/test";
import { LIBRARIES } from "../scripts/engines.ts";
import { referenceData } from "../src/node.ts";

const TABLES = assembleDeclarers(LIBRARIES);

test("every library says what declaring it finds", () => {
  // Without it the resolver has only the records' overloads to go on.
  expect(LIBRARIES.filter((library) => library.declares === undefined).map((library) => library.name)).toEqual([]);
  // A row on a carrier type the package mints waits for something that makes one.
  expect([...packagesNeeded(["Inverse", "x"], LIBRARIES, undefined, TABLES)]).not.toContain("combinatorics");
});

// The heads whose overloads live in tables (defineOverload), whatever order declares them, among them.
const SAMPLE = new Set([
  "Zeta",
  "HypergeometricPFQ",
  "Permutations",
  "ResidueClass",
  "Adele",
  "Quaternion",
  "Floor",
  "Fibonacci",
  "LucasL",
  "Inverse",
]);

// Where the lazy engine differs, and why.
const KNOWN: Readonly<Record<string, string>> = {
  // Its results carry timings.
  VerificationTest: "timing fields differ run to run",
};

// An approximate value is good to the engine's working precision, 21 digits, less what a
// subtraction cancels (ψ⁽⁵⁾(2) is ψ⁽⁵⁾(1) − 120): the full engine may carry a few more digits of one (a sum evaluated
// exactly, then rounded) than the lazy one (a term rounded, then summed). Two such values agree
// within 1e-18 of each other, relative to their size past 1.
const DECIMAL = /^-?\d+(\.\d+)?$/;
const SCALE = 60;
const scaled = (text: string): bigint => {
  const [whole = "0", fraction = ""] = text.replace("-", "").split(".");
  const magnitude = BigInt(whole + fraction.padEnd(SCALE, "0").slice(0, SCALE));
  return text.startsWith("-") ? -magnitude : magnitude;
};
const abs = (x: bigint): bigint => (x < 0n ? -x : x);
const sameNumber = (a: string, b: string): boolean => {
  if (!DECIMAL.test(a) || !DECIMAL.test(b)) return a === b;
  const [x, y] = [scaled(a), scaled(b)];
  const larger = [abs(x), abs(y), 10n ** BigInt(SCALE)].reduce((m, v) => (v > m ? v : m));
  return abs(x - y) * 10n ** 18n <= larger;
};
const agree = (a: unknown, b: unknown): boolean => {
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return a === b;
  const [x, y] = [a as Record<string, unknown>, b as Record<string, unknown>];
  if (typeof x.num === "string" && typeof y.num === "string") return sameNumber(x.num, y.num);
  const keys = Object.keys(x);
  return keys.length === Object.keys(y).length && keys.every((key) => key in y && agree(x[key], y[key]));
};

const OWN_ENGINE = new Set(["statistics", "domains"]);
const deep = process.env.DEEP_TESTS === "1";
const heads = referenceData().heads.filter(
  (h) => !OWN_ENGINE.has(h.package) && !(h.head in KNOWN) && (deep || SAMPLE.has(h.head)),
);

test(
  "an engine with only the resolved packages evaluates each example as the full one does",
  { timeout: 600_000 },
  async () => {
    const setup = (query = ""): string =>
      new URL(`../scripts/${query ? "lazy-engines.ts" : "engines.ts"}${query}`, import.meta.url).href;
    const options = { timeMs: 10_000, memoryBytes: 512 * 1024 * 1024, materialize: true, concurrency: 3 };
    const cases = heads.flatMap((h) =>
      h.entry.examples.filter(isSettled).map((e) => ({ id: `${h.package}/${h.head}/${e.id}`, input: e.expr })),
    );
    const full = new Map((await runCases(cases, { ...options, setup: setup() })).map((r) => [r.id, r]));
    const groups = new Map<string, typeof cases>();
    for (const h of heads) {
      const packages = new Set(
        h.entry.examples.filter(isSettled).flatMap((e) => [...packagesNeeded(e.expr, LIBRARIES, undefined, TABLES)]),
      );
      const key = [...packages].toSorted().join(",");
      groups.set(key, [...(groups.get(key) ?? []), ...cases.filter((c) => c.id.startsWith(`${h.package}/${h.head}/`))]);
    }
    const differ: string[] = [];
    for (const [key, group] of groups) {
      for (const r of await runCases(group, { ...options, setup: setup(`?packages=${key}`) })) {
        const f = full.get(r.id)!;
        if (r.outcome !== f.outcome || !agree(r.value, f.value)) differ.push(`${r.id} [${key}]`);
      }
    }
    expect(differ).toEqual([]);
  },
);

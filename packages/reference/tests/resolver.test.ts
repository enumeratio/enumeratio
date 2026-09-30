// The resolver (`@enumeratio/manifest`'s `createResolver`) declares only what an expression
// names. It means what the full engine means when every example evaluates the same in an
// engine holding just the packages its head's examples name, and their requirements. The
// standard run checks a few heads across the packages; `DEEP_TESTS=1` checks every one.

import { runCases } from "@enumeratio/evaluation/src/node";
import { CANONICAL, CARRIER_TYPES, DECLARERS, packagesNeeded, plan } from "@enumeratio/manifest";
import { expect, test } from "vite-plus/test";
import { canonicalNames, carrierTypes, declarers } from "../scripts/declarers.ts";
import { LIBRARIES } from "../scripts/engines.ts";
import { referenceData } from "../src/node.ts";

test("DECLARERS is what declaring each library finds", () => {
  // Regenerate with `vp node packages/reference/scripts/collect-declarers.ts`.
  expect(declarers(LIBRARIES, plan)).toEqual(DECLARERS);
  expect(canonicalNames(LIBRARIES)).toEqual(CANONICAL);
  expect(carrierTypes(LIBRARIES, plan)).toEqual(CARRIER_TYPES);
});

// The heads whose overloads live in tables (defineOverload), whatever order declares them, among them.
const SAMPLE = new Set([
  "Zeta",
  "HypergeometricPFQ",
  "Permutations",
  "IntegerMod",
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

// Digits beyond a double's differ with the precision an earlier case in the same worker left
// behind (the `N(x, d)` leak), not with what's declared: compare numbers to 15 digits.
const rounded = (x: unknown): unknown => {
  if (Array.isArray(x)) return x.map(rounded);
  if (x !== null && typeof x === "object" && typeof (x as { num?: unknown }).num === "string")
    return Number((x as { num: string }).num).toPrecision(15);
  if (typeof x === "number") return x.toPrecision(15);
  return x;
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
      h.entry.examples.map((e) => ({ id: `${h.package}/${h.head}/${e.id}`, input: e.expr })),
    );
    const full = new Map((await runCases(cases, { ...options, setup: setup() })).map((r) => [r.id, r]));
    const groups = new Map<string, typeof cases>();
    for (const h of heads) {
      const packages = new Set(h.entry.examples.flatMap((e) => [...packagesNeeded(e.expr, LIBRARIES)]));
      const key = [...packages].toSorted().join(",");
      groups.set(key, [...(groups.get(key) ?? []), ...cases.filter((c) => c.id.startsWith(`${h.package}/${h.head}/`))]);
    }
    const differ: string[] = [];
    for (const [key, group] of groups) {
      for (const r of await runCases(group, { ...options, setup: setup(`?packages=${key}`) })) {
        const f = full.get(r.id)!;
        if (r.outcome !== f.outcome || JSON.stringify(rounded(r.value)) !== JSON.stringify(rounded(f.value)))
          differ.push(`${r.id} [${key}]`);
      }
    }
    expect(differ).toEqual([]);
  },
);

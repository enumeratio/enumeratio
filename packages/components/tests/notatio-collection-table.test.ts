// Integration test for the collection-table's per-column carrier wrap (BL-1): a REAL engine,
// declared in the same order and with the same options as the production page
// (web/.vitepress/theme/engine-libraries.ts's domains -> collections -> domain plurals ->
// statistics -> structures slice), driving the exact mechanism the component uses
// (`collectionCarrierOf`, `wantsCarrier`, `substituteRowPerHead`, and the bare/wrapped
// representations `#representations` computes) rather than re-deriving it.
//
// Two element shapes are covered, since #385 made them coexist: a permutation family
// (SymmetricGroup) now yields elements ALREADY typed `Permutation(...)`, while the other
// carrier families here (IntegerPartitions, DyckPaths) still yield bare lists. Both must
// reach the same answer through the same deterministic per-argument choice -- wrap a bare
// list, or use the carrier value as-is, never double-wrap, and unwrap for a bare-list head.
//
// Each statistic's expected value comes from an independent reference computed here from the
// row's own bare list -- never from the production kernel -- so this catches a wrong wrap
// decision (a carrier-only statistic silently landing on ⚠, or a bare-list one being wrapped
// into a different answer) rather than just re-confirming the statistic's own algorithm.

import type { BoxedExpression } from "@cortex-js/compute-engine";
import { ComputeEngine } from "@cortex-js/compute-engine";
import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import { declareCollections } from "@enumeratio/collections";
import { declareDomainElement, declareDomainPlurals, declareDomains, DOMAINS } from "@enumeratio/domains";
import { substituteRowPerHead, wantsCarrier } from "@enumeratio/frontend";
import { ALL_STATISTICS, declareStatistics } from "@enumeratio/statistics";
import { collectionCarrierOf, declareStructures } from "@enumeratio/structures";
import { expect, test } from "vite-plus/test";

function productionEngine(): ComputeEngine {
  const ce = new ComputeEngine();
  const domainTypes = Object.fromEntries(DOMAINS.filter((d) => d.name !== "SetPartition").map((d) => [d.name, d.type]));
  declareDomains(ce);
  declareCollections(ce, { permutationType: "permutation" });
  declareDomainPlurals(ce);
  declareDomainElement(ce);
  declareStatistics(ce, ALL_STATISTICS, { domainTypes });
  declareStructures(ce);
  return ce;
}

/**
 * `elt`'s bare and carrier-wrapped MathJSON, the same way the component's `#representations`
 * reads them: a family may already yield a carrier VALUE (`SymmetricGroup`'s elements are
 * `Permutation(...)` since #385), in which case "bare" is that value's own single argument,
 * unwrapped, and "wrapped" is the value as-is -- never a double wrap, never a fabricated one.
 */
function representationsOf(
  elt: BoxedExpression,
  carrier: string | undefined,
): { bare: MathJsonExpression; wrapped: MathJsonExpression } {
  if (!carrier) return { bare: elt.json, wrapped: elt.json };
  const json = elt.json;
  if (elt.operator === carrier && Array.isArray(json) && json.length === 2) {
    return { bare: json[1] as MathJsonExpression, wrapped: json };
  }
  return { bare: json, wrapped: [carrier, json] as MathJsonExpression };
}

/** The row's own flat integers, read off its BARE representation regardless of whether the
 *  element itself arrived already wrapped in its carrier. */
function intsOf(elt: BoxedExpression, carrier: string | undefined): number[] {
  const { bare } = representationsOf(elt, carrier);
  return (bare as unknown as unknown[]).slice(1) as number[];
}

/** Every row of a finite collection, as its `BoxedExpression` -- bare or already a carrier
 *  value, whichever the family yields. */
function rowsOf(ce: ComputeEngine, expr: MathJsonExpression): BoxedExpression[] {
  const coll = ce.box(expr as never);
  const total = coll.count as number;
  const rows: BoxedExpression[] = [];
  for (let i = 1; i <= total; i++) rows.push(coll.at(i)!);
  return rows;
}

/** Evaluate `head(_)` at `elt`, through the SAME per-argument wrap decision the table uses:
 *  bare when the head's declared type already accepts it, else wrapped in `carrier` when the
 *  head declares that carrier as its type -- never a blanket choice, never a double wrap. */
function evalStat(ce: ComputeEngine, head: string, elt: BoxedExpression, carrier: string | undefined): number {
  const { bare, wrapped } = representationsOf(elt, carrier);
  const bareType = bare === elt.json ? elt.type : ce.box(bare as never).type;
  const carrierType = carrier ? (wrapped === elt.json ? elt.type : ce.box(wrapped as never).type) : undefined;
  const wrap = wantsCarrier(ce, head, 0, bareType, carrierType);
  const json = substituteRowPerHead([head, "_"], bare, wrapped, () => wrap);
  const result = ce.box(json as never).evaluate();
  expect(result.operator, `${head}(${JSON.stringify(elt.json)}) errored`).not.toBe("Error");
  return result.re;
}

test("FixedPoints over SymmetricGroup(5) (already Permutation-typed, #385) picks out the 44 derangements", () => {
  const ce = productionEngine();
  const carrier = collectionCarrierOf(ce, "SymmetricGroup");
  expect(carrier).toBe("Permutation");
  const rows = rowsOf(ce, ["SymmetricGroup", 5]);
  expect(rows).toHaveLength(120);
  // #385: the family already yields carrier values, not bare lists.
  expect(rows[0]!.operator).toBe("Permutation");

  const reference = (p: number[]): number => p.filter((v, i) => v === i + 1).length;
  const derangements = rows.filter((row) => evalStat(ce, "FixedPoints", row, carrier) === 0);
  expect(derangements).toHaveLength(44);
  // Cross-check the wrapped dispatch against the independent reference, every row.
  for (const row of rows) expect(evalStat(ce, "FixedPoints", row, carrier)).toBe(reference(intsOf(row, carrier)));
});

test("CycleCount (carrier-only) dispatches correctly over every already-typed permutation of SymmetricGroup(4)", () => {
  const ce = productionEngine();
  const carrier = collectionCarrierOf(ce, "SymmetricGroup");
  const rows = rowsOf(ce, ["SymmetricGroup", 4]);
  expect(rows).toHaveLength(24);

  const reference = (p: number[]): number => {
    const seen = new Array(p.length).fill(false);
    let cycles = 0;
    for (let i = 0; i < p.length; i++) {
      if (seen[i]) continue;
      cycles++;
      let j = i;
      while (!seen[j]) {
        seen[j] = true;
        j = p[j] - 1;
      }
    }
    return cycles;
  };
  for (const row of rows) expect(evalStat(ce, "CycleCount", row, carrier)).toBe(reference(intsOf(row, carrier)));
});

test("Descents (bare-list-accepting) over an already-typed permutation still answers over the word, unwrapped", () => {
  // The mirror case (Dean's point 4): a list function -- or here, a statistic whose type is a
  // UNION including a bare list -- must not be left looking at the whole `Permutation(...)`
  // wrapper as if it were the row; it needs the word underneath, same as a still-bare family.
  const ce = productionEngine();
  const carrier = collectionCarrierOf(ce, "SymmetricGroup");
  const rows = rowsOf(ce, ["SymmetricGroup", 5]);
  expect(rows[0]!.operator).toBe("Permutation");

  const reference = (p: number[]): number => {
    let c = 0;
    for (let i = 0; i + 1 < p.length; i++) if (p[i] > p[i + 1]) c++;
    return c;
  };
  for (const row of rows) expect(evalStat(ce, "Descents", row, carrier)).toBe(reference(intsOf(row, carrier)));
});

test("Length (bare-list, generic `any`) over an already-typed permutation gives its true length, unwrapped", () => {
  const ce = productionEngine();
  const carrier = collectionCarrierOf(ce, "SymmetricGroup");
  const rows = rowsOf(ce, ["SymmetricGroup", 5]);

  for (const row of rows) {
    const { bare, wrapped } = representationsOf(row, carrier);
    const bareType = bare === row.json ? row.type : ce.box(bare as never).type;
    const carrierType = wrapped === row.json ? row.type : ce.box(wrapped as never).type;
    expect(wantsCarrier(ce, "Length", 0, bareType, carrierType)).toBe(false);
    expect(evalStat(ce, "Length", row, carrier)).toBe(intsOf(row, carrier).length);
  }
});

test("DurfeeSquare (carrier-only) dispatches correctly over every still-bare partition of IntegerPartitions(8)", () => {
  const ce = productionEngine();
  const carrier = collectionCarrierOf(ce, "IntegerPartitions");
  expect(carrier).toBe("IntegerPartition");
  const rows = rowsOf(ce, ["IntegerPartitions", 8]);
  expect(rows.length).toBeGreaterThan(0);
  // Unlike the permutation families, #385 left this carrier's elements bare lists.
  expect(rows[0]!.operator).not.toBe(carrier);

  // Parts are weakly decreasing (statistics/src/partition.ts): the largest d with at least
  // d parts of size >= d.
  const reference = (parts: number[]): number => {
    let d = 0;
    while (d < parts.length && parts[d] >= d + 1) d++;
    return d;
  };
  for (const row of rows) expect(evalStat(ce, "DurfeeSquare", row, carrier)).toBe(reference(intsOf(row, carrier)));
});

test("Height (carrier-only) dispatches correctly over every still-bare path of DyckPaths(4)", () => {
  const ce = productionEngine();
  const carrier = collectionCarrierOf(ce, "DyckPaths");
  expect(carrier).toBe("DyckPath");
  const rows = rowsOf(ce, ["DyckPaths", 4]);
  expect(rows.length).toBeGreaterThan(0);

  // 1 = up, 0 = down (statistics/src/dyck.ts).
  const reference = (steps: number[]): number => {
    let h = 0;
    let max = 0;
    for (const s of steps) max = Math.max(max, (h += s === 1 ? 1 : -1));
    return max;
  };
  for (const row of rows) expect(evalStat(ce, "Height", row, carrier)).toBe(reference(intsOf(row, carrier)));
});

test("Area and Returns (carrier-only) dispatch correctly over every still-bare path of DyckPaths(4)", () => {
  const ce = productionEngine();
  const carrier = collectionCarrierOf(ce, "DyckPaths");
  const rows = rowsOf(ce, ["DyckPaths", 4]);
  expect(rows.length).toBeGreaterThan(0);

  // 1 = up, 0 = down (statistics/src/dyck.ts).
  const heights = (steps: number[]): number[] => {
    let h = 0;
    return steps.map((s) => (h += s === 1 ? 1 : -1));
  };
  const area = (steps: number[]): number => heights(steps).reduce((a, b) => a + b, 0);
  const returns = (steps: number[]): number => heights(steps).filter((h) => h === 0).length;

  for (const row of rows) {
    const ints = intsOf(row, carrier);
    expect(evalStat(ce, "Area", row, carrier)).toBe(area(ints));
    expect(evalStat(ce, "Returns", row, carrier)).toBe(returns(ints));
  }
});

test("Length (bare-list) over IntegerPartitions(8) still gives the true part count -- never wrapped", () => {
  const ce = productionEngine();
  const carrier = collectionCarrierOf(ce, "IntegerPartitions");
  const rows = rowsOf(ce, ["IntegerPartitions", 8]);

  for (const row of rows) {
    const { bare, wrapped } = representationsOf(row, carrier);
    const bareType = ce.box(bare as never).type;
    const carrierType = carrier ? ce.box(wrapped as never).type : undefined;
    // The bare row already satisfies Length's declared type, so it must NOT be wrapped --
    // wrapping would ask a different, wrong question (Length(IntegerPartition(...)) counts
    // something else than the part count).
    expect(wantsCarrier(ce, "Length", 0, bareType, carrierType)).toBe(false);
    expect(evalStat(ce, "Length", row, carrier)).toBe(intsOf(row, carrier).length);
  }
});

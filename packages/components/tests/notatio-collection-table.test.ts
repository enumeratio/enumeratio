// Integration test for the collection-table's per-column carrier wrap (BL-1): a REAL engine,
// declared in the same order and with the same options as the production page
// (web/.vitepress/theme/engine-libraries.ts's domains -> collections -> domain plurals ->
// statistics -> structures slice), driving the exact mechanism the component uses
// (`collectionCarrierOf`, `wantsCarrier`, `substituteRowPerHead`) rather than re-deriving it.
//
// Each statistic's expected value comes from an independent reference computed here from the
// row's own bare list -- never from the production kernel -- so this catches a wrong wrap
// decision (a carrier-only statistic silently landing on ⚠, or a bare-list one being wrapped
// into a different answer) rather than just re-confirming the statistic's own algorithm.

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

/** Every row of a finite collection, as its bare (never wrapped) `BoxedExpression`. */
function rowsOf(ce: ComputeEngine, expr: MathJsonExpression): { json: MathJsonExpression; ints: number[] }[] {
  const coll = ce.box(expr as never);
  const total = coll.count as number;
  const rows: { json: MathJsonExpression; ints: number[] }[] = [];
  for (let i = 1; i <= total; i++) {
    const elt = coll.at(i)!;
    const ints = (elt.json as unknown as unknown[]).slice(1) as number[];
    rows.push({ json: elt.json, ints });
  }
  return rows;
}

/** Evaluate `head(_)` at `row`, through the SAME per-argument wrap decision the table uses:
 *  bare when the head's declared type already accepts it, else wrapped in `carrier` when the
 *  head declares that carrier as its type -- never a blanket choice. */
function evalStat(ce: ComputeEngine, head: string, row: MathJsonExpression, carrier: string | undefined): number {
  const bareType = ce.box(row as never).type;
  const carrierType = carrier ? ce.box([carrier, row] as never).type : undefined;
  const wrap = wantsCarrier(ce, head, 0, bareType, carrierType);
  const json = substituteRowPerHead([head, "_"], row, carrier ? [carrier, row] : row, () => wrap);
  const result = ce.box(json as never).evaluate();
  expect(result.operator, `${head}(${JSON.stringify(row)}) errored`).not.toBe("Error");
  return result.re;
}

test("FixedPoints over SymmetricGroup(5) picks out the 44 derangements", () => {
  const ce = productionEngine();
  const carrier = collectionCarrierOf(ce, "SymmetricGroup");
  expect(carrier).toBe("Permutation");
  const rows = rowsOf(ce, ["SymmetricGroup", 5]);
  expect(rows).toHaveLength(120);

  const reference = (p: number[]): number => p.filter((v, i) => v === i + 1).length;
  const derangements = rows.filter((row) => evalStat(ce, "FixedPoints", row.json, carrier) === 0);
  expect(derangements).toHaveLength(44);
  // Cross-check the wrapped dispatch against the independent reference, every row.
  for (const row of rows) expect(evalStat(ce, "FixedPoints", row.json, carrier)).toBe(reference(row.ints));
});

test("CycleCount (carrier-only) dispatches correctly over every permutation of SymmetricGroup(4)", () => {
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
  for (const row of rows) expect(evalStat(ce, "CycleCount", row.json, carrier)).toBe(reference(row.ints));
});

test("DurfeeSquare (carrier-only) dispatches correctly over every partition of IntegerPartitions(8)", () => {
  const ce = productionEngine();
  const carrier = collectionCarrierOf(ce, "IntegerPartitions");
  expect(carrier).toBe("IntegerPartition");
  const rows = rowsOf(ce, ["IntegerPartitions", 8]);
  expect(rows.length).toBeGreaterThan(0);

  // Parts are weakly decreasing (statistics/src/partition.ts): the largest d with at least
  // d parts of size >= d.
  const reference = (parts: number[]): number => {
    let d = 0;
    while (d < parts.length && parts[d] >= d + 1) d++;
    return d;
  };
  for (const row of rows) expect(evalStat(ce, "DurfeeSquare", row.json, carrier)).toBe(reference(row.ints));
});

test("Height (carrier-only) is WRAPPED, per its declared type -- known-broken past that point", () => {
  // Height itself hits an unrelated, pre-existing bug once wrapped: its definition is
  // `Max(profile)` over the still-lazy height-profile Map, and @enumeratio/structures'
  // generic Min/Max (packages/structures/src/generic.ts's `wrapOperator` over "Max", guarded
  // by `isStructured`) treats that unmaterialised Map as a single "structured" value rather
  // than letting native Max flatten and reduce it -- so `extremum` hands the pool of one
  // straight back, unevaluated. Confirmed by reproducing it with `applyDefinition` directly,
  // no wrap/dispatch code of ours involved. Out of scope for BL-1 (structures/generic.ts is
  // Protocols/BL-7 territory) -- reported to the coordinator rather than fixed here. `Area`
  // and `Returns`, DyckPath statistics that don't route through `Max`, exercise the same
  // wrap-then-dispatch path end to end below.
  const ce = productionEngine();
  const carrier = collectionCarrierOf(ce, "DyckPaths");
  expect(carrier).toBe("DyckPath");
  const row = rowsOf(ce, ["DyckPaths", 4])[0]!.json;
  const bareType = ce.box(row as never).type;
  const carrierType = ce.box([carrier!, row] as never).type;
  expect(wantsCarrier(ce, "Height", 0, bareType, carrierType)).toBe(true);
});

test("Area and Returns (carrier-only) dispatch correctly over every path of DyckPaths(4)", () => {
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
    expect(evalStat(ce, "Area", row.json, carrier)).toBe(area(row.ints));
    expect(evalStat(ce, "Returns", row.json, carrier)).toBe(returns(row.ints));
  }
});

test("Length (bare-list) over IntegerPartitions(8) still gives the true part count -- never wrapped", () => {
  const ce = productionEngine();
  const carrier = collectionCarrierOf(ce, "IntegerPartitions");
  const rows = rowsOf(ce, ["IntegerPartitions", 8]);

  for (const row of rows) {
    const bareType = ce.box(row.json as never).type;
    const carrierType = carrier ? ce.box([carrier, row.json] as never).type : undefined;
    // The bare row already satisfies Length's declared type, so it must NOT be wrapped --
    // wrapping would ask a different, wrong question (Length(IntegerPartition(...)) counts
    // something else than the part count).
    expect(wantsCarrier(ce, "Length", 0, bareType, carrierType)).toBe(false);
    expect(evalStat(ce, "Length", row.json, carrier)).toBe(row.ints.length);
  }
});

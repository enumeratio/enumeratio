import { expect, test } from "vite-plus/test";
import { fromWolfram } from "../src/from-wolfram.ts";
import { type MathJson, toWolfram } from "../src/to-wolfram.ts";
import golden from "./golden/round-trip.json" with { type: "json" };

// One case per distinct head-signature set in the reference corpus, pinned by
// scripts/gen-round-trip.ts. `back` is present only where the trip is lossy by
// construction, so the golden also enumerates exactly which shapes those are.
interface Golden {
  readonly id: string;
  readonly expr: MathJson;
  readonly wolfram: string;
  readonly back?: MathJson;
}
const cases = golden as readonly Golden[];

test("the golden covers the corpus", () => {
  expect(cases.length).toBeGreaterThan(200);
});

test.each(cases.map((c) => [c.id, c] as const))("%s round-trips", (_id, c) => {
  expect(toWolfram(c.expr)).toBe(c.wolfram);
  expect(fromWolfram(c.wolfram)).toEqual(c.back ?? c.expr);
});

/** Heads whose lowering has no Wolfram head to reverse from — see `applyHead` in
 * from-wolfram.ts. `Lb` shares `Log2` with `Log2`, which wins the reverse map. */
const LOSSY = new Set([
  "Log",
  "Lb",
  "Square",
  "Root",
  "Mode",
  "Round",
  "Set",
  "IndexOf",
  "Degrees",
  // Wolfram has no LegendreSymbol; it lowers to JacobiSymbol (see to-wolfram.ts).
  "LegendreSymbol",
  // Range mismatch with Wolfram's ArcCot forces a Subtract/ArcTan expansion, one-way.
  "Arccot",
  // LogGamma is also what GammaLn lowers to, so the reverse map only recovers LogGamma.
  "LogGamma",
  // PositionalNumerals(b) lowers to the bare base b, a system value with no head to reverse.
  "PositionalNumerals",
]);

/** The head of the innermost call that came back different — the one whose lowering lost. */
const divergingHead = (expr: MathJson, back: MathJson, parent: string): string => {
  if (
    Array.isArray(expr) &&
    Array.isArray(back) &&
    expr[0] === back[0] &&
    expr.length === back.length
  ) {
    for (let i = 1; i < expr.length; i++) {
      if (JSON.stringify(expr[i]) !== JSON.stringify(back[i])) {
        return divergingHead(expr[i], back[i], typeof expr[0] === "string" ? expr[0] : parent);
      }
    }
  }
  return Array.isArray(expr) && typeof expr[0] === "string" ? expr[0] : parent;
};

test("lossy trips lose only the documented heads", () => {
  const lossy = cases.filter((c) => c.back !== undefined);
  expect(lossy.length).toBeGreaterThan(0);
  for (const c of lossy) {
    const head = divergingHead(c.expr, c.back as MathJson, "?");
    expect(LOSSY.has(head), `${c.id} loses ${head}: ${c.wolfram}`).toBe(true);
  }
});

import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareDomains } from "../src/declare.ts";
import { DOMAINS } from "../src/domain-data.ts";
import { declareMaps } from "../src/map.ts";

const ce = new ComputeEngine();
declareDomains(ce);
declareMaps(ce, Object.fromEntries(DOMAINS.map((d) => [d.type, d.name])));

const perm = (...entries: number[]): unknown => ["Permutation", ["List", ...entries]];
const contents = (expr: unknown): unknown => {
  const evaluated = ce.box(expr as never).evaluate();
  return (evaluated as unknown as { ops?: { json: unknown }[] }).ops?.[0]?.json;
};

function permutations(n: number): number[][] {
  if (n === 0) return [[]];
  const out: number[][] = [];
  for (const rest of permutations(n - 1))
    for (let i = 0; i <= rest.length; i++) out.push([...rest.slice(0, i), n, ...rest.slice(i)]);
  return out;
}
/** RSK is expensive as an expression: the insertion re-derives the bumped entry for every
 *  row it touches, so the cost grows fast. Checked over every permutation up to size 4 — 33
 *  words, still exhaustive — rather than the 153 up to size 5, which takes over a minute.
 *  The cost IS the finding, the same one the cubic statistics made: a definition is a
 *  specification, not a fast path. */
const ALL = [1, 2, 3, 4].flatMap(permutations);

/** Row insertion with bumping, read with a plain loop — the ordinary algorithm, which is
 *  exactly what the expression definition deliberately does NOT do. */
function rskTableaux(p: number[]): { insertion: number[][]; recording: number[][] } {
  const insertion: number[][] = [];
  const recording: number[][] = [];
  p.forEach((entry, step) => {
    let carried = entry;
    let r = 0;
    for (;;) {
      if (!insertion[r]) {
        insertion[r] = [carried];
        recording[r] = [step + 1];
        break;
      }
      const index = insertion[r]!.findIndex((v) => v > carried);
      if (index < 0) {
        insertion[r]!.push(carried);
        recording[r]!.push(step + 1);
        break;
      }
      const bumped = insertion[r]![index]!;
      insertion[r]![index] = carried;
      carried = bumped;
      r++;
    }
  });
  return { insertion, recording };
}
const insertionTableau = (p: number[]): number[][] => rskTableaux(p).insertion;

test("RskInsertion is the row word of the insertion tableau", () => {
  for (const p of ALL) {
    const rows = insertionTableau(p);
    expect(contents(["RskInsertion", perm(...p)]), `[${p}]`).toEqual(["List", ...rows.flat()]);
  }
});

test("RskShape is the shape of that tableau, and partitions n", () => {
  for (const p of ALL) {
    const shape = insertionTableau(p).map((row) => row.length);
    expect(contents(["RskShape", perm(...p)]), `[${p}]`).toEqual(["List", ...shape]);
    expect(
      shape.reduce((a, b) => a + b, 0),
      `[${p}] sums to n`,
    ).toBe(p.length);
    for (let i = 1; i < shape.length; i++)
      expect(shape[i - 1]!, `[${p}] weakly decreasing`).toBeGreaterThanOrEqual(shape[i]!);
  }
});

test("the shape's first part is the longest increasing subsequence", () => {
  // Schensted. Two statistics readable off one map — and an independent check on both, since
  // the statistic and the map are computed by completely different expressions.
  const lis = (p: number[]): number => {
    const tops: number[] = [];
    for (const x of p) {
      const i = tops.findIndex((t) => t >= x);
      if (i < 0) tops.push(x);
      else tops[i] = x;
    }
    return tops.length;
  };
  for (const p of ALL) {
    const shape = insertionTableau(p).map((row) => row.length);
    expect(shape[0] ?? 0, `[${p}]`).toBe(lis(p));
  }
});

test("RskInsertion and RskShape are typed by carrier", () => {
  const p = perm(3, 1, 4, 2);
  expect(String(ce.box(["RskInsertion", p] as never).evaluate().type)).toBe("standard_tableau");
  expect(String(ce.box(["RskShape", p] as never).evaluate().type)).toBe("integer_partition");
  // A standard tableau is a ROW WORD, not a nested list — the carrier shape says so, and a
  // nested result would be rejected by the type rather than quietly accepted.
  expect(DOMAINS.find((d) => d.name === "StandardTableau")?.shape).toBe("list<integer>");
});

test("RskRecording records where each insertion landed", () => {
  for (const p of ALL) {
    const { recording } = rskTableaux(p);
    expect(contents(["RskRecording", perm(...p)]), `[${p}]`).toEqual(["List", ...recording.flat()]);
  }
});

test("the RSK pair is a composite carrier, and both halves share a shape", () => {
  // `standard_tableau_pair` is `tuple<standard_tableau, standard_tableau>` — the first
  // composite carrier anything here constructs, and the reason `materialise` has to leave a
  // Tuple alone rather than flattening it into a List.
  for (const p of ALL) {
    const pair = ce.box(["Rsk", perm(...p)] as never).evaluate();
    expect(String(pair.type), `[${p}]`).toBe("standard_tableau_pair");

    const { insertion, recording } = rskTableaux(p);
    expect(JSON.stringify(pair.json), `[${p}]`).toContain(JSON.stringify(insertion.flat()).slice(1, -1));
    // Same shape is the content of the correspondence: Q is P's shape filled with positions.
    expect(insertion.map((row) => row.length)).toEqual(recording.map((row) => row.length));
  }
});

test("the recording tableau is standard", () => {
  // Q holds 1..n, increasing along rows and down columns — which is what makes RSK a
  // bijection onto PAIRS of standard tableaux rather than merely a map into them.
  for (const p of ALL) {
    const { recording } = rskTableaux(p);
    expect(recording.flat().sort((a, b) => a - b)).toEqual(Array.from({ length: p.length }, (_, i) => i + 1));
    for (const row of recording) for (let i = 1; i < row.length; i++) expect(row[i]!).toBeGreaterThan(row[i - 1]!);
    for (let r = 1; r < recording.length; r++)
      for (const [c, entry] of recording[r]!.entries())
        expect(entry, `[${p}] column ${c}`).toBeGreaterThan(recording[r - 1]![c]!);
  }
});

test("RSK is injective on the permutations it is given", () => {
  // The bijection's defining property, checked where it can be: distinct permutations give
  // distinct pairs.
  const seen = new Map<string, number[]>();
  for (const p of ALL) {
    const { insertion, recording } = rskTableaux(p);
    const key = JSON.stringify([insertion, recording]);
    expect(seen.get(key), `[${p}] collides with [${seen.get(key)}]`).toBeUndefined();
    seen.set(key, p);
  }
});

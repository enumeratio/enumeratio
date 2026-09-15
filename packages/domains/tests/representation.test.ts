import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareDomains } from "../src/declare.ts";
import { DOMAINS } from "../src/domain-data.ts";
import { declareRendering } from "../src/render.ts";
import { canonicalFor, REPRESENTATIONS, representationsFor } from "../src/representation.ts";

const ce = new ComputeEngine();
declareDomains(ce);
declareRendering(ce, Object.fromEntries(DOMAINS.map((d) => [d.type, d.name])));

const perm = (...entries: number[]): unknown => ["Permutation", ["List", ...entries]];
const text = (expr: unknown): unknown => ce.box(expr as never).evaluate().json;

function permutations(n: number): number[][] {
  if (n === 0) return [[]];
  const out: number[][] = [];
  for (const rest of permutations(n - 1))
    for (let i = 0; i <= rest.length; i++) out.push([...rest.slice(0, i), n, ...rest.slice(i)]);
  return out;
}
const ALL = [0, 1, 2, 3, 4, 5].flatMap(permutations);

test("cycle notation matches enumeratio's spelling", () => {
  // `perm_cycles` writes every cycle, fixed points included, each starting at its least
  // element, in order of least element — which is what makes it parseable without knowing n.
  expect(text(["Render", perm(2, 3, 1), "'cycle'"])).toBe("'(1 2 3)'");
  expect(text(["Render", perm(2, 1, 4, 3), "'cycle'"])).toBe("'(1 2)(3 4)'");
  expect(text(["Render", perm(1, 2, 3), "'cycle'"])).toBe("'(1)(2)(3)'");
});

test("every representation round-trips", () => {
  // A representation is a render with a parse INVERSE. If the pair is not an inverse the
  // representation is lying, and this is the only test that would notice.
  for (const representation of REPRESENTATIONS) {
    if (representation.parse === undefined) continue;
    const samples: number[][] =
      representation.on === "permutation"
        ? ALL
        : representation.on === "integer_partition"
          ? [[], [1], [3, 1], [2, 2, 1], [4, 4, 4, 2, 1, 1]]
          : [[], [1, 0], [1, 1, 0, 0], [1, 0, 1, 0]];
    for (const sample of samples) {
      const written = representation.render(sample);
      expect(
        representation.parse(written),
        `${representation.name} on [${String(sample)}]`,
      ).toEqual(sample);
    }
  }
});

test("Render and ParseAs are inverse through the engine", () => {
  for (const p of ALL.filter((q) => q.length > 0)) {
    for (const name of ["oneline", "cycle", "dense"]) {
      const written = ce.box(["Render", perm(...p), `'${name}'`] as never).evaluate();
      const back = ce.box(["ParseAs", written, "'permutation'", `'${name}'`] as never).evaluate();
      expect(back.json, `${name} [${String(p)}]`).toEqual(["Permutation", ["List", ...p]]);
    }
  }
});

test("Render reads the carrier off the value, and refuses a name from another carrier", () => {
  // The representation is looked up by (carrier, name), so asking for a partition's spelling
  // of a permutation finds nothing rather than producing nonsense.
  expect(text(["Render", perm(2, 1), "'parts'"])).not.toBe("'2 + 1'");
  expect(text(["Render", ["IntegerPartition", ["List", 3, 1]], "'parts'"])).toBe("'3 + 1'");
  expect(text(["Render", ["IntegerPartition", ["List", 3, 3, 1]], "'exponential'"])).toBe(
    "'3^2 1'",
  );
});

test("a bare Render uses the canonical representation", () => {
  expect(text(["Render", perm(2, 3, 1)])).toBe("'2 3 1'");
  expect(text(["Render", ["IntegerPartition", ["List", 3, 1]]])).toBe("'3 + 1'");
});

test("exactly one representation per carrier and medium is canonical", () => {
  const carriers = [...new Set(REPRESENTATIONS.map((r) => r.on))];
  for (const carrier of carriers) {
    const mediums = [...new Set(representationsFor(carrier).map((r) => r.medium))];
    for (const medium of mediums) {
      const canonical = representationsFor(carrier).filter(
        (r) => r.medium === medium && r.canonical === true,
      );
      expect(canonical.length, `${carrier}/${medium}`).toBe(1);
      expect(canonicalFor(carrier, medium)?.name, `${carrier}/${medium}`).toBe(canonical[0]?.name);
    }
  }
});

test("every representation names a carrier that exists", () => {
  for (const representation of REPRESENTATIONS)
    expect(
      DOMAINS.some((d) => d.type === representation.on),
      representation.on,
    ).toBe(true);
});

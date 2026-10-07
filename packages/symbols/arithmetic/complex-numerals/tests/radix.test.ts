import { describe, expect, it } from "vite-plus/test";
import { FAVORITES, NOTABLE } from "../src/examples.ts";
import { exampleOf, exampleSettings, radixExpansions, randomSettings } from "../src/radix-layer.ts";
import {
  expansions,
  formatSettings,
  isCompleteResidueSystem,
  leastResidues,
  parseSettings,
  parseValue,
  RADIX_LIMIT,
} from "../src/radix.ts";

const distinctPoints = (code: string, maxLength: number): [number, number] => {
  const s = parseSettings(code, { maxLength })!;
  const e = expansions({ ...s, maxLength });
  const seen = new Set<string>();
  for (let n = 0; n < e.count; n++) seen.add(`${Math.round(e.ab[2 * n]!)},${Math.round(e.ab[2 * n + 1]!)}`);
  return [seen.size, e.count];
};

describe("values and settings", () => {
  it("parses and prints values in both systems", () => {
    expect(parseValue("-1+i")).toEqual({ value: [-1, 1], system: "i" });
    expect(parseValue("-2-3ω")).toEqual({ value: [-2, -3], system: "ω" });
    expect(parseValue("-ω")).toEqual({ value: [0, -1], system: "ω" });
    expect(parseValue("7")).toEqual({ value: [7, 0] });
    expect(parseValue("1+")).toBeUndefined();
  });

  it("round-trips every favorite's settings sentence", () => {
    for (const f of FAVORITES) {
      const s = parseSettings(f.code, { maxLength: 3 });
      expect([f.code, s !== undefined]).toEqual([f.code, true]);
      const again = parseSettings(formatSettings(s!), { maxLength: 3 })!;
      expect(again).toEqual(s);
    }
  });
});

describe("notable systems", () => {
  it("have one digit per residue class, so their expansions are distinct points", () => {
    for (const e of NOTABLE.filter((e) => e.id !== "quater-imaginary")) {
      const s = parseSettings(e.code, { maxLength: e.maxLength })!;
      expect([e.id, isCompleteResidueSystem(s.system, s.base, s.digits)]).toEqual([e.id, true]);
      const [distinct, count] = distinctPoints(e.code, Math.min(e.maxLength, 6));
      expect([e.id, distinct]).toEqual([e.id, count]);
    }
  });

  it("quater-imaginary: digits 0–3 miss a residue class, yet stay distinct", () => {
    const s = parseSettings(NOTABLE.find((e) => e.id === "quater-imaginary")!.code, { maxLength: 5 })!;
    expect(isCompleteResidueSystem(s.system, s.base, s.digits)).toBe(false);
    const [distinct, count] = distinctPoints(formatSettings(s), 5);
    expect(distinct).toBe(count);
  });

  it("least residues are a complete system", () => {
    for (const [system, base] of [
      ["i", [-1, 1]],
      ["i", [3, 2]],
      ["ω", [3, 1]],
      ["ω", [-2, 3]],
    ] as const) {
      expect(isCompleteResidueSystem(system, base, leastResidues(system, base))).toBe(true);
    }
  });
});

describe("radix layer", () => {
  it("draws the twindragon on the lattice, and the same numerals off it", () => {
    const twindragon = exampleSettings("twindragon")!;
    const on = radixExpansions(twindragon);
    expect("points" in on).toBe(false);
    expect(on.value(0, 0, "Places")).toBe(0);
    expect(on.has(1, 0, "IsDigit")).toBe(true);
    const off = radixExpansions({ ...twindragon, onLattice: false });
    expect(off.points!().length).toBe(2 ** 12);
    // Off the lattice, element (n, 0) is the n-th numeral: n = 3 is 11, so 1 + β.
    expect(off.describe(3, 0).title).toBe("i");
  });

  it("names the example its settings are, and 'Custom' once edited", () => {
    const gosper = exampleSettings("gosper-island")!;
    expect(exampleOf(gosper)).toBe("gosper-island");
    expect(exampleOf({ ...gosper, digits: gosper.digits.slice(1) })).toBe("Custom");
    expect(exampleOf({ ...gosper, onLattice: false })).toBe("Custom");
  });

  it("draws random systems with one digit per residue class, within the point budget", () => {
    for (let k = 0; k < 10; k++) {
      const s = randomSettings();
      const layer = radixExpansions(s);
      expect(layer.has(0, 0, "Overlaps")).toBe(false);
      expect((s.digits.length + 1) ** s.places).toBeLessThanOrEqual(RADIX_LIMIT);
    }
  });
});

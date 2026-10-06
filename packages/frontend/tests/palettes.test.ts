import { describe, expect, it } from "vite-plus/test";
import {
  bandPosition,
  deltaE,
  discreteColors,
  GRADIENTS,
  GROUNDS,
  hexToRgb,
  PALETTES,
  resolvePalette,
  rgbToOklab,
  sampleGradient,
} from "../src/palettes.ts";

const HEX = /^#[0-9a-f]{6}$/;
const lab = (hex: string) => rgbToOklab(hexToRgb(hex));

describe("gradients", () => {
  it("hit their own stops", () => {
    for (const g of GRADIENTS) {
      expect(sampleGradient(g, 0)).toBe(g.stops[0]!.color);
      expect(sampleGradient(g, 1)).toBe(g.stops.at(-1)!.color);
      for (const t of [0.1, 0.37, 0.5, 0.93]) expect(sampleGradient(g, t)).toMatch(HEX);
    }
  });

  it("close up when cyclic", () => {
    for (const g of GRADIENTS.filter((g) => g.cyclic)) {
      expect(deltaE(lab(sampleGradient(g, 0.999)), lab(sampleGradient(g, 0)))).toBeLessThan(0.02);
    }
  });
});

describe("bands", () => {
  it("reflect: 0 at even multiples of the band, 1 at odd ones, no seam", () => {
    expect(bandPosition(0, 10, "reflect")).toBe(0);
    expect(bandPosition(10, 10, "reflect")).toBe(1);
    expect(bandPosition(20, 10, "reflect")).toBe(0);
    expect(bandPosition(5, 10, "reflect")).toBeCloseTo(0.5);
    expect(bandPosition(15, 10, "reflect")).toBeCloseTo(0.5);
  });

  it("wrap and clamp", () => {
    expect(bandPosition(15, 10, "wrap")).toBeCloseTo(0.5);
    expect(bandPosition(25, 10, "clamp")).toBe(1);
  });
});

describe("palettes", () => {
  it("name a ground, gradient and discrete scheme that exist", () => {
    for (const spec of PALETTES) {
      const p = resolvePalette({ palette: spec.name });
      expect(p.gradient.name).toBe(spec.gradient);
      expect(p.discrete.name).toBe(spec.discrete);
      expect(GROUNDS.some((g) => g.background === p.background)).toBe(true);
    }
  });

  it("take overrides part by part", () => {
    const p = resolvePalette({ palette: "dusk", gradient: "viridis", reverse: true });
    expect(p.background).toBe(resolvePalette({ palette: "dusk" }).background);
    expect(sampleGradient(p.gradient, 0)).toBe("#fde725");
  });

  it("generate discrete colors far from the gradient and from each other", () => {
    for (const name of ["dusk", "viridis", "magma", "paper"]) {
      const p = resolvePalette({ palette: name, discrete: "glasbey" });
      const colors = discreteColors(p, 4);
      expect(colors).toHaveLength(4);
      const ramp = Array.from({ length: 32 }, (_, k) => lab(sampleGradient(p.gradient, k / 31)));
      for (const c of colors) {
        expect(c).toMatch(HEX);
        // Measured: every pick on these palettes clears 0.08 in OKLab, a difference at a glance.
        expect(Math.min(...ramp.map((r) => deltaE(lab(c), r)))).toBeGreaterThan(0.08);
      }
      for (let i = 0; i < colors.length; i++) {
        for (let j = i + 1; j < colors.length; j++)
          expect(deltaE(lab(colors[i]!), lab(colors[j]!))).toBeGreaterThan(0.1);
      }
    }
  });
});

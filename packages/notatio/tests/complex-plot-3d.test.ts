import { ComputeEngine } from "@cortex-js/compute-engine";
import { parseNotatio } from "@enumeratio/formats/notatio";
import { expect, test } from "vite-plus/test";
import { emitComplexWGSL } from "@enumeratio/analytic/src";
import { complexComputeShader } from "../src/gpu-eval.ts";
import {
  complexFunction,
  complexGrid,
  complexSurfaceOf,
  complexSurfaceSvg,
  faceHue,
  hueOf,
  parseComplexDomain,
  sampleComplexSurface,
} from "../src/complex-plot-3d.ts";

const ce = new ComputeEngine();

/** The compiled function of a notatio expression in `z`. */
const fn = (src: string) => {
  const { json, errors } = parseNotatio(src);
  expect(errors).toEqual([]);
  const f = complexFunction(ce.box(json).json, "z");
  expect(f, src).toBeDefined();
  return f!;
};

const near = (a: readonly [number, number], b: readonly [number, number], digits = 9): void => {
  expect(a[0]).toBeCloseTo(b[0], digits);
  expect(a[1]).toBeCloseTo(b[1], digits);
};

test("the elementary operations evaluate as complex numbers", () => {
  near(fn("z^2 + 1")([0, 1]), [0, 0]);
  near(fn("1/(z^2 + 1)")([1, 0]), [0.5, 0]);
  near(fn("Exp(i * Pi)")([0, 0]), [-1, 0]);
  near(fn("Sqrt(z)")([-1, 0]), [0, 1]);
  near(fn("Sin(z)")([0, 1]), [0, Math.sinh(1)]);
  near(fn("Conjugate(z) * z")([3, 4]), [25, 0]);
  near(fn("z^(1/2)")([0, 2]), [1, 1]);
});

test("the special functions reach the analytic kernels", () => {
  near(fn("Gamma(z)")([5, 0]), [24, 0], 6);
  near(fn("Gamma(z)")([0.5, 0]), [Math.sqrt(Math.PI), 0], 6);
  near(fn("Zeta(z)")([2, 0]), [Math.PI ** 2 / 6, 0], 6);
  near(fn("PolyLog(2, z)")([1, 0]), [Math.PI ** 2 / 6, 0], 5);
});

test("what has no complex lowering is refused rather than guessed", () => {
  const { json } = parseNotatio("Sin(z) + w");
  expect(complexFunction(ce.box(json).json, "z")).toBeUndefined();
  expect(complexFunction(ce.box(parseNotatio("Floor(z)").json).json, "z")).toBeUndefined();
});

test("hue is the argument on a wheel, 0 at the positive real axis", () => {
  expect(hueOf([1, 0])).toBe(0);
  expect(hueOf([0, 1])).toBeCloseTo(0.25);
  expect(hueOf([-1, 0])).toBeCloseTo(0.5);
  expect(hueOf([0, -1])).toBeCloseTo(0.75);
  expect(hueOf([Number.NaN, 0])).toBeNaN();
});

test("a face across the branch cut takes the hue between its corners, not opposite them", () => {
  // Corners just above and below the negative real axis: 0.49 and 0.51 average to 0.5;
  // the same pair spelled 0.99 and 0.01 must also land at 0, not 0.5.
  expect(faceHue([0.49, 0.51, 0.49, 0.51])).toBeCloseTo(0.5);
  expect(faceHue([0.99, 0.01, 0.99, 0.01])).toBeCloseTo(0, 6);
  expect(faceHue([Number.NaN, Number.NaN])).toBeNaN();
});

test("the surface is |f| clipped at the ceiling, with a hue per sample", () => {
  const s = sampleComplexSurface(fn("1/(z^2 + 1)"), {
    domain: [-2, 2, -2, 2],
    samples: 5,
    maxHeight: 3,
  });
  expect(s.xs).toEqual([-2, -1, 0, 1, 2]);
  expect(s.ys).toEqual([-2, -1, 0, 1, 2]);
  expect(s.heights[2][2]).toBe(1); // z = 0: f = 1
  expect(s.heights[3][2]).toBe(3); // z = i is a pole: clipped
  expect(s.heights.flat().every((h) => h <= 3)).toBe(true);
  expect(s.hues[2][2]).toBe(0); // f(0) = 1 is on the positive real axis
  expect(s.hues.flat().every((h) => Number.isNaN(h) || (h >= 0 && h < 1))).toBe(true);
});

test("a sampler that throws leaves a hole rather than failing the surface", () => {
  const s = sampleComplexSurface(
    (z) => {
      if (z[0] === 0 && z[1] === 0) throw new Error("no");
      return z;
    },
    { samples: 3 },
  );
  expect(s.heights[1][1]).toBeNaN();
  expect(s.heights[0][0]).toBeCloseTo(Math.hypot(2, 2));
});

test("the domain attribute is four ordered numbers", () => {
  expect(parseComplexDomain("-2,2,-2,2")).toEqual([-2, 2, -2, 2]);
  expect(parseComplexDomain(" -1, 1 , 0, 3 ")).toEqual([-1, 1, 0, 3]);
  expect(parseComplexDomain("2,-2,-2,2")).toBeUndefined();
  expect(parseComplexDomain("1,2,3")).toBeUndefined();
  expect(parseComplexDomain(undefined)).toBeUndefined();
});

test("the SVG paints one hue-filled face per cell", () => {
  const s = sampleComplexSurface(fn("z"), { samples: 4 });
  const svg = complexSurfaceSvg(s, { axes: false });
  const faces = svg.match(/<polygon[^>]*fill="hsl\(/g) ?? [];
  expect(faces.length).toBe(3 * 3);
  // z itself: arg on the positive real axis is hue 0 -- red -- and the face just
  // above the axis on the right leans that way.
  expect(svg).toContain('viewBox="0 0 360 260"');
});

test("a GPU value buffer colours the same way as the CPU sampler", () => {
  const f = fn("z^2");
  const { xs, ys } = complexGrid({ domain: [-1, 1, -1, 1], samples: 3 });
  const values = new Float32Array(xs.length * ys.length * 2);
  ys.forEach((y, j) =>
    xs.forEach((x, i) => {
      const [re, im] = f([x, y]);
      values[(j * xs.length + i) * 2] = re;
      values[(j * xs.length + i) * 2 + 1] = im;
    }),
  );
  const gpu = complexSurfaceOf(values, xs, ys, 4);
  const cpu = sampleComplexSurface(f, { domain: [-1, 1, -1, 1], samples: 3 });
  expect(gpu.heights).toEqual(cpu.heights);
  expect(gpu.hues).toEqual(cpu.hues);
});

test("the complex compute shader binds the grid and the literal slots", () => {
  const { json } = parseNotatio("1/(z^2 + 1)");
  const emitted = emitComplexWGSL(ce.box(json).json as never, "z");
  expect(emitted).toBeDefined();
  const code = complexComputeShader("z", emitted!.code);
  expect(code).toContain("let z = vec2f(");
  expect(code).toContain("array<vec2f>");
  expect(code).toContain("prm.p[0].xy");
  expect(code).toContain("fn cdiv");
});

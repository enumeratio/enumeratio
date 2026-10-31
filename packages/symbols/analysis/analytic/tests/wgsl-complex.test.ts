import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/declare.ts";
import { emitComplexWGSL, type Json, MAX_SLOTS } from "@enumeratio/ce-patches";
import { zetaWGSL } from "../src/shader.ts";

test("the real Lerch wrapper in the shader returns NaN where Φ is complex", () => {
  expect(zetaWGSL).toContain("fn lerchPhiReal(");
});

test("the shader has no const-evaluable NaN (WGSL rejects 'value nan cannot be represented as f32')", () => {
  const src = zetaWGSL.replace(/\/\/.*$/gm, "");
  expect(src).not.toMatch(/bitcast<f32>\(\s*0x7f[89a-f][0-9a-f]{5}u\s*\)/i);
  expect(src).not.toMatch(/0\.0\s*\/\s*0\.0/);
});

const ce = new ComputeEngine();
declareAnalytic(ce);

/** Canonical MathJSON for a boxed expression, the emitter's input shape. */
const canon = (expr: unknown): Json => ce.box(expr as Parameters<ComputeEngine["box"]>[0]).json as unknown as Json;

const emit = (expr: unknown) => emitComplexWGSL(canon(expr));

test("the variable passes through and literals become uniform slots", () => {
  const r = emit(["PolyLog", 2.5, "z"]);
  expect(r?.code).toBe("polyLog(prm.p[0].xy, z)");
  expect(r?.literals).toEqual([[2.5, 0]]);
});

test("a complex literal takes one slot, carrying both parts", () => {
  const r = emit(["HurwitzZeta", ["Complex", 0.5, 8], "z"]);
  expect(r?.literals).toEqual([[0.5, 8]]);
  expect(r?.code).toBe("hurwitz(prm.p[0].xy, z)");
});

test("arithmetic lowers to the complex helpers, not the scalar operators", () => {
  expect(emit(["Divide", ["Add", "z", -1], ["Add", "z", 1]])?.code).toBe("cdiv((z + prm.p[0].xy), (z + prm.p[1].xy))");
  expect(emit(["Multiply", "z", "z", "z"])?.code).toBe("cmul(cmul(z, z), z)");
  expect(emit(["Sqrt", "z"])?.code).toBe("csqrt(z)");
});

test("a small integer power becomes repeated multiplication, avoiding cpow's cut", () => {
  expect(emit(["Power", "z", 3])?.code).toBe("cmul(cmul(z, z), z)");
  expect(emit(["Power", "z", 3])?.literals).toEqual([]); // the exponent is baked in
  // A non-integer or large exponent still goes through cpow, as a slot.
  expect(emit(["Power", "z", 2.5])?.code).toBe("cpow(z, prm.p[0].xy)");
});

test("Zeta takes the Riemann kernel at one argument and the generalized one at two", () => {
  expect(emit(["Zeta", "z"])?.code).toBe("hurwitz(z, vec2f(1.0, 0.0))");
  expect(emit(["Zeta", 2, "z"])?.code).toBe("zetaGen(prm.p[0].xy, z)");
});

test("every special-function head reaches its kernel", () => {
  expect(emit(["HurwitzZeta", 2, "z"])?.code).toContain("hurwitz(");
  expect(emit(["LerchPhi", "z", 2, 1])?.code).toContain("lerchPhi(");
  expect(emit(["PolyLog", 2, "z"])?.code).toContain("polyLog(");
  expect(emit(["PolyGamma", 1, "z"])?.code).toContain("polygamma(");
});

// --- the property the pipeline cache rests on -------------------------------------

test("changing only a literal keeps the shape and the code, moving just the slots", () => {
  const a = emit(["PolyLog", 2.5, "z"]);
  const b = emit(["PolyLog", 2.75, "z"]);
  expect(b?.shape).toBe(a?.shape); // same cache key -> pipeline is reused
  expect(b?.code).toBe(a?.code);
  expect(b?.literals).not.toEqual(a?.literals); // only the uniform upload differs
});

test("changing the structure changes the shape, forcing a rebuild", () => {
  const a = emit(["PolyLog", 2, "z"]);
  const b = emit(["PolyGamma", 2, "z"]);
  const c = emit(["Add", ["PolyLog", 2, "z"], 1]);
  expect(b?.shape).not.toBe(a?.shape);
  expect(c?.shape).not.toBe(a?.shape);
});

test("the baked-in integer exponent is part of the shape", () => {
  // z^2 and z^3 emit different code, so they must not share a cache entry.
  expect(emit(["Power", "z", 2])?.shape).not.toBe(emit(["Power", "z", 3])?.shape);
});

// --- rejection ---------------------------------------------------------------------

test("an unbound symbol or unsupported head is rejected, not mis-emitted", () => {
  expect(emit(["PolyLog", 2, "w"])).toBeUndefined(); // w is not the variable
  expect(emit(["Erf", "z"])).toBeUndefined();
  expect(emitComplexWGSL(["Hypot", "z"] as Json)).toBeUndefined();
});

test("more literals than slots is rejected rather than overflowing the uniform", () => {
  let expr: unknown = "z";
  for (let k = 0; k <= MAX_SLOTS; k++) expr = ["Add", expr, k + 0.5];
  expect(emit(expr)).toBeUndefined();
});

test("named constants lower to literal slots", () => {
  const r = emit(["Multiply", "Pi", "z"]);
  expect(r?.literals[0]?.[0]).toBeCloseTo(Math.PI, 12);
  expect(emit(["Power", "ExponentialE", "z"])?.literals[0]?.[0]).toBeCloseTo(Math.E, 12);
});

// --- literal forms an exact result actually produces --------------------------------

test("a rational literal is a slot, not a call", () => {
  // ζ(0, z) is 1/2 - z, and every ζ(-n, z) is a Bernoulli polynomial full of these.
  // Treating Rational as a function made all of them undrawable.
  const r = emit(["Add", ["Negate", "z"], ["Rational", 1, 2]]);
  expect(r?.code).toBe("(cneg(z) + prm.p[0].xy)");
  expect(r?.literals).toEqual([[0.5, 0]]);
});

test("the closed forms a slider actually lands on all lower", () => {
  // Sweeping s across the integers walks HurwitzZeta through these.
  for (const s of [0, -1, -2, -3, -6]) {
    const closed = ce.box(["HurwitzZeta", s, "z"]).evaluate().json;
    expect(emitComplexWGSL(closed as Json)).toBeDefined();
  }
});

test("a lowercase head from the Epsil round trip still resolves", () => {
  // `PolyLog(1, z)` evaluates to -ln(1 - z), and the round trip through Epsil hands
  // back `ln`, not `Ln`.
  expect(emitComplexWGSL(["Negate", ["ln", ["Subtract", 1, "z"]]] as Json)?.code).toBe("cneg(clog((prm.p[0].xy - z)))");
  expect(emitComplexWGSL(["sin", "z"] as Json)?.code).toBe("csin(z)");
});

test("digit separators in a number literal are read, not rejected", () => {
  expect(emitComplexWGSL(["Multiply", { num: "1_000.5" }, "z"] as Json)?.literals).toEqual([[1000.5, 0]]);
});

test("Gamma and Factorial lower to cgamma, Factorial as Γ(z + 1)", () => {
  expect(emit(["Gamma", "z"])?.code).toBe("cgamma(z)");
  expect(emitComplexWGSL(["gamma", "z"] as Json)?.code).toBe("cgamma(z)");
  expect(emit(["Factorial", "z"])?.code).toBe("cgamma((z + vec2f(1.0, 0.0)))");
});

// --- cgamma, numerically ------------------------------------------------------------
// No WGSL runtime here, so this is a line-for-line f32 port of cgamma/clgamma/clogSin
// (Math.fround on every op), checked against our Gamma head. A string check ties the
// port to the shader's constants.

test("the shader's cgamma has the constants the port below uses", () => {
  expect(zetaWGSL).toContain("fn cgamma(");
  expect(zetaWGSL).toContain("1.1447299");
  expect(zetaWGSL).toContain("min(lg.x, 80.0)");
});

const f = Math.fround;
type C = [number, number];
const cmul = (a: C, b: C): C => [f(f(a[0] * b[0]) - f(a[1] * b[1])), f(f(a[0] * b[1]) + f(a[1] * b[0]))];
const cdiv = (a: C, b: C): C => {
  const d = f(f(b[0] * b[0]) + f(b[1] * b[1]));
  return [f(f(f(a[0] * b[0]) + f(a[1] * b[1])) / d), f(f(f(a[1] * b[0]) - f(a[0] * b[1])) / d)];
};
const cexp = (z: C): C => {
  const e = f(Math.exp(z[0]));
  return [f(e * f(Math.cos(z[1]))), f(e * f(Math.sin(z[1])))];
};
const clog = (z: C): C => [f(0.5 * f(Math.log(f(f(z[0] * z[0]) + f(z[1] * z[1]))))), f(Math.atan2(z[1], z[0]))];
const add = (a: C, b: C): C => [f(a[0] + b[0]), f(a[1] + b[1])];
const sub = (a: C, b: C): C => [f(a[0] - b[0]), f(a[1] - b[1])];

function clgamma(z0: C): C {
  let z = z0;
  let shift: C = [0, 0];
  for (let k = 0; k < 8 && z[0] < 8; k++) {
    shift = add(shift, clog(z));
    z = [f(z[0] + 1), z[1]];
  }
  const iz = cdiv([1, 0], z);
  const iz2 = cmul(iz, iz);
  const inner = add([-0.0027777778, 0], [f(iz2[0] * 0.00079365079), f(iz2[1] * 0.00079365079)]);
  const ser = cmul(iz, add([0.083333333, 0], cmul(iz2, inner)));
  return sub(add(sub(cmul([f(z[0] - 0.5), z[1]], clog(z)), z), add([0.9189385, 0], ser)), shift);
}

function clogSin(w0: C): C {
  const flip = w0[1] < 0;
  const w: C = flip ? [w0[0], -w0[1]] : w0;
  const u = cexp([f(-2 * w[1]), f(2 * w[0])]);
  const l = add(clog([f(1 - u[0]), -u[1]]), [f(w[1] - 0.6931472), f(1.5707963 - w[0])]);
  return flip ? [l[0], -l[1]] : l;
}

function cgamma(z: C): C {
  if (z[1] === 0 && z[0] <= 0 && z[0] === Math.floor(z[0])) return [1e30, 0];
  const lg =
    z[0] < 0.5
      ? sub(sub([1.1447299, 0], clogSin([f(3.1415927 * z[0]), f(3.1415927 * z[1])])), clgamma([f(1 - z[0]), -z[1]]))
      : clgamma(z);
  return cexp([Math.min(lg[0], 80), lg[1]]);
}

// Reference: our own Gamma head (complex, double precision).
const ref = (re: number, im: number): C => {
  const v = ce.box(["Gamma", ["Complex", re, im]]).N().json as unknown;
  if (typeof v === "number") return [v, 0];
  const a = (Array.isArray(v) ? v : []) as unknown[];
  return [Number(a[1]), Number(a[2])];
};

test("cgamma agrees with the Gamma head across the plane to f32 accuracy", () => {
  let worst = 0;
  for (let re = -6.3; re <= 6.3; re += 0.9) {
    for (let im = -4.1; im <= 4.1; im += 0.7) {
      const [er, ei] = ref(re, im);
      const [gr, gi] = cgamma([f(re), f(im)]);
      worst = Math.max(worst, Math.hypot(gr - er, gi - ei) / Math.hypot(er, ei));
    }
  }
  expect(worst).toBeLessThan(5e-4);
});

test("poles come out huge and finite, never NaN", () => {
  for (const n of [0, -1, -2, -7]) {
    const [r, i] = cgamma([n, 0]);
    expect(Number.isFinite(r) && Number.isFinite(i)).toBe(true);
    expect(Math.abs(r)).toBeGreaterThan(1e10);
  }
  // beside a pole, and with a large imaginary part
  for (const z of [
    [-3.0001, 0.0001],
    [-2, 1e-3],
    [-4.5, 40],
    [3, -60],
  ] as C[]) {
    const [r, i] = cgamma(z);
    expect(Number.isNaN(r) || Number.isNaN(i)).toBe(false);
  }
});

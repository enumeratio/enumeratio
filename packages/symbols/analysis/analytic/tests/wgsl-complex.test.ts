import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";
import { emitComplexWGSL, type Json, MAX_SLOTS } from "../src/wgsl-complex.ts";

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
  expect(emitComplexWGSL(["Factorial", "z"] as Json)).toBeUndefined();
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

test("a lowercase head from the notatio round trip still resolves", () => {
  // `PolyLog(1, z)` evaluates to -ln(1 - z), and the round trip through notatio hands
  // back `ln`, not `Ln`.
  expect(emitComplexWGSL(["Negate", ["ln", ["Subtract", 1, "z"]]] as Json)?.code).toBe("cneg(clog((prm.p[0].xy - z)))");
  expect(emitComplexWGSL(["sin", "z"] as Json)?.code).toBe("csin(z)");
});

test("digit separators in a number literal are read, not rejected", () => {
  expect(emitComplexWGSL(["Multiply", { num: "1_000.5" }, "z"] as Json)?.literals).toEqual([[1000.5, 0]]);
});

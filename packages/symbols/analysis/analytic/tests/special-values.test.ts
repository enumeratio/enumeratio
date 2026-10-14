// unstable: a test constructs its own engine
import { ComputeEngine } from "@enumeratio/engine/unstable";
import type { Expr, Json } from "@enumeratio/engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/declare.ts";

// Exact values and big-precision paths for AiryAi/Bi, EllipticK/E, Hypergeometric1F1/2F1,
// DedekindEta and Series at a directed infinity. Reference values are mpmath 1.3.0 at 50 digits.

const ce = new ComputeEngine();
declareAnalytic(ce);

const N = (json: Json, digits?: number): Expr =>
  digits === undefined ? ce.box(json).N() : ce.box(["N", json, digits]).evaluate();

test("Airy functions at 0 are exact, and agree with mpmath", () => {
  const values = {
    AiryAi: 0.3550280538878172,
    AiryAiPrime: -0.2588194037928067,
    AiryBi: 0.6149266274460007,
    AiryBiPrime: 0.4482883573538263,
  };
  for (const [head, value] of Object.entries(values)) {
    const exact = ce.box([head, 0]).evaluate();
    expect(exact.operator, head).not.toBe(head);
    expect(Math.abs(N([head, 0]).re - value), head).toBeLessThan(1e-15);
  }
  // a float 0 stays on the numeric kernel
  expect(ce.box(["AiryAi", 0.0]).N().re).toBeCloseTo(0.3550280538878172, 14);
});

test("Series of Airy at 0 carries the closed-form coefficients", () => {
  const series = ce.box(["Series", ["AiryAi", "x"], "x", 0, 4]).evaluate();
  expect(series.toString()).not.toContain("AiryAi");
  expect(series.toString()).toContain("Gamma");
});

test("a hypergeometric whose lower parameter cancels an upper one reduces", () => {
  expect(ce.box(["Hypergeometric1F1", 1, 1, 1]).evaluate().operator).not.toBe("Hypergeometric1F1");
  expect(N(["Hypergeometric1F1", 1, 1, 1]).re).toBeCloseTo(Math.E, 14);
  expect(N(["Hypergeometric1F1", ["Rational", 1, 3], ["Rational", 1, 3], 2]).re).toBeCloseTo(Math.exp(2), 12);
  // 2F1(1/2, 1; 1; 1/2) = (1 − 1/2)^(−1/2) = √2, whichever upper parameter the lower one matches
  expect(N(["Hypergeometric2F1", ["Rational", 1, 2], 1, 1, ["Rational", 1, 2]]).re).toBeCloseTo(Math.SQRT2, 14);
  expect(N(["Hypergeometric2F1", 1, ["Rational", 1, 2], 1, ["Rational", 1, 2]]).re).toBeCloseTo(Math.SQRT2, 14);
  // a different lower parameter is left to the kernel
  expect(ce.box(["Hypergeometric2F1", 1, 2, 3, ["Rational", 1, 2]]).evaluate().operator).toBe("Hypergeometric2F1");
});

test("FunctionExpand writes K and E at m = -1 and 1/2 in Gamma(1/4), and K' through them", () => {
  const value = (json: Json) => N(["FunctionExpand", json]).re;
  expect(value(["EllipticK", -1])).toBeCloseTo(1.311028777146059, 14);
  expect(value(["EllipticK", ["Rational", 1, 2]])).toBeCloseTo(1.854074677301371, 14);
  expect(value(["EllipticE", -1])).toBeCloseTo(1.910098894513856, 14);
  expect(value(["EllipticE", ["Rational", 1, 2]])).toBeCloseTo(1.350643881047675, 14);
  expect(
    ce
      .box(["FunctionExpand", ["EllipticK", -1]])
      .evaluate()
      .toString(),
  ).toContain("Gamma");
  const prime = ce.box(["FunctionExpand", ["Apply", ["Derivative", "EllipticK", 1], -1]]).evaluate();
  expect(prime.toString()).not.toContain("Derivative");
  expect(prime.N().re).toBeCloseTo(0.1779896649445659, 14);
});

test("FunctionExpand rotates Ai and Bi by a cube root of unity (DLMF 9.2.11-12)", () => {
  const z = { re: 0.7, im: 0.3 };
  const at = (json: Json) =>
    ce
      .box(json)
      .subs({ z: ce.complex(z.re, z.im) })
      .N();
  const omega: Json = ["Exp", ["Divide", ["Multiply", 2, "Pi", "ImaginaryUnit"], 3]];
  const omegaBar: Json = ["Exp", ["Divide", ["Multiply", -2, "Pi", "ImaginaryUnit"], 3]];
  const expected: [string, Json, [number, number]][] = [
    ["AiryAi", omega, [0.527759569505618, -0.0893263386193899]],
    ["AiryAi", omegaBar, [0.3806815157321667, 0.2237364782416832]],
    ["AiryBi", omega, [0.3462969098893705, 0.240444894047673]],
    ["AiryBi", omegaBar, [0.601043571703335, -0.3017958107163362]],
  ];
  for (const [head, rotation, [re, im]] of expected) {
    const expanded = ce.box(["FunctionExpand", [head, ["Multiply", "z", rotation]]]).evaluate();
    // the rotation is gone: only Ai(z) and Bi(z) remain
    expect(expanded.toString()).not.toMatch(/(Ai|Bi)\([^)]*[Pp]i/);
    const value = at(expanded.json);
    expect(value.re, `${head} re`).toBeCloseTo(re, 12);
    expect(value.im, `${head} im`).toBeCloseTo(im, 12);
  }
});

test("DedekindEta at 50 digits, and at a real part too large for a double to reduce", () => {
  const parts = (x: Expr) => [String(x.bignumRe), String(x.bignumIm)];
  const first = parts(N(["DedekindEta", ["Complex", ["Rational", 12, 5], 1]], 50));
  expect(first[0]).toMatch(/^0\.6241075332982266589977636913796830788382303084/);
  expect(first[1]).toMatch(/^0\.4523995563297724898399072629164014757547986371/);
  const huge = parts(N(["DedekindEta", ["Add", ["Complex", 0, 1], ["Power", 10, 22]]], 20));
  expect(huge[0]).toMatch(/^-0\.3841127111630283295/);
  expect(huge[1]).toMatch(/^-0\.66530273156739412621/);
});

test("Series about a directed infinity stays unevaluated", () => {
  const series = ce.box(["Series", ["AiryBi", "x"], "x", ["DirectedInfinity", "z"], 1]).evaluate();
  expect(series.operator).toBe("Series");
});

test("EllipticK derivatives at 0 are exact, and agree with mpmath", () => {
  // mpmath 1.3.0: n! · [m^n] ellipk(m)
  const mpmath = [0.39269908169872414, 0.44178646691106466, 0.9203884727313847, 2.818689697739866];
  mpmath.forEach((value, i) => {
    const derivative = ce.box(["Apply", ["Derivative", "EllipticK", i + 1], 0]).evaluate();
    expect(derivative.toString(), `K^(${i + 1})(0)`).not.toContain("Derivative");
    expect(Math.abs(derivative.N().re - value), `K^(${i + 1})(0)`).toBeLessThan(1e-14);
  });
  // any other point stays the inert call
  expect(
    ce
      .box(["Apply", ["Derivative", "EllipticK", 1], "m"])
      .evaluate()
      .toString(),
  ).toContain("Derivative");
});

test("Series of EllipticK at 0 carries the closed-form coefficients", () => {
  const series = ce.box(["Series", ["EllipticK", "m"], "m", 0, 3]).evaluate();
  expect(series.toString()).not.toContain("Derivative");
  // π/2 + πm/8 + 9πm²/128 + 25πm³/512: mpmath's Taylor coefficients of ellipk, over π
  const json = JSON.stringify(series.json);
  for (const [n, d] of [
    [1, 2],
    [1, 8],
    [9, 128],
    [25, 512],
  ])
    expect(json).toContain(`"Rational",${n},${d}`);
});

test("Series of a non-terminating 2F1 at 1 stays unevaluated, a terminating one expands", () => {
  // 2F1(2, 3; 4; x) diverges like 1/(1−x) (c−a−b = −1), so it has no Taylor series at 1
  expect(ce.box(["Series", ["Hypergeometric2F1", 2, 3, 4, "x"], "x", 1, 3]).evaluate().operator).toBe("Series");
  expect(ce.box(["Series", ["Hypergeometric2F1", -2, 3, 4, "x"], "x", 1, 2]).evaluate().operator).not.toBe("Series");
});

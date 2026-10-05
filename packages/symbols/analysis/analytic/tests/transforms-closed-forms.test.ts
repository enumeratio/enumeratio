// unstable: a bare engine to declare the analytic library against
import { ComputeEngine } from "@enumeratio/engine/unstable";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/declare.ts";

// The log, 1/t, quadratic-denominator, Hankel and inverse-Mellin rules (see transforms.ts,
// hankel-transform.ts, mellin-transform.ts). Each is checked at a numeric point against the
// closed form Wolfram answers (the oracle scan agrees with these on the reference rows), so
// the test pins the value and not how it happens to be spelled.

const ce = new ComputeEngine();
declareAnalytic(ce);

/** The transform evaluated, then its free symbols replaced by numbers. */
const at = (mj: unknown, point: Record<string, number>): number =>
  ce
    .box(mj as never)
    .evaluate()
    .subs(point as never)
    .N().re;

const closeTo = (actual: number, expected: number) => expect(actual).toBeCloseTo(expected, 10);
const held = (mj: unknown, head: string) => expect(ce.box(mj as never).evaluate().operator).toBe(head);

const exp = (x: unknown) => ["Exp", x];
const L = (f: unknown) => ["LaplaceTransform", f, "t", "s"];
const IL = (F: unknown) => ["InverseLaplaceTransform", F, "s", "t"];

test("Laplace: division by t integrates the transform from s", () => {
  closeTo(at(L(["Divide", ["Add", exp("t"), -1], "t"]), { s: 3 }), Math.log(3 / 2));
  closeTo(at(L(["Divide", ["Sin", ["Multiply", 3, "t"]], "t"]), { s: 2 }), Math.atan(3 / 2));
  closeTo(
    at(L(["Divide", ["Add", 1, ["Negate", ["Cos", ["Multiply", 2, "t"]]]], "t"]), { s: 1.5 }),
    Math.log((1.5 ** 2 + 4) / 1.5 ** 2) / 2,
  );
  closeTo(at(L(["Divide", ["Sinh", ["Multiply", 2, "t"]], "t"]), { s: 3 }), Math.log(5) / 2);
  closeTo(at(L(["Divide", ["Add", ["Cosh", "t"], -1], "t"]), { s: 3 }), Math.log(3 / Math.sqrt(8)));
});

test("Laplace: division by t declines where the integral diverges or the term is unknown", () => {
  held(L(["Divide", 1, "t"]), "LaplaceTransform");
  held(L(["Divide", exp("t"), "t"]), "LaplaceTransform");
  held(L(["Divide", ["Cos", "t"], "t"]), "LaplaceTransform");
  held(L(["Divide", ["Sin", ["Power", "t", 2]], "t"]), "LaplaceTransform");
});

test("Laplace: t^n ln t", () => {
  const gamma = 0.5772156649015329;
  closeTo(at(L(["Ln", "t"]), { s: 2 }), -(gamma + Math.log(2)) / 2);
  // d/dn of Γ(n+1)/s^(n+1) at n = 2: 2·(ψ(3) - ln s)/s³, ψ(3) = 3/2 - γ
  closeTo(at(L(["Multiply", ["Power", "t", 2], ["Ln", "t"]]), { s: 2 }), (2 * (1.5 - gamma - Math.log(2))) / 8);
});

test("InverseLaplace: ratios of linear and quadratic factors under a logarithm", () => {
  const f = (mj: unknown, point: Record<string, number>) => at(IL(mj), point);
  const point = { a: 1.3, b: 0.7, t: 0.9 };
  const { a, b, t } = point;
  closeTo(
    f(["Ln", ["Divide", ["Add", "a", "s"], ["Add", "b", "s"]]], point),
    (-Math.exp(-a * t) + Math.exp(-b * t)) / t,
  );
  closeTo(
    f(
      ["Ln", ["Divide", ["Add", ["Power", "s", 2], ["Power", "a", 2]], ["Add", ["Power", "s", 2], ["Power", "b", 2]]]],
      point,
    ),
    (2 * (-Math.cos(a * t) + Math.cos(b * t))) / t,
  );
  closeTo(
    f(["Ln", ["Divide", ["Add", ["Power", "s", 2], 1], ["Add", ["Power", "s", 2], 2]]], { t: 0.9 }),
    (2 * (-Math.cos(0.9) + Math.cos(Math.SQRT2 * 0.9))) / 0.9,
  );
  // a lone logarithm grows without bound
  held(IL(["Ln", "s"]), "InverseLaplaceTransform");
  held(IL(["Ln", ["Divide", ["Add", ["Power", "s", 2], "a"], ["Add", "s", 1]]]), "InverseLaplaceTransform");
});

test("InverseLaplace: rational functions with quadratic factors", () => {
  const point = { a: 1.3, b: 0.7, t: 0.9 };
  const { a, b, t } = point;
  const quad = (k: unknown) => ["Add", ["Power", "s", 2], k];
  closeTo(at(IL(["Divide", "s", ["Power", quad(["Power", "a", 2]), 2]]), point), (t * Math.sin(a * t)) / (2 * a));
  closeTo(
    at(IL(["Divide", 1, ["Power", quad(["Power", "a", 2]), 2]]), point),
    (Math.sin(a * t) - a * t * Math.cos(a * t)) / (2 * a ** 3),
  );
  closeTo(
    at(IL(["Divide", ["Power", "s", 2], ["Power", quad(["Power", "a", 2]), 2]]), point),
    (Math.sin(a * t) + a * t * Math.cos(a * t)) / (2 * a),
  );
  closeTo(
    at(IL(["Divide", ["Power", "s", 3], ["Power", quad(["Power", "a", 2]), 2]]), point),
    Math.cos(a * t) - (a * t * Math.sin(a * t)) / 2,
  );
  closeTo(
    at(IL(["Divide", "s", ["Multiply", quad(["Power", "a", 2]), quad(["Power", "b", 2])]]), point),
    (-Math.cos(a * t) + Math.cos(b * t)) / (a ** 2 - b ** 2),
  );
  closeTo(
    at(IL(["Divide", 1, ["Multiply", quad(["Power", "a", 2]), quad(["Power", "b", 2])]]), point),
    (b * Math.sin(a * t) - a * Math.sin(b * t)) / (a * b * (b ** 2 - a ** 2)),
  );
  // the hyperbolic ones, through k = -a²
  const hyper = (x: string) => quad(["Negate", ["Power", x, 2]]);
  closeTo(
    at(IL(["Divide", ["Power", "s", 2], ["Multiply", hyper("a"), hyper("b")]]), point),
    (a * Math.sinh(a * t) - b * Math.sinh(b * t)) / (a ** 2 - b ** 2),
  );
  closeTo(
    at(IL(["Divide", 1, ["Power", hyper("a"), 2]]), point),
    (a * t * Math.cosh(a * t) - Math.sinh(a * t)) / (2 * a ** 3),
  );
  closeTo(
    at(IL(["Divide", ["Power", "s", 3], ["Power", hyper("a"), 2]]), point),
    Math.cosh(a * t) + (a * t * Math.sinh(a * t)) / 2,
  );
  // numeric constants in place of a²
  closeTo(at(IL(["Divide", "s", ["Multiply", quad(1), quad(4)]]), { t: 0.9 }), (Math.cos(0.9) - Math.cos(1.8)) / 3);
  // a numerator of degree 4 over two quadratics is improper
  held(
    IL(["Divide", ["Power", "s", 4], ["Multiply", quad(["Power", "a", 2]), quad(["Power", "b", 2])]]),
    "InverseLaplaceTransform",
  );
  // a factor that isn't a quadratic in s
  held(
    IL(["Divide", "s", ["Multiply", quad(["Power", "a", 2]), ["Add", "s", 1], quad(["Power", "b", 2])]]),
    "InverseLaplaceTransform",
  );
});

test("Hankel: f(r)/r with a Bessel-function answer", () => {
  const H = (f: unknown) => ["HankelTransform", f, "r", "s"];
  closeTo(at(H(["Divide", exp(["Negate", "r"]), "r"]), { s: 1.4 }), 1 / Math.sqrt(1 + 1.4 ** 2));
  // ∫ e^(-A r²) J₀(s r) dr = √π/(2√A) · e^(-z) I₀(z), z = s²/(8A), with I₀(0.2) from its series
  const z = 1.4 ** 2 / (8 * 1.7 ** 2);
  const i0 = [...Array(12).keys()].reduce((sum, k) => sum + (z / 2) ** (2 * k) / factorial(k) ** 2, 0);
  closeTo(
    at(H(["Divide", exp(["Negate", ["Multiply", ["Power", "a", 2], ["Power", "r", 2]]]), "r"]), { s: 1.4, a: 1.7 }),
    (Math.sqrt(Math.PI) / (2 * 1.7)) * Math.exp(-z) * i0,
  );
  held(H(["Divide", exp("r"), "r"]), "HankelTransform");
});

test("InverseMellin: the Mellin transform of J_ν is 2^(s-1) Γ((ν+s)/2)/Γ(1+(ν-s)/2)", () => {
  const J = (nu: number) => ({
    up: ["Gamma", ["Add", ["Multiply", ["Rational", 1, 2], "s"], ["Rational", nu, 2]]],
    down: ["Gamma", ["Add", ["Multiply", ["Rational", -1, 2], "s"], 1 + nu / 2]],
  });
  const F = (nu: number, scale: unknown[] = []) => [
    "InverseMellinTransform",
    ["Multiply", ["Divide", 1, J(nu).down], J(nu).up, ["Power", 2, ["Add", "s", -1]], ...scale],
    "s",
    "x",
  ];
  expect(ce.box(F(0) as never).evaluate().json).toEqual(["BesselJ", 0, "x"]);
  expect(ce.box(F(1, [["Power", "a", ["Negate", "s"]]]) as never).evaluate().json).toEqual([
    "BesselJ",
    1,
    ["Multiply", "a", "x"],
  ]);
  // Γ's that don't pair up as (ν+s)/2 over 1+(ν-s)/2
  held(
    [
      "InverseMellinTransform",
      ["Multiply", ["Divide", 1, J(1).down], J(0).up, ["Power", 2, ["Add", "s", -1]]],
      "s",
      "x",
    ],
    "InverseMellinTransform",
  );
});

const factorial = (n: number): number => (n <= 1 ? 1 : n * factorial(n - 1));

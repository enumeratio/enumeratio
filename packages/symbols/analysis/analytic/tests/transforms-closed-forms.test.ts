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

// The values below are wolframscript's, at the stated points.
test("InverseLaplace: fractional powers, with logarithms", () => {
  const gamma = 0.5772156649015329;
  closeTo(at(IL(["Divide", 1, ["Sqrt", "s"]]), { t: 2.1 }), 1 / Math.sqrt(Math.PI * 2.1));
  closeTo(at(IL(["Power", "s", ["Rational", -3, 2]]), { t: 2.1 }), 2 * Math.sqrt(2.1 / Math.PI));
  closeTo(
    at(IL(["Multiply", ["Power", "s", ["Rational", -1, 3]], ["Ln", ["Multiply", 4, "s"]]]), { t: 2.1 }),
    -0.5662631977723837,
  );
  closeTo(at(IL(["Divide", ["Ln", "s"], ["Sqrt", "s"]]), { t: 2.1 }), -1.0533058743474013);
  closeTo(
    at(IL(["Divide", ["Power", ["Ln", "s"], 2], "s"]), { t: 2.1 }),
    (gamma + Math.log(2.1)) ** 2 - Math.PI ** 2 / 6,
  );
  closeTo(
    at(IL(["Divide", ["Power", ["Ln", "s"], 2], ["Power", "s", ["Rational", 3, 2]]]), { t: 2.1 }),
    -0.7148113204664787,
  );
  // a bare logarithm, a positive power, a cube of the logarithm: no image here
  held(IL(["Ln", "s"]), "InverseLaplaceTransform");
  held(IL(["Multiply", ["Power", "s", ["Rational", 1, 3]], ["Ln", "s"]]), "InverseLaplaceTransform");
  held(IL(["Divide", ["Power", ["Ln", "s"], 3], "s"]), "InverseLaplaceTransform");
});

test("InverseLaplace: shifts, and the error-function family", () => {
  const sqrtS = ["Sqrt", "s"];
  const shifted = (a: unknown) => ["Add", "s", ["Negate", a]];
  // second shifting theorem: e^{-5s}/((s-2)√s) -> θ(t-5) e^{2(t-5)} erf(√(2(t-5)))/√2
  const second = ["Multiply", exp(["Multiply", -5, "s"]), ["Divide", 1, ["Multiply", shifted(2), sqrtS]]];
  closeTo(at(IL(second), { t: 5.7 }), 2.5971603232995837);
  closeTo(at(IL(second), { t: 4 }), 0);
  // first shifting theorem, through √(s+b): √(s+b)/(s+a)
  closeTo(
    at(IL(["Divide", ["Sqrt", ["Add", "s", "b"]], ["Add", "s", "a"]]), { a: 0.4, b: 1.3, t: 0.9 }),
    0.7120304438802214,
  );
  closeTo(at(IL(["Divide", sqrtS, shifted("a")]), { a: 1.3, t: 0.9 }), 3.805137636206073);
  closeTo(at(IL(["Divide", 1, ["Multiply", shifted("a"), sqrtS]]), { a: 1.3, t: 0.9 }), 2.469561228837294);
  // ln s/(s-a) = e^{at}(ln a - Ei(-at)), a > 0
  closeTo(at(IL(["Divide", ["Ln", "s"], shifted(2)]), { t: 0.8 }), 3.8606684354908922);
  held(IL(["Divide", ["Ln", "s"], ["Add", "s", 1]]), "InverseLaplaceTransform");
  // Γ(ν, s)/s^ν -> t^{ν-1} θ(t-1); erf(√(as))/√s -> θ(a-t)/√(πt)
  const incomplete = ["Divide", ["Gamma", ["Rational", 1, 3], "s"], ["Root", "s", 3]];
  closeTo(at(IL(incomplete), { t: 2.1 }), 2.1 ** (-2 / 3));
  closeTo(at(IL(incomplete), { t: 0.5 }), 0);
  const erfPair = ["Divide", ["Erf", ["Sqrt", ["Multiply", 2, "s"]]], sqrtS];
  closeTo(at(IL(erfPair), { t: 1.5 }), 1 / Math.sqrt(Math.PI * 1.5));
  closeTo(at(IL(erfPair), { t: 2.5 }), 0);
  held(IL(["Divide", ["Erf", ["Sqrt", ["Multiply", "a", "s"]]], sqrtS]), "InverseLaplaceTransform"); // sign of a unknown
  // two square roots: one shift cannot take both to √s
  held(
    IL(["Divide", 1, ["Multiply", ["Sqrt", ["Add", "s", 1]], ["Sqrt", ["Add", "s", 2]]]]),
    "InverseLaplaceTransform",
  );
});

test("InverseLaplace: the elliptic-integral images, against their series", () => {
  const { a, t } = { a: 1.3, t: 2.1 };
  const m = ["Divide", ["Power", "a", 2], ["Power", "s", 2]];
  const lead = (n: number) => (rising(0.5, n) / factorial(n)) ** 2 * (Math.PI / 2);
  // K: (π/2) Σ_{n>=1} ((½)ₙ/n!)² a^{2n} t^{2n-1}/(2n-1)!;  s(π/2 - E): the same with 1/(2n-1) and t^{2n-2}/(2n-2)!
  const series = (term: (n: number) => number) => [...Array(30).keys()].slice(1).reduce((sum, n) => sum + term(n), 0);
  const K = IL(["Add", ["EllipticK", m], ["Negate", ["Divide", "Pi", 2]]]);
  closeTo(
    at(K, { a, t }),
    series((n) => (lead(n) * a ** (2 * n) * t ** (2 * n - 1)) / factorial(2 * n - 1)),
  );
  closeTo(
    at(IL(["Multiply", "s", ["Add", ["Divide", "Pi", 2], ["Negate", ["EllipticE", m]]]]), { a, t }),
    series((n) => (lead(n) * a ** (2 * n) * t ** (2 * n - 2)) / ((2 * n - 1) * factorial(2 * n - 2))),
  );
  closeTo(at(K, { a, t }), 2.6567468434771286);
  // the constant has to balance the elliptic term
  held(IL(["Add", ["EllipticK", m], -1]), "InverseLaplaceTransform");
});

test("Laplace: full-wave rectified sine and cosine, and Γ(ν, a/t)", () => {
  closeTo(at(L(["Abs", ["Sin", ["Multiply", 2, "t"]]]), { s: 1.4 }), 0.4192848947018326);
  closeTo(at(L(["Abs", ["Cos", ["Multiply", 2, "t"]]]), { s: 1.4 }), 0.4862800813526335);
  const gammaOfReciprocal = L(["Gamma", "nu", ["Divide", "a", "t"]]);
  const positive = new ComputeEngine();
  declareAnalytic(positive);
  positive.assume(positive.box(["Greater", "a", 0]));
  const value = positive
    .box(gammaOfReciprocal as never)
    .evaluate()
    .subs({ nu: 1, a: 1.3, s: 1.4 } as never)
    .N().re;
  closeTo(value, 0.11152872982703306);
  // for a of unknown sign the integral may not exist (a < 0 grows like e^{|a|/t}), so it is held
  held(gammaOfReciprocal, "LaplaceTransform");
});

test("Laplace: a separable function in several variables", () => {
  const LL = (f: unknown) => ["LaplaceTransform", f, ["List", "x", "y"], ["List", "p", "q"]];
  closeTo(at(LL(["Multiply", ["Power", "x", 2], ["Power", "y", 3]]), { p: 2, q: 3 }), 12 / (2 ** 3 * 3 ** 4));
  closeTo(
    at(LL(["Add", ["Multiply", 3, exp(["Multiply", 2, "x"])], ["Multiply", "x", ["Sin", "y"]]]), { p: 3, q: 2 }),
    3 / (2 * (3 - 2)) + 1 / (3 ** 2 * (2 ** 2 + 1)),
  );
  // a factor in both variables, or a symbolic exponent of unknown sign
  held(LL(["Cos", ["Sqrt", ["Multiply", "x", "y"]]]), "LaplaceTransform");
  held(LL(["Multiply", ["Power", "x", "m"], "y"]), "LaplaceTransform");
});

test("Hankel: erfc(kr)/r, E_1(kr)/r, (1 - e^(-mr))/r² and ln(1 + a²/r²)", () => {
  const H = (f: unknown) => ["HankelTransform", f, "r", "s"];
  closeTo(at(H(["Divide", ["Erfc", ["Multiply", 2, "r"]], "r"]), { s: 1.8 }), 0.2641565109927354);
  closeTo(at(H(["Divide", ["ExpIntegralE", 1, ["Multiply", 2, "r"]], "r"]), { s: 1.8 }), 0.44937051980710135);
  const defect = (m: unknown) => ["Divide", ["Subtract", 1, exp(["Negate", ["Multiply", m, "r"]])], ["Power", "r", 2]];
  closeTo(at(H(defect(2)), { s: 1.3 }), 1.21591021257432);
  const logRatio = ["Ln", ["Add", ["Divide", ["Power", "a", 2], ["Power", "r", 2]], 1]];
  closeTo(at(H(logRatio), { s: 1.3, a: 2 }), 0.9825579678672403);
  closeTo(at(H(logRatio), { s: 1.3, a: -2 }), 0.9825579678672403);
  // m and k of unknown sign: the transform need not exist (m < 0 grows), so it is held
  held(H(defect("m")), "HankelTransform");
  held(H(["Divide", ["Erfc", ["Multiply", "k", "r"]], "r"]), "HankelTransform");
});

test("InverseMellin: 1/(s+b), scaled by a^s, and Γ(s/a)²", () => {
  const IM = (F: unknown) => ["InverseMellinTransform", F, "s", "x"];
  closeTo(at(IM(["Divide", 1, ["Add", "s", 2]]), { x: 0.5 }), 0.25);
  closeTo(at(IM(["Divide", 1, ["Add", "s", 2]]), { x: 1.5 }), 0);
  const positive = new ComputeEngine();
  declareAnalytic(positive);
  positive.assume(positive.box(["Greater", "a", 0]));
  const atPositive = (mj: unknown, point: Record<string, number>) =>
    positive
      .box(mj as never)
      .evaluate()
      .subs(point as never)
      .N().re;
  const scaled = IM(["Multiply", ["Divide", 1, ["Add", "s", "b"]], ["Power", "a", "s"]]);
  closeTo(atPositive(scaled, { a: 2.5, b: 0.7, x: 1.7 }), (1.7 / 2.5) ** 0.7);
  closeTo(atPositive(scaled, { a: 2.5, b: 0.7, x: 3 }), 0);
  closeTo(atPositive(IM(["Power", ["Gamma", ["Divide", "s", "a"]], 2]), { a: 2, x: 1.5 }), 0.13895801754511702);
  // Γ(s)² -> 2K_0(2√x)
  closeTo(at(IM(["Power", ["Gamma", "s"], 2]), { x: 1.5 }), 2 * besselK0(2 * Math.sqrt(1.5)));
  // a of unknown sign: held
  held(scaled, "InverseMellinTransform");
  held(IM(["Power", ["Gamma", ["Divide", "s", "a"]], 2]), "InverseMellinTransform");
});

/** K_0(x) = ∫_0^∞ e^{-x cosh u} du, by the trapezoid rule (the integrand decays double-exponentially). */
function besselK0(x: number): number {
  const h = 0.01;
  let sum = Math.exp(-x) / 2;
  for (let k = 1; k < 800; k++) sum += Math.exp(-x * Math.cosh(k * h));
  return sum * h;
}

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
/** The rising factorial (x)ₙ. */
const rising = (x: number, n: number): number => (n === 0 ? 1 : (x + n - 1) * rising(x, n - 1));

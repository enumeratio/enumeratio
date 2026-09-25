import { readFileSync } from "node:fs";
import { BigDecimal, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf } from "@enumeratio/boxed";
import { expect, test } from "vite-plus/test";
import type { CertifiedGolden } from "../scripts/collect-certified-goldens.ts";
import { type Ball, exact, exp, ln, lower, pow, rational, upper } from "../src/ball.ts";
import { atDigits } from "../src/bigzeta.ts";
import { CERTIFIED_HEADS, enclosure } from "../src/certified.ts";
import { declareAnalytic, enclosureOf } from "../src/index.ts";

// Certified values (src/certified.ts) and the ball primitives under them (src/ball.ts),
// against mpmath at 220 digits (tests/certified.golden.json, from
// scripts/collect-certified-goldens.ts). At every precision asked for, the enclosure must hold
// mpmath's value and be a few units of that precision wide -- a rational argument is itself
// rounded there -- and asking for more digits must narrow it.

const rows = JSON.parse(
  readFileSync(new URL("./certified.golden.json", import.meta.url), "utf8"),
) as CertifiedGolden[];
const goldens = rows.filter(({ head }) => head !== "pi");

const ce = new ComputeEngine();
declareAnalytic(ce);

const DIGITS = [30, 60, 120];

/** An argument, written `p/q` or as a decimal, as a ball at the working precision. */
function ballOf(text: string): Ball {
  const [p, q] = text.split("/");
  return q === undefined ? exact(new BigDecimal(text)) : rational(BigInt(p!), BigInt(q));
}

/** The same argument as MathJSON. */
function jsonOf(text: string): unknown {
  const [p, q] = text.split("/");
  return q === undefined ? { num: text } : ["Rational", Number(p), Number(q)];
}

/** A MathJSON number's decimal. */
function decimalOf(json: unknown): BigDecimal {
  return new BigDecimal(typeof json === "number" ? String(json) : (json as { num: string }).num);
}

const PRIMITIVES: Readonly<Record<string, (args: Ball[]) => Ball>> = {
  exp: ([x]) => exp(x!),
  ln: ([x]) => ln(x!),
  pow: ([x, s]) => pow(x!, s!),
};

/** A golden row's enclosure at `digits`. */
function enclose({ head, args }: CertifiedGolden, digits: number): Ball | undefined {
  const primitive = PRIMITIVES[head];
  if (primitive !== undefined) return atDigits(digits, () => primitive(args.map(ballOf)));
  return enclosure(ce.box([head, ...args.map(jsonOf)] as never).canonical, digits);
}

/** Does `ball` hold `value`, with room for mpmath's own last digits? */
function holds(ball: Ball, value: BigDecimal): boolean {
  const slack = value.abs().mul(new BigDecimal("1e-215"));
  return lower(ball).lte(value.sub(slack)) && value.add(slack).lte(upper(ball));
}

test("every golden head is a primitive or a certified head", () => {
  for (const { head } of goldens) {
    expect(head in PRIMITIVES || CERTIFIED_HEADS.includes(head), head).toBe(true);
  }
});

for (const golden of goldens) {
  test(`${golden.head}(${golden.args.join(", ")}): holds mpmath's value, and narrows`, () => {
    const value = new BigDecimal(golden.mpmath);
    let previous: BigDecimal | undefined;
    for (const digits of DIGITS) {
      const ball = enclose(golden, digits);
      expect(ball, `${digits} digits`).toBeDefined();
      expect(holds(ball!, value), `${digits} digits`).toBe(true);
      const width = value.abs().mul(new BigDecimal(`1e-${digits - 2}`));
      expect(ball!.rad.lte(width), `${digits} digits wide`).toBe(true);
      if (previous !== undefined) expect(ball!.rad.lt(previous)).toBe(true);
      previous = ball!.rad;
    }
  });
}

test("N(x, d) on a certified head: mpmath's digits, correctly rounded, with the enclosure", () => {
  for (const golden of goldens.filter(({ head }) => CERTIFIED_HEADS.includes(head))) {
    const value = new BigDecimal(golden.mpmath);
    for (const d of [20, 50]) {
      const x = [golden.head, ...golden.args.map(jsonOf)];
      const answer = ce.box(["N", x, d] as never).evaluate();
      expect(answer.json, `${JSON.stringify(x)} to ${d}`).toEqual({
        num: value.toPrecision(d).toString(),
      });
      const [lo, hi] = operandsOf(enclosureOf(answer)!).map((end) => decimalOf(end.json));
      expect(lo!.lte(value) && value.lte(hi!)).toBe(true);
      expect([lo!.toPrecision(d).toString(), hi!.toPrecision(d).toString()]).toEqual([
        value.toPrecision(d).toString(),
        value.toPrecision(d).toString(),
      ]);
    }
  }
});

test("BigDecimal's π literal, which Barnes G trusts, holds every digit it is used at", () => {
  const { mpmath, digits } = rows.find(({ head }) => head === "pi")!;
  const used = digits! - 10;
  const error = atDigits(used, () => BigDecimal.PI)
    .sub(new BigDecimal(mpmath))
    .abs();
  expect(error.lte(new BigDecimal(`1e-${used - 1}`))).toBe(true);
});

test("an argument that arrives rounded leaves the head to the agreement loop", () => {
  const answer = ce.box(["N", ["PolyLog", 2, ["Divide", ["Sqrt", 2], 4]], 30]).evaluate();
  expect(answer.json).toEqual({ num: "0.390985046397864210431711647546" });
  expect(enclosureOf(answer)).toBeUndefined();
  // So does a head with no certified kernel, and a certified head outside its kernel's reach.
  expect(enclosureOf(ce.box(["N", ["Sinh", 1], 30]).evaluate())).toBeUndefined();
  expect(enclosureOf(ce.box(["N", ["PolyLog", 2, ["Rational", 3, 2]], 30]).evaluate())).toBe(
    undefined,
  );
});

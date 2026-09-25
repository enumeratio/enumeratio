import { expect, test } from "vite-plus/test";
import { alexanderPolynomial, braid, braidPower, components, invert, torusBraid, writhe } from "../src/braid.ts";
import {
  bracketInvariant,
  closureLoops,
  jonesPolynomial,
  kauffmanBracket,
  LOOP_VALUE,
  mirrorJones,
  sameJones,
  temperleyLiebGenerator,
  torusJones,
} from "../src/jones.ts";
import { evaluateAt, format, type Laurent } from "../src/laurent.ts";
import { lorenzBraid } from "../src/lorenz.ts";

const sigma = (strands: number, ...word: number[]) => braid(strands, word)!;
const coprime = (a: number, b: number): boolean => {
  let [x, y] = [a, b];
  while (y !== 0) [x, y] = [y, x % y];
  return x === 1;
};

test("the Temperley-Lieb generators and the closure loop count", () => {
  // e_i is a cup, a cap, and through-strands; closing it up gives n − 1 circles.
  const e1 = temperleyLiebGenerator(3, 1)!;
  expect(e1.strands).toBe(3);
  expect(closureLoops(e1)).toBe(2);
  // The identity closes to n circles, one per strand.
  expect(closureLoops(temperleyLiebGenerator(2, 1)!)).toBe(1);
  expect(temperleyLiebGenerator(3, 3)).toBeUndefined(); // out of range
  // δ = −A² − A⁻², the value of a closed loop.
  // `format` names the variable t whatever it stands for; here it is A.
  expect(format(LOOP_VALUE)).toBe("-t^-2 - t^2");
});

test("the unknot has bracket 1, and V = 1", () => {
  for (const b of [sigma(2, 1), sigma(3, 1, 2), sigma(4, 1, 2, 3)]) {
    expect(components(b)).toBe(1);
    expect(format(bracketInvariant(b)!), `${b.strands}`).toBe("1");
    expect(format(jonesPolynomial(b)!), `${b.strands}`).toBe("1");
  }
});

test("the Jones polynomial of the trefoil and the figure-eight", () => {
  // The right-handed trefoil, as the closure of σ₁³.
  const trefoil = jonesPolynomial(sigma(2, 1, 1, 1))!;
  expect(format(trefoil)).toBe("-t^-4 + t^-3 + t^-1");
  // Its mirror is the closure of σ₁⁻³, and V flips t for 1/t.
  const mirror = jonesPolynomial(sigma(2, -1, -1, -1))!;
  expect(sameJones(mirror, mirrorJones(trefoil))).toBe(true);
  expect(format(mirror)).toBe("t + t^3 - t^4");
  // The figure-eight knot is amphichiral, so its polynomial is its own mirror.
  const figureEight = jonesPolynomial(braidPower(sigma(3, 1, -2), 2)!)!;
  expect(format(figureEight)).toBe("t^-2 - t^-1 + 1 - t + t^2");
  expect(sameJones(figureEight, mirrorJones(figureEight))).toBe(true);
});

test("Jones agrees with the closed-form torus-knot polynomial", () => {
  // The oracle: a formula with no braid, no bracket and no diagrams in it.
  for (let p = 2; p <= 5; p++) {
    for (let q = 2; q <= 7; q++) {
      if (!coprime(p, q)) continue;
      const fromBraid = jonesPolynomial(torusBraid(p, q)!);
      expect(fromBraid, `T(${p},${q})`).toBeDefined();
      expect(sameJones(fromBraid!, torusJones(p, q)!), `T(${p},${q})`).toBe(true);
    }
  }
});

test("V(1) = 1 for a knot, and |V(−1)| is the determinant the Alexander polynomial gives", () => {
  // Two invariants computed by completely different machinery — Burau matrices over
  // Z[t,t⁻¹] on one side, Temperley-Lieb diagrams over Z[A,A⁻¹] on the other — have to
  // agree at t = −1, because both compute the knot determinant.
  const knots: [string, ReturnType<typeof braid>][] = [
    ["trefoil", braid(2, [1, 1, 1])],
    ["figure-eight", braidPower(braid(3, [1, -2])!, 2)],
    ["cinquefoil", braid(2, [1, 1, 1, 1, 1])],
    ["T(3,4)", torusBraid(3, 4)],
    ["T(3,5)", torusBraid(3, 5)],
    ["7_1", braid(2, [1, 1, 1, 1, 1, 1, 1])],
    ["LLRLR", lorenzBraid("LLRLR")],
    ["LLLRLLR", lorenzBraid("LLLRLLR")],
  ];
  for (const [name, b] of knots) {
    expect(components(b!), name).toBe(1);
    const jones = jonesPolynomial(b!)!;
    const alexander = alexanderPolynomial(b!)!;
    expect(evaluateAt(jones, 1), `${name}: V(1)`).toBe(1);
    expect(Math.abs(evaluateAt(jones, -1) as number), `${name}: determinant`).toBe(
      Math.abs(evaluateAt(alexander, -1) as number),
    );
  }
});

test("a link with an even number of components has no integer-power Jones", () => {
  // V lives in t^{1/2} there, and this declines rather than inventing a square root.
  const hopf = sigma(2, 1, 1);
  expect(components(hopf)).toBe(2);
  expect(jonesPolynomial(hopf)).toBeUndefined();
  // The bracket invariant is still perfectly well defined in A.
  expect(kauffmanBracket(hopf)).toBeDefined();
  expect(bracketInvariant(hopf)).toBeDefined();
});

test("the invariant does not depend on the braid word chosen", () => {
  // Markov moves: conjugation and stabilisation leave the closure alone. The trefoil, as
  // the closure of (σ₁σ₂)² in B₃ rather than σ₁³ in B₂.
  const base = sigma(3, 1, 2, 1, 2);
  const conjugated = sigma(3, 1, 1, 2, 1, 2, -1);
  expect(format(jonesPolynomial(base)!)).toBe(format(jonesPolynomial(conjugated)!));
  // Adding a strand with one extra crossing is stabilisation — same closure, same V.
  const stabilised = sigma(4, 1, 2, 1, 2, 3);
  expect(format(jonesPolynomial(base)!)).toBe(format(jonesPolynomial(stabilised)!));
  expect(format(jonesPolynomial(base)!)).toBe(format(jonesPolynomial(sigma(2, 1, 1, 1))!));
  // A braid and its reverse word close to the same knot.
  expect(format(jonesPolynomial(sigma(2, 1, 1, 1))!)).toBe(format(jonesPolynomial(invert(invert(sigma(2, 1, 1, 1))))!));
  expect(writhe(base)).toBe(4);
});

test("the mirror relation, and degenerate input", () => {
  const check = (p: Laurent) => expect(sameJones(mirrorJones(mirrorJones(p)), p)).toBe(true);
  check(jonesPolynomial(sigma(2, 1, 1, 1))!);
  check(jonesPolynomial(torusBraid(3, 4)!)!);
  // The closed form only divides through for coprime p, q — which is also when T(p,q) is
  // a knot rather than a link, so declining is the right answer, not a gap.
  expect(torusJones(2, 2)).toBeUndefined();
  expect(torusJones(1, 3)).toBeUndefined();
  expect(kauffmanBracket(sigma(1))).toBeDefined();
});

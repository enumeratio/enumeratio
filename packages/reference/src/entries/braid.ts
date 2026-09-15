import type { MathJSON, ReferenceEntry } from "../types.ts";

const DOMAIN = "Braids and knots";
const B = (strands: number, ...word: number[]): MathJSON => ["Braid", strands, ["List", ...word]];
/** A MathJSON string literal — the spelling a modular word takes. */
const W = (word: string): MathJSON => `'${word}'`;
/** Canonical Add order puts the highest power first, which is not how one writes it. */
const TREFOIL: MathJSON = ["Add", ["Power", "t", 2], ["Negate", "t"], 1];
/** Canonical form writes t⁻¹ as a Divide, so the Jones values are spelt out once here. */
const TREFOIL_JONES: MathJSON = [
  "Add",
  ["Negate", ["Power", "t", -4]],
  ["Divide", 1, "t"],
  ["Power", "t", -3],
];
const FIGURE_EIGHT: MathJSON = ["Add", ["Power", "t", 2], ["Multiply", -3, "t"], 1];
/** Wolfram's Stevedore knot 6₁ — the twist knot with two half-twists. */
const STEVEDORE: MathJSON = ["Add", ["Multiply", 2, ["Power", "t", 2]], ["Multiply", -5, "t"], 2];
/** The figure-eight's Jones polynomial — amphichiral, so it is its own mirror. */
const FIGURE_EIGHT_JONES: MathJSON = [
  "Add",
  ["Power", "t", 2],
  ["Negate", "t"],
  ["Divide", -1, "t"],
  ["Power", "t", -2],
  1,
];

export const braids: readonly ReferenceEntry[] = [
  {
    name: "Braid",
    domain: DOMAIN,
    signature: "Braid(strands, word)",
    summary:
      "A braid in Artin's presentation: $n$ strands and a word whose letter $k$ means $\\sigma_k$ and $-k$ means $\\sigma_k^{-1}$. Closing it up names a link — and by Alexander's theorem, every link.",
    signatures: [
      { call: "Braid(strands, word)", description: "the braid", library: "enumeratio-braid" },
      {
        call: "BraidPermutation(braid)",
        description: "the image in the symmetric group — forget which strand went over",
        library: "enumeratio-braid",
      },
      {
        call: "BraidWrithe(braid)",
        description: "the exponent sum, i.e. the abelianisation $B_n \\to \\mathbb{Z}$",
        library: "enumeratio-braid",
      },
      {
        call: "TorusBraid(p, q)",
        description: "$(\\sigma_1\\cdots\\sigma_{p-1})^q$, whose closure is $T(p,q)$",
        library: "enumeratio-braid",
      },
    ],
    details: [
      "Relations: $\\sigma_i\\sigma_j = \\sigma_j\\sigma_i$ for $|i-j| \\ge 2$, and $\\sigma_i\\sigma_{i+1}\\sigma_i = \\sigma_{i+1}\\sigma_i\\sigma_{i+1}$",
      "Adding $\\sigma_i^2 = 1$ gives the symmetric group, which is why $B_n$ surjects onto $S_n$",
      "Two different words can name the same braid; nothing here solves the word problem, so only invariants are computed",
      "`BraidComponents` counts the permutation's cycles — the closure is a knot exactly when it is an $n$-cycle",
      "An $LR$ word from the modular group is accepted anywhere a braid is, via its Lorenz braid",
    ],
    examples: [
      {
        expr: ["BraidPermutation", B(3, 1, 2)],
        expected: ["List", 2, 3, 1],
        caption: "σ₁σ₂ cycles the three strands",
      },
      {
        expr: ["BraidComponents", B(2, 1, 1)],
        expected: 2,
        caption: "the Hopf link",
        category: "Properties",
      },
      {
        expr: ["BraidIsKnot", ["TorusBraid", 2, 5]],
        expected: "True",
        caption: "$T(2,q)$ is a knot for odd $q$",
        category: "Properties",
      },
      {
        expr: ["BraidWrithe", B(3, 1, -2, 1)],
        expected: 1,
        caption: "two positive crossings and one negative",
        category: "Scope",
      },
    ],
    seeAlso: ["AlexanderPolynomial", "LorenzBraid", "SeifertGenus"],
  },
  {
    name: "AlexanderPolynomial",
    domain: DOMAIN,
    signature: "AlexanderPolynomial(knot)",
    summary:
      "The Alexander polynomial of a knot, computed from the reduced Burau representation over $\\mathbb{Z}[t,t^{-1}]$ and returned as an ordinary expression in $t$. Takes the knot however it is named — as $T(p,q)$, as a braid it closes from, or as a modular word.",
    signatures: [
      {
        call: "AlexanderPolynomial(knot)",
        description: "$\\Delta(t)$, normalised to start at $t^0$",
        library: "enumeratio-braid",
      },
      {
        call: "TorusKnot(p, q)",
        description: "$T(p,q)$ as a knot — the closed form, with no braid involved",
        library: "enumeratio-braid",
      },
      {
        call: "TwistKnot(n)",
        description: "the twist knot with $n$ half-twists past its clasp — another closed form",
        library: "enumeratio-braid",
      },
      {
        call: "PretzelKnot(p, q, r)",
        description: "$P(p,q,r)$ as a knot, for odd $p,q,r$ — closed form, no braid at all",
        library: "enumeratio-braid",
      },
      {
        call: "FigureEightKnot()",
        description: "TwistKnot(1) under its own name",
        library: "enumeratio-braid",
      },
      {
        call: "BurauMatrix(braid)",
        description: "the reduced Burau matrix itself",
        library: "enumeratio-braid",
      },
      {
        call: "SeifertGenus(knot)",
        description:
          "$(p-1)(q-1)/2$ for $T(p,q)$, $1$ for a twist or pretzel knot, else a POSITIVE braid's $(c-s+1)/2$",
        library: "enumeratio-braid",
      },
    ],
    details: [
      "$\\Delta(t) \\doteq \\det(\\psi(\\beta) - I)\\cdot(1-t)/(1-t^n)$, for $\\psi$ the reduced Burau representation",
      "$\\Delta$ is only defined up to $\\pm t^k$, so results are normalised — lowest term at $t^0$ with a positive coefficient",
      "$\\Delta_{T(p,q)}(t) = (t^{pq}-1)(t-1)/((t^p-1)(t^q-1))$, which is the oracle the Burau computation is checked against",
      "$\\Delta_{TwistKnot(n)}(t) = nt^2 - (2n+1)t + n$; $n=1$ is the figure-eight and $n=-1$ is the trefoil",
      "$\\Delta_{P(p,q,r)}(t) = \\tfrac14[(pq+qr+rp)(t-2+t^{-1}) + (t+2+t^{-1})]$, for odd $p,q,r$",
      "A twist or pretzel knot is genus 1 always — the underlying Seifert surface has two disks joined by two or three bands, and adding a twist lengthens a band rather than adding one",
      "The determinant uses Bareiss elimination: every intermediate is a minor, so each division is exact over $\\mathbb{Z}[t,t^{-1}]$",
      "Bennequin: on a POSITIVE braid, Seifert's algorithm is already optimal, so the genus formula holds — on a mixed braid it does not",
      "No braid-word family in $n$ or $(p,q,r)$ is known for twist or pretzel knots in general, so `JonesPolynomial` and `KnotCurve` decline there except at the figure-eight and the trefoil, which carry the specific braid this package already had for them",
    ],
    examples: [
      {
        expr: ["AlexanderPolynomial", B(2, 1, 1, 1)],
        expected: TREFOIL,
        caption: "the trefoil",
      },
      {
        expr: ["AlexanderPolynomial", ["BraidPower", B(3, 1, -2), 2]],
        expected: FIGURE_EIGHT,
        caption: "the figure-eight knot",
      },
      {
        expr: ["AlexanderPolynomial", ["FigureEightKnot"]],
        expected: FIGURE_EIGHT,
        caption: "…and under its own name, TwistKnot(1)",
        category: "Scope",
      },
      {
        expr: ["AlexanderPolynomial", ["TwistKnot", 2]],
        expected: STEVEDORE,
        caption: "the Stevedore knot, 6₁ — two half-twists",
        category: "Scope",
      },
      {
        expr: ["AlexanderPolynomial", ["PretzelKnot", 1, 1, -1]],
        expected: 1,
        caption: "P(1,1,-1) is the unknot",
        category: "Scope",
      },
      {
        expr: ["SeifertGenus", ["TorusBraid", 3, 4]],
        expected: 3,
        caption: "$(3-1)(4-1)/2$",
        category: "Properties",
      },
      {
        expr: ["SeifertGenus", ["TwistKnot", 5]],
        expected: 1,
        caption: "a twist knot's genus does not grow with the twist count",
        category: "Properties",
      },
      {
        expr: ["SeifertGenus", B(3, 1, -2)],
        expected: ["SeifertGenus", B(3, 1, -2)],
        caption: "a mixed braid has no Bennequin genus, so the call is left alone",
        category: "Possible issues",
      },
      {
        expr: ["SeifertGenus", ["PretzelKnot", 2, 1, 1]],
        expected: ["SeifertGenus", ["PretzelKnot", 2, 1, 1]],
        caption: "an even band is not this family, so the call is left alone",
        category: "Possible issues",
      },
    ],
    seeAlso: ["Braid", "LorenzBraid"],
  },
  {
    name: "LorenzBraid",
    domain: DOMAIN,
    signature: "LorenzBraid(word)",
    summary:
      "The braid a closed geodesic of the modular flow draws. By Ghys's theorem the modular knots are exactly the periodic orbits of the Lorenz attractor, and those have a purely combinatorial positive braid.",
    signatures: [
      {
        call: "LorenzBraid(word)",
        description: "the positive permutation braid of the orbit",
        library: "enumeratio-braid",
      },
      {
        call: "LorenzPermutation(word)",
        description: "how the flow permutes the orbit's branch-line points",
        library: "enumeratio-braid",
      },
      {
        call: "TripNumber(word)",
        description: "the count of $LR$ corners — the braid index of the link",
        library: "enumeratio-braid",
      },
    ],
    details: [
      "The word's cyclic rotations name the orbit's points; both branches of the template preserve orientation, so they are ordered lexicographically with $L < R$",
      "The flow sends each rotation to the next, and the positive permutation braid of that permutation is the Lorenz braid",
      "Trip number $1$ means braid index $1$, which means the unknot — so $L^pR^q$ draws the UNKNOT, not $T(p,q)$",
      "When the permutation is a rotation $i \\mapsto i+k$ on $n$ points the knot is $T(k, n-k)$; those words are the Christoffel words",
      "The shortest geodesic drawing a trefoil is $LLRLR$, of symbolic length 5",
      "A repeated word traverses one geodesic several times and has no well-defined point order, so it is refused",
    ],
    examples: [
      {
        expr: ["AlexanderPolynomial", W("LLRLR")],
        expected: TREFOIL,
        caption: "the shortest knotted geodesic draws a trefoil",
      },
      {
        expr: ["TripNumber", W("LLRLR")],
        expected: 2,
        caption: "braid index 2",
        category: "Properties",
      },
      {
        expr: ["AlexanderPolynomial", W("LLLRRRR")],
        expected: 1,
        caption: "one hump each way is unknotted, however long",
        category: "Properties",
      },
      {
        expr: ["LorenzPermutation", W("LLRLR")],
        expected: ["List", 3, 4, 5, 1, 2],
        caption: "a rotation by 2 on 5 points — hence $T(2,3)$",
        category: "Scope",
      },
    ],
    seeAlso: ["Braid", "AlexanderPolynomial", "ModularClasses"],
  },
  {
    name: "JonesPolynomial",
    domain: DOMAIN,
    signature: "JonesPolynomial(knot)",
    summary:
      "The Jones polynomial $V(t)$ of a knot. A knot named $T(p,q)$ takes the closed form; anything else goes through the TEMPERLEY–LIEB algebra rather than a matrix representation, where each crossing becomes its two smoothings and each closed loop is worth $\\delta = -A^2 - A^{-2}$.",
    signatures: [
      {
        call: "JonesPolynomial(knot)",
        description: "$V(t)$, for a knot however it is named",
        library: "enumeratio-braid",
      },
      {
        call: "TorusKnot(p, q)",
        description: "$T(p,q)$ as a knot — no braid, no bracket, no diagrams",
        library: "enumeratio-braid",
      },
      {
        call: "FigureEightKnot()",
        description: "the one twist knot with a braid word already on file",
        library: "enumeratio-braid",
      },
      {
        call: "KauffmanBracket(knot)",
        description: "$\\langle L\\rangle$ in $A$ — defined for links too",
        library: "enumeratio-braid",
      },
      {
        call: "BracketInvariant(knot)",
        description: "$(-A^3)^{-w}\\langle L\\rangle$, already an invariant",
        library: "enumeratio-braid",
      },
    ],
    details: [
      "$\\sigma_i \\mapsto A\\cdot 1 + A^{-1}e_i$ and $\\sigma_i^{-1} \\mapsto A^{-1}\\cdot 1 + A e_i$ — the two images ARE the two smoothings of a crossing",
      "The raw bracket is not an invariant: one positive crossing on an unknot leaves $-A^3$ behind, which the writhe correction divides out",
      "$V(t)$ follows by substituting $A = t^{1/4}$; the SIGN of that exponent is the handedness convention, and getting it backwards mirrors every answer",
      "A link with an even number of components needs a square root of $t$, so `JonesPolynomial` declines and the bracket is what to ask for",
      "The knot determinant is both $|\\Delta(-1)|$ and $|V(-1)|$ — one from Burau matrices, the other from diagrams, which is how each checks the other",
      "The Temperley–Lieb diagrams used here are the ones the diagram-algebra package catalogues, with the same product",
    ],
    examples: [
      {
        expr: ["JonesPolynomial", B(2, 1, 1, 1)],
        expected: TREFOIL_JONES,
        caption: "the right-handed trefoil",
      },
      {
        expr: ["KauffmanBracket", B(2, 1)],
        expected: ["Negate", ["Power", "A", 3]],
        caption: "not yet an invariant",
        category: "Properties",
      },
      {
        expr: ["BracketInvariant", B(2, 1)],
        expected: 1,
        caption: "…and the writhe correction fixes it",
        category: "Properties",
      },
      {
        expr: ["JonesPolynomial", W("LLRLR")],
        expected: TREFOIL_JONES,
        caption: "the shortest knotted modular geodesic, by yet another route",
        category: "Applications",
      },
      {
        expr: ["JonesPolynomial", ["FigureEightKnot"]],
        expected: FIGURE_EIGHT_JONES,
        caption: "the figure-eight, through the braid it carries as TwistKnot(1)",
        category: "Applications",
      },
    ],
    seeAlso: ["AlexanderPolynomial", "Braid", "LorenzBraid"],
  },
];

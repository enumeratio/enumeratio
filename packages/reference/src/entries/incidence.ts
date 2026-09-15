import type { MathJSON, ReferenceEntry } from "../types.ts";

const DOMAIN = "Incidence algebras";
const L = (...xs: number[]): MathJSON => ["List", ...xs];

export const incidence: readonly ReferenceEntry[] = [
  {
    name: "MoebiusFunction",
    domain: DOMAIN,
    signature: "MoebiusFunction(poset, x, y)",
    summary:
      "The Möbius function $\\mu(x,y)$ of a finite poset — the inverse of the zeta function in the incidence algebra. Specialising the poset recovers number theory's $\\mu$ and inclusion–exclusion.",
    signatures: [
      {
        call: "MoebiusFunction(poset, x, y)",
        description: "$\\mu$ on the interval $[x,y]$, and 0 when $x \\not\\le y$",
        library: "enumeratio-incidence",
      },
    ],
    details: [
      "Defined by $\\mu(x,x) = 1$ and $\\mu(x,y) = -\\sum_{x \\le z < y}\\mu(x,z)$ — which is exactly the statement that $\\mu$ inverts $\\zeta$",
      "On `DivisorLattice(n)`, $\\mu([a,b])$ is the classical number-theoretic $\\mu(b/a)$",
      "On `BooleanLattice(n)`, $\\mu([S,T]) = (-1)^{|T \\setminus S|}$ — the signs of inclusion–exclusion",
      "On a chain, $\\mu$ is 1 on a point, $-1$ on a cover, and 0 on anything longer",
      "Posets: `Chain(n)`, `BooleanLattice(n)` (elements are subsets), `DivisorLattice(n)` (elements are divisors)",
    ],
    examples: [
      {
        expr: ["MoebiusFunction", ["DivisorLattice", 30], 1, 30],
        expected: -1,
        caption: "$30 = 2\\cdot3\\cdot5$ is squarefree with three primes",
      },
      {
        expr: ["MoebiusFunction", ["DivisorLattice", 12], 1, 12],
        expected: 0,
        caption: "4 divides 12, so $\\mu$ vanishes",
        category: "Properties",
      },
      {
        expr: ["MoebiusFunction", ["BooleanLattice", 3], L(), L(1, 2, 3)],
        expected: -1,
        caption: "$(-1)^3$ — inclusion–exclusion",
        category: "Properties",
      },
      {
        expr: ["MoebiusFunction", ["Chain", 5], 2, 4],
        expected: 0,
        caption: "not a cover, so zero",
        category: "Properties",
      },
    ],
    seeAlso: ["MoebiusInvert", "PosetZeta", "PosetElements"],
  },
  {
    name: "MoebiusInvert",
    domain: DOMAIN,
    signature: "MoebiusInvert(poset, values)",
    summary:
      "Möbius inversion: given $g(y) = \\sum_{x \\le y} f(x)$, recover $f$. The inverse of [[PosetSumDown]], and the reason the incidence algebra is worth having.",
    signatures: [
      {
        call: "MoebiusInvert(poset, values)",
        description: "$f(y) = \\sum_{x \\le y} \\mu(x,y)\\,g(x)$",
        library: "enumeratio-incidence",
      },
      {
        call: "PosetSumDown(poset, values)",
        description: "the map it undoes, $g(y) = \\sum_{x \\le y} f(x)$",
        library: "enumeratio-incidence",
      },
    ],
    details: [
      "Values are given in the poset's own order — see [[PosetElements]] for that listing",
      "On a chain this is first differences; on the Boolean lattice it is inclusion–exclusion; on the divisor lattice it is classical Möbius inversion",
      "The two directions are inverse on every poset, which is the theorem",
    ],
    examples: [
      {
        expr: ["PosetSumDown", ["Chain", 4], L(1, 2, 3, 4)],
        expected: L(1, 3, 6, 10),
        caption: "partial sums along the chain",
      },
      {
        expr: ["MoebiusInvert", ["Chain", 4], L(1, 3, 6, 10)],
        expected: L(1, 2, 3, 4),
        caption: "…and back again",
      },
      {
        expr: [
          "MoebiusInvert",
          ["BooleanLattice", 2],
          ["PosetSumDown", ["BooleanLattice", 2], L(5, 1, 2, 7)],
        ],
        expected: L(5, 1, 2, 7),
        caption: "inclusion–exclusion, round-tripped",
        category: "Properties",
      },
    ],
    seeAlso: ["MoebiusFunction", "PosetElements"],
  },
  {
    name: "PosetElements",
    domain: DOMAIN,
    signature: "PosetElements(poset)",
    summary:
      "The elements of a finite poset, in a linear extension — the order every other head here indexes values by.",
    signatures: [
      {
        call: "PosetElements(poset)",
        description: "the elements, listed so that smaller ones come first",
        library: "enumeratio-incidence",
      },
    ],
    details: [
      "The linear extension is what makes $\\zeta$ upper-triangular with ones on the diagonal, hence invertible over the integers — and therefore what makes $\\mu$ integral",
      "`DivisorLattice` elements are integers; `BooleanLattice` elements are subsets; `Chain` elements are $1 \\dots n$",
      "`AlgebraDimension(IncidenceAlgebra(poset))` counts the intervals: $\\binom{n+1}{2}$ for a chain, $3^n$ for the Boolean lattice",
    ],
    examples: [
      { expr: ["PosetElements", ["DivisorLattice", 12]], expected: L(1, 2, 3, 4, 6, 12) },
      { expr: ["PosetElements", ["Chain", 4]], expected: L(1, 2, 3, 4) },
      {
        expr: ["AlgebraDimension", ["IncidenceAlgebra", ["BooleanLattice", 3]]],
        expected: 27,
        caption: "$3^3$ intervals",
        category: "Properties",
      },
    ],
    seeAlso: ["MoebiusFunction", "MoebiusInvert"],
  },
];

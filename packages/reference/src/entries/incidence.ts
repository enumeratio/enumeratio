// GENERATED from YAML by packages/reference/scripts/migrate/shims.ts -- do not edit.
// Edit the YAML named in `sources`, then run `node packages/reference/scripts/migrate/shims.ts`.

import type { ReferenceEntry } from "@enumeratio/entry";

/** The YAML each entry below was generated from, in the same order. */
export const sources: readonly string[] = [
  "packages/symbols/algebras/incidence/reference/MoebiusFunction.yaml",
  "packages/symbols/algebras/incidence/reference/MoebiusInvert.yaml",
  "packages/symbols/algebras/incidence/reference/PosetElements.yaml",
];

export const incidence: readonly ReferenceEntry[] = [
  {
    name: "MoebiusFunction",
    domain: "Incidence algebras",
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
        id: "30-2-cdot-3-cdot-5-is-squarefree-with-three",
        expr: ["MoebiusFunction", ["DivisorLattice", 30], 1, 30],
        expected: -1,
        caption: "$30 = 2\\cdot3\\cdot5$ is squarefree with three primes",
      },
      {
        id: "4-divides-12-so-mu-vanishes",
        expr: ["MoebiusFunction", ["DivisorLattice", 12], 1, 12],
        expected: 0,
        caption: "4 divides 12, so $\\mu$ vanishes",
        category: "Properties",
      },
      {
        id: "1-3-inclusion-exclusion",
        expr: ["MoebiusFunction", ["BooleanLattice", 3], ["List"], ["List", 1, 2, 3]],
        expected: -1,
        caption: "$(-1)^3$ — inclusion–exclusion",
        category: "Properties",
      },
      {
        id: "not-a-cover-so-zero",
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
    domain: "Incidence algebras",
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
        id: "partial-sums-along-the-chain",
        expr: ["PosetSumDown", ["Chain", 4], ["List", 1, 2, 3, 4]],
        expected: ["List", 1, 3, 6, 10],
        caption: "partial sums along the chain",
      },
      {
        id: "and-back-again",
        expr: ["MoebiusInvert", ["Chain", 4], ["List", 1, 3, 6, 10]],
        expected: ["List", 1, 2, 3, 4],
        caption: "…and back again",
      },
      {
        id: "inclusion-exclusion-round-tripped",
        expr: [
          "MoebiusInvert",
          ["BooleanLattice", 2],
          ["PosetSumDown", ["BooleanLattice", 2], ["List", 5, 1, 2, 7]],
        ],
        expected: ["List", 5, 1, 2, 7],
        caption: "inclusion–exclusion, round-tripped",
        category: "Properties",
      },
    ],
    seeAlso: ["MoebiusFunction", "PosetElements"],
  },
  {
    name: "PosetElements",
    domain: "Incidence algebras",
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
      {
        id: "posetelements-divisorlattice-12",
        expr: ["PosetElements", ["DivisorLattice", 12]],
        expected: ["List", 1, 2, 3, 4, 6, 12],
      },
      {
        id: "posetelements-chain-4",
        expr: ["PosetElements", ["Chain", 4]],
        expected: ["List", 1, 2, 3, 4],
      },
      {
        id: "3-3-intervals",
        expr: ["AlgebraDimension", ["IncidenceAlgebra", ["BooleanLattice", 3]]],
        expected: 27,
        caption: "$3^3$ intervals",
        category: "Properties",
      },
    ],
    seeAlso: ["MoebiusFunction", "MoebiusInvert"],
  },
];

import type { MathJSON, ReferenceEntry } from "../types.ts";

const DOMAIN = "Hecke algebras";
const T = (...w: number[]): MathJSON => ["HeckeT", ["List", ...w]];
const times = (...parts: MathJSON[]): MathJSON => ["NonCommutativeMultiply", ...parts];

export const hecke: readonly ReferenceEntry[] = [
  {
    name: "HeckeT",
    domain: DOMAIN,
    signature: "HeckeT(permutation)",
    summary:
      "The basis element $T_w$ of the Iwahori–Hecke algebra $H_n(q)$, indexed by a permutation in one-line notation. Multiplication is the $q$-deformation of the symmetric group's.",
    signatures: [
      {
        call: "HeckeT([2,1,3])",
        description: "$T_w$ for the permutation $w$",
        library: "enumeratio-hecke",
      },
    ],
    details: [
      "$T_s \\cdot T_w = T_{sw}$ when the length goes up, and $q\\,T_{sw} + (q-1)\\,T_w$ when it goes down — the second case is the entire deformation",
      "So a product of two basis elements is a LINEAR COMBINATION, unlike the other algebra families here; sums read back in, so products compose",
      "The quadratic relation is $T_s^2 = q + (q-1)T_s$, i.e. $(T_s-q)(T_s+1) = 0$, replacing $s^2 = 1$",
      "The braid relations survive the deformation, which is why $T_w$ is the product over ANY reduced word for $w$",
      "Coefficients stay exact polynomials in $q$; use [[HeckeSpecialize]] to pick a value",
      "Use the ordered product ([[NonCommutativeMultiply]] or $\\otimes$) — $H_n(q)$ is not commutative",
    ],
    examples: [
      {
        id: "length-goes-up-so-no-q-appears",
        expr: times(T(2, 1, 3), T(1, 3, 2)),
        expected: T(2, 3, 1),
        caption: "length goes up, so no $q$ appears",
      },
      {
        id: "the-quadratic-relation-t-s-2-q-q-1-t-s",
        expr: times(T(2, 1, 3), T(2, 1, 3)),
        expected: [
          "Add",
          ["Multiply", "q", T(1, 2, 3)],
          ["Multiply", ["Add", "q", -1], T(2, 1, 3)],
        ],
        caption: "the quadratic relation $T_s^2 = q + (q-1)T_s$",
        category: "Properties",
      },
      {
        id: "t-st-tt-s-the-longest-element-of-s-3",
        expr: times(T(2, 1, 3), T(1, 3, 2), T(2, 1, 3)),
        expected: T(3, 2, 1),
        caption: "$T_sT_tT_s$ — the longest element of $S_3$",
        category: "Properties",
      },
      {
        id: "and-t-tt-st-t-gives-the-same-which-is-the-braid",
        expr: times(T(1, 3, 2), T(2, 1, 3), T(1, 3, 2)),
        expected: T(3, 2, 1),
        caption: "…and $T_tT_sT_t$ gives the same, which is the braid relation",
        category: "Properties",
      },
      {
        id: "n-the-same-basis-as-z-s-n",
        expr: ["AlgebraDimension", ["HeckeAlgebra", 4]],
        expected: 24,
        caption: "$n!$ — the same basis as $\\mathbb{Z}S_n$",
      },
    ],
    seeAlso: ["HeckeSpecialize", "NonCommutativeMultiply", "Basis"],
  },
  {
    name: "HeckeSpecialize",
    domain: DOMAIN,
    signature: "HeckeSpecialize(element, q)",
    summary:
      "Substitute a value for the deformation parameter. At $q = 1$ the algebra collapses to the group algebra of $S_n$ — which is what makes 'deformation' the right word.",
    signatures: [
      {
        call: "HeckeSpecialize(element, q)",
        description: "set $q$ and drop whatever vanishes",
        library: "enumeratio-hecke",
      },
    ],
    details: [
      "At $q = 1$ the two cases of the multiplication rule become one, and $T_u T_v = T_{uv}$ for every pair — checked exhaustively over $S_2$, $S_3$ and $S_4$",
      "Everything interesting about $H_n(q)$ — Kazhdan–Lusztig theory, the Jones polynomial, representations at roots of unity — lives at $q \\ne 1$",
    ],
    examples: [
      {
        id: "q-t-e-q-1-t-s-at-q-1-is-just-t-e",
        expr: ["HeckeSpecialize", times(T(2, 1, 3), T(2, 1, 3)), 1],
        expected: T(1, 2, 3),
        caption: "$q\\,T_e + (q-1)T_s$ at $q = 1$ is just $T_e$",
      },
      {
        id: "at-q-2-it-stays-spread-over-two-basis-elements",
        expr: ["HeckeSpecialize", times(T(2, 1, 3), T(2, 1, 3)), 2],
        expected: ["Add", ["Multiply", 2, T(1, 2, 3)], T(2, 1, 3)],
        caption: "at $q = 2$ it stays spread over two basis elements",
        category: "Properties",
      },
      {
        id: "the-ordinary-product-of-permutations",
        expr: ["HeckeSpecialize", times(T(2, 1, 3), T(1, 3, 2)), 1],
        expected: T(2, 3, 1),
        caption: "the ordinary product of permutations",
        category: "Applications",
      },
    ],
    seeAlso: ["HeckeT"],
  },
];

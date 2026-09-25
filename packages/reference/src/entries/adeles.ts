// GENERATED from YAML by packages/reference/scripts/migrate/shims.ts -- do not edit.
// Edit the YAML named in `sources`, then run `node packages/reference/scripts/migrate/shims.ts`.

import type { ReferenceEntry } from "@enumeratio/entry";

/** The YAML each entry below was generated from, in the same order. */
export const sources: readonly string[] = [
  "packages/symbols/arithmetic/adeles/reference/ProfiniteNumber.yaml",
  "packages/symbols/arithmetic/adeles/reference/Adele.yaml",
  "packages/symbols/arithmetic/adeles/reference/Idele.yaml",
  "packages/symbols/arithmetic/adeles/reference/ProfiniteDecomposition.yaml",
  "packages/symbols/arithmetic/adeles/reference/ProfinitePlot.yaml",
];

export const adeles: readonly ReferenceEntry[] = [
  {
    name: "ProfiniteNumber",
    domain: "Adèles and idèles",
    signature: "ProfiniteNumber(x, m?)",
    summary:
      "A profinite number: the rational $x + m\\hat{\\mathbb{Z}}$ in $\\hat{\\mathbb{Q}} = \\hat{\\mathbb{Z}} \\otimes \\mathbb{Q}$, known modulo $m$. Modulus 0 (the default) is just the rational $x$ itself.",
    signatures: [
      {
        call: "ProfiniteNumber(x, m)",
        description: "$x$ known modulo $m$ — a coset of $m\\hat{\\mathbb{Z}}$",
        library: "enumeratio-adeles",
      },
      {
        call: "ProfiniteNumber(x)",
        description: "exact: modulus 0, so just the rational $x$",
        library: "enumeratio-adeles",
      },
      {
        call: "ProfiniteNumber(list)",
        description: "glue a list of [[AdicNumeral]] values by CRT into one profinite number",
        library: "enumeratio-adeles",
      },
    ],
    details: [
      "$\\hat{\\mathbb{Z}} = \\varprojlim \\mathbb{Z}/n\\mathbb{Z}$, the profinite completion of $\\mathbb{Z}$; $\\hat{\\mathbb{Q}} = \\hat{\\mathbb{Z}} \\otimes \\mathbb{Q}$ is the finite adèle ring, one coordinate per prime bundled together.",
      "`Add`, `Multiply`, `Negate`, `Divide`, `Power`, `Equal`, `NotEqual` are wrapped to recognise a `ProfiniteNumber` operand, like `AdicNumeral`.",
      "[[Numerator]] and [[Denominator]] split a profinite number into its numerator and denominator as profinite numbers (the denominator as an ordinary integer); [[AdicNumeral]]`(p, z)` projects it to $\\mathbb{Q}_p$; [[Fibonacci]] and `LucasL` take a profinite argument (Lenstra's profinite Fibonacci numbers).",
      "`ProfiniteNumber({AdicNumeral(p1, …), AdicNumeral(p2, …), …})` reassembles a profinite number from its images at several primes by the Chinese remainder theorem.",
    ],
    examples: [
      {
        id: "12-hat-z-8-hat-z-4-hat-z",
        expr: ["Add", ["ProfiniteNumber", 3, 12], ["ProfiniteNumber", 5, 8]],
        expected: ["ProfiniteNumber", 0, 4],
        caption: "$12\\hat{\\mathbb{Z}} + 8\\hat{\\mathbb{Z}} = 4\\hat{\\mathbb{Z}}$",
      },
      {
        id: "profinitenumber-3-12-times-profinitenumber-5-8",
        expr: ["Multiply", ["ProfiniteNumber", 3, 12], ["ProfiniteNumber", 5, 8]],
        expected: ["ProfiniteNumber", 3, 12],
      },
      {
        id: "equal-cosets-need-not-share-a-modulus",
        expr: ["Equal", ["ProfiniteNumber", 6, 20], ["ProfiniteNumber", 6, 40]],
        expected: "True",
        caption: "equal cosets need not share a modulus",
      },
      {
        id: "crt-glued-from-its-2-adic-and-3-adic-images",
        expr: ["ProfiniteNumber", ["List", ["AdicNumeral", 2, 20, 5], ["AdicNumeral", 3, 7, 2]]],
        expected: ["ProfiniteNumber", 52, 288],
        caption: "CRT: glued from its 2-adic and 3-adic images",
        category: "Scope",
      },
      {
        id: "a-rational-value-and-a-rational-modulus",
        expr: [
          "Add",
          ["ProfiniteNumber", ["Rational", 1, 2], ["Rational", 97, 5]],
          ["ProfiniteNumber", ["Rational", 1, 3], 10],
        ],
        expected: ["ProfiniteNumber", ["Rational", 1, 30], ["Rational", 1, 5]],
        caption: "a rational value and a rational modulus",
        category: "Scope",
      },
      {
        id: "numerator-profinitenumber-2-over-3-5",
        expr: ["Numerator", ["ProfiniteNumber", ["Rational", 2, 3], 5]],
        expected: ["ProfiniteNumber", 2, 15],
      },
      {
        id: "denominator-profinitenumber-2-over-3-5",
        expr: ["Denominator", ["ProfiniteNumber", ["Rational", 2, 3], 5]],
        expected: 3,
      },
      {
        id: "lenstra-s-profinite-fibonacci-numbers",
        expr: ["Fibonacci", ["ProfiniteNumber", 3, 10]],
        expected: ["ProfiniteNumber", 2, 11],
        caption: "Lenstra's profinite Fibonacci numbers",
        category: "Applications",
      },
      {
        id: "projecting-to-q-2",
        expr: ["AdicNumeral", 2, ["ProfiniteNumber", 100, 24]],
        expected: ["AdicNumeral", 2, 4, 3],
        caption: "projecting to $\\mathbb{Q}_2$",
      },
    ],
    seeAlso: ["Adele", "Idele", "AdicNumeral", "ProfiniteDecomposition"],
  },
  {
    name: "Adele",
    domain: "Adèles and idèles",
    signature: "Adele(r, z?)",
    summary:
      "An adèle: a real number $r$ beside a profinite number $z \\in \\hat{\\mathbb{Q}}$. `Adele(q)` for rational $q$ is the principal adèle, $q$ at every place.",
    signatures: [
      {
        call: "Adele(r, z)",
        description: "the real $r$ beside the finite part $z$ (a [[ProfiniteNumber]])",
        library: "enumeratio-adeles",
      },
      {
        call: "Adele(q)",
        description:
          "the principal adèle of a rational $q$: $q$ at the real place and every finite one",
        library: "enumeratio-adeles",
      },
      {
        call: "Adele(idele)",
        description: "the underlying adèle of an [[Idele]]",
        library: "enumeratio-adeles",
      },
    ],
    details: [
      "The real part is any closed-form real constant compute-engine can evaluate numerically, not only a rational.",
      "`Add`, `Multiply`, `Negate`, `Divide`, `Power`, `Equal`, `NotEqual` thread over an adèle, real part and finite part separately.",
      "An [[Idele]] is an adèle together with the extra data an idèle carries (a finite set of distinguished units); `Adele(idele)` forgets that and keeps only the value.",
    ],
    examples: [
      {
        id: "the-principal-adele-5-at-every-place",
        expr: ["Adele", 5],
        expected: ["Adele", 5, 5],
        caption: "the principal adèle: 5 at every place",
      },
      {
        id: "adele-2-profinitenumber-1-6-times-3",
        expr: ["Multiply", ["Adele", 2, ["ProfiniteNumber", 1, 6]], 3],
        expected: ["Adele", 6, ["ProfiniteNumber", 3, 18]],
      },
      {
        id: "the-adele-underlying-an-idele",
        expr: ["Adele", ["Idele", 1, 1, ["List", ["AdicNumeral", 3, 2, 2]]]],
        expected: ["Adele", 1, ["ProfiniteNumber", 11, 18]],
        caption: "the adèle underlying an idèle",
        category: "Scope",
      },
    ],
    seeAlso: ["ProfiniteNumber", "Idele"],
  },
  {
    name: "Idele",
    domain: "Adèles and idèles",
    signature: "Idele(r, s?, units?)",
    summary:
      "An idèle: a unit of the adèle ring — a real $r$ together with $s \\in \\mathbb{Q}^\\times$ principal everywhere except at a listed finite set of primes, where distinguished units override it.",
    signatures: [
      {
        call: "Idele(r, s, units)",
        description: "real $r$, principal value $s$ at every prime not named in `units`",
        library: "enumeratio-adeles",
      },
      {
        call: "Idele(q)",
        description: "the principal idèle of a non-zero rational $q$: $q$ at every place",
        library: "enumeratio-adeles",
      },
    ],
    details: [
      "`Multiply` on idèles multiplies real parts, principal values and any shared or distinguished unit parts; an idèle is invertible whenever $r \\ne 0$ and $s \\ne 0$.",
      "`units` is a list of [[AdicNumeral]] values at distinct primes, each overriding the principal value $s$ there.",
      "[[Adele]]`(idele)` forgets the idèle structure and keeps only its value as an adèle.",
    ],
    examples: [
      {
        id: "the-principal-idele-7-at-every-place",
        expr: ["Idele", 7],
        expected: ["Idele", 7, 7],
        caption: "the principal idèle: 7 at every place",
      },
      {
        id: "7-and-its-inverse-cancel-everywhere",
        expr: ["Multiply", ["Idele", 7], ["Idele", ["Rational", 1, 7]]],
        expected: ["Idele", 1, 1],
        caption: "7 and its inverse cancel everywhere",
      },
    ],
    seeAlso: ["Adele", "ProfiniteNumber"],
  },
  {
    name: "ProfiniteDecomposition",
    domain: "Adèles and idèles",
    signature: "ProfiniteDecomposition(m, d?)",
    summary:
      "$\\{b, a\\}$ with $m = b \\cdot a$, $b \\in GL_n(\\hat{\\mathbb{Z}})$ and $a \\in GL_n^+(\\mathbb{Q})$ upper triangular — strong approximation for a matrix over $\\hat{\\mathbb{Q}}$.",
    signatures: [
      {
        call: "ProfiniteDecomposition(m)",
        description:
          "$m$ a square matrix (list of lists) of [[ProfiniteNumber]] or rational entries",
        library: "enumeratio-adeles",
      },
      {
        call: "ProfiniteDecomposition(m, d)",
        description:
          "with $d$ = $\\det m$ supplied explicitly rather than computed from $m$'s entries",
        library: "enumeratio-adeles",
      },
    ],
    details: [
      "Hertogh's Algorithm 8.4: $GL_n(\\hat{\\mathbb{Q}}) = GL_n(\\hat{\\mathbb{Z}}) \\cdot GL_n^+(\\mathbb{Q})$, strong approximation for $GL_n$ over $\\mathbb{Q}$.",
      "$b$'s entries are profinite numbers; $a$'s are rationals. Built on [[HermiteDecomposition]] of the denominators.",
    ],
    examples: [
      {
        id: "already-in-gl-n-q-upper-triangular-form-b-is-the",
        expr: ["ProfiniteDecomposition", ["List", ["List", 2, 1], ["List", 0, 3]]],
        expected: [
          "List",
          ["List", ["List", 1, 0], ["List", 0, 1]],
          ["List", ["List", 2, 1], ["List", 0, 3]],
        ],
        caption: "already in $GL_n^+(\\mathbb{Q})$ upper-triangular form: $b$ is the identity",
      },
    ],
    seeAlso: ["HermiteDecomposition", "ProfiniteNumber"],
  },
  {
    name: "ProfinitePlot",
    domain: "Adèles and idèles",
    signature: "ProfinitePlot(f, x, k?)",
    summary:
      "The graph of $f: \\hat{\\mathbb{Z}} \\to \\hat{\\mathbb{Z}}$ in the variable $x$, at precision $k$ (default 5) — Lenstra's picture of a profinite function, drawn as an [[ArrayPlot]].",
    signatures: [
      {
        call: "ProfinitePlot(f, x, k)",
        description: "residue classes mod $k!$ laid out by their factorial digits",
        library: "enumeratio-adeles",
      },
      {
        call: "ProfinitePlot(f, x)",
        description: "default precision $k = 5$",
        library: "enumeratio-adeles",
      },
    ],
    details: [
      "Each cell is a pair of residue classes mod $k!$; a cell is filled when $f$ maps its column class into its row class, evaluating $f$ on `ProfiniteNumber(a, k!)` for every $a$.",
      "$k$ is capped at 6 ($6! = 720$ cells a side) to keep the plot tractable.",
      "The result is an [[ArrayPlot]] of 0/1 cells, as in Hertogh's `ProfiniteGraph`.",
    ],
    examples: [
      {
        id: "the-identity-function-an-anti-diagonal-of-filled",
        expr: ["ProfinitePlot", "x", "x", 3],
        expected: [
          "ArrayPlot",
          [
            "List",
            ["List", 0, 0, 0, 0, 0, 1],
            ["List", 0, 0, 0, 0, 1, 0],
            ["List", 0, 0, 0, 1, 0, 0],
            ["List", 0, 0, 1, 0, 0, 0],
            ["List", 0, 1, 0, 0, 0, 0],
            ["List", 1, 0, 0, 0, 0, 0],
          ],
        ],
        caption: "the identity function: an anti-diagonal of filled cells",
      },
    ],
    seeAlso: ["ProfiniteNumber", "ArrayPlot"],
  },
];

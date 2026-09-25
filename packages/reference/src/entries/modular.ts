// GENERATED from YAML by packages/reference/scripts/migrate/shims.ts -- do not edit.
// Edit the YAML named in `sources`, then run `node packages/reference/scripts/migrate/shims.ts`.

import type { ReferenceEntry } from "@enumeratio/entry";

/** The YAML each entry below was generated from, in the same order. */
export const sources: readonly string[] = [
  "packages/symbols/groups/modular/reference/ModularMatrix.yaml",
  "packages/symbols/groups/modular/reference/ModularWord.yaml",
  "packages/symbols/groups/modular/reference/ContinuedFraction.yaml",
  "packages/symbols/groups/modular/reference/Convergents.yaml",
  "packages/symbols/groups/modular/reference/ContinuedFractionK.yaml",
  "packages/symbols/groups/modular/reference/IsQuadraticIrrational.yaml",
  "packages/symbols/groups/modular/reference/ModularClasses.yaml",
  "packages/symbols/groups/modular/reference/RademacherSymbol.yaml",
  "packages/symbols/groups/modular/reference/FormClassNumber.yaml",
];

export const modular: readonly ReferenceEntry[] = [
  {
    name: "ModularMatrix",
    domain: "The modular group",
    signature: "ModularMatrix(a, b, c, d)",
    summary:
      "An element of $\\mathrm{PSL}(2,\\mathbb{Z})$ — or an $LR$ word standing for one. Wolfram has no dedicated modular-group heads: elements multiply, invert and raise to a power exactly like any other integer matrix, via `Dot`, `Inverse` and `MatrixPower` — which is why those are widened in place to recognise a `ModularMatrix` or a word, rather than declared afresh.",
    signatures: [
      {
        call: "ModularMatrix(a, b, c, d)",
        description: "the matrix $\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}$, determinant 1",
        library: "enumeratio-modular",
      },
      { call: "Dot(m, n)", description: "the group product — compute-engine's own head" },
      {
        call: "MatrixPower(m, k)",
        description: "$m$ to the $k$-th power, for any integer $k$ — compute-engine's own head",
      },
      { call: "Inverse(m)", description: "the group inverse — compute-engine's own head" },
    ],
    details: [
      'Every head here also accepts a WORD in place of a matrix — `ModularMatrix("LR")` or just the string',
      "A plain nested-list matrix pairs with a `ModularMatrix` too, since it canonicalises the same way; a `Tuple` or a `Vector` does not, and is left unevaluated — there's no settled convention for what that pairing should mean",
      "$M$ and $-M$ are the same element of $\\mathrm{PSL}(2,\\mathbb{Z})$, so `Inverse` and `MatrixPower` may hand back the negated matrix",
    ],
    examples: [
      {
        id: "the-group-product",
        expr: ["Dot", ["ModularMatrix", 1, 1, 0, 1], ["ModularMatrix", 1, 0, 1, 1]],
        expected: ["ModularMatrix", 2, 1, 1, 1],
        caption: "the group product",
      },
      {
        id: "no-division-needed-at-determinant-1",
        expr: ["Inverse", ["ModularMatrix", 1, 1, 0, 1]],
        expected: ["ModularMatrix", 1, -1, 0, 1],
        caption: "no division needed at determinant 1",
      },
      {
        id: "t-5",
        expr: ["MatrixPower", ["ModularMatrix", 1, 1, 0, 1], 5],
        expected: ["ModularMatrix", 1, 5, 0, 1],
        caption: "$T^5$",
      },
      {
        id: "words-multiply-their-matrices",
        expr: ["Dot", "'L'", "'R'"],
        expected: ["ModularMatrix", 1, 1, 1, 2],
        caption: "words multiply their matrices",
        category: "Scope",
        divergence: {
          wolfram:
            "Wolfram has no word spelling for a modular-group element; its Dot leaves two strings unevaluated.",
        },
      },
      {
        id: "the-inverse-of-a-word",
        expr: ["Inverse", "'L'"],
        expected: ["ModularMatrix", 1, 0, -1, 1],
        caption: "the inverse of a word",
        category: "Scope",
      },
      {
        id: "r-3",
        expr: ["MatrixPower", "'R'", 3],
        expected: ["ModularMatrix", 1, 3, 0, 1],
        caption: "$R^3$",
        category: "Scope",
      },
      {
        id: "negative-powers-are-powers-of-the-inverse",
        expr: ["MatrixPower", ["ModularMatrix", 1, 1, 1, 2], -2],
        expected: ["ModularMatrix", 5, -3, -3, 2],
        caption: "negative powers are powers of the inverse",
        category: "Scope",
      },
      {
        id: "the-zeroth-power-is-the-identity",
        expr: ["MatrixPower", ["ModularMatrix", 1, 1, 0, 1], 0],
        expected: ["ModularMatrix", 1, 0, 0, 1],
        caption: "the zeroth power is the identity",
        category: "Properties",
      },
      {
        id: "a-plain-integer-matrix-goes-to-compute-engine-s",
        expr: ["MatrixPower", ["List", ["List", 1, 1], ["List", 1, 0]], 10],
        expected: ["List", ["List", 89, 55], ["List", 55, 34]],
        caption:
          "a plain integer matrix goes to compute-engine's own `MatrixPower`: the Fibonacci numbers $F_{11}, F_{10}, F_9$",
        category: "Applications",
      },
    ],
    seeAlso: ["ModularWord", "RademacherSymbol"],
  },
  {
    name: "ModularWord",
    domain: "The modular group",
    signature: "ModularWord(matrix)",
    summary:
      "The unique positive word in $L$ and $R$ of a matrix in $\\mathrm{PSL}(2,\\mathbb{Z})$ with non-negative entries — which is also its path down the Stern–Brocot tree.",
    signatures: [
      {
        call: "ModularWord(matrix)",
        description: "the positive $LR$ word",
        library: "enumeratio-modular",
      },
      {
        call: "ModularMatrix(a, b, c, d)",
        description: "a matrix; every head here also accepts the word in its place",
        library: "enumeratio-modular",
      },
      {
        call: "ModularSTWord(matrix)",
        description: "the alternating $S$/$T$ factorisation, as its list of $T$-exponents",
        library: "enumeratio-modular",
      },
    ],
    details: [
      "$L = \\begin{pmatrix}1&0\\\\1&1\\end{pmatrix}$ and $R = \\begin{pmatrix}1&1\\\\0&1\\end{pmatrix}$ generate the positive cone",
      "The peel never searches: $R$ comes off when $a \\ge c$ and $b \\ge d$, $L$ when $c \\ge a$ and $d \\ge b$, and both at once would force determinant $0$",
      "`ModularKind` sorts by $|\\mathrm{tr}|$ against $2$ — elliptic, parabolic, hyperbolic",
      "A positive word is hyperbolic exactly when it uses both letters; all-$L$ and all-$R$ are parabolic",
      "Rebuilding from an $S$/$T$ word can return $-M$: that sign is the $\\pm I$ that $\\mathrm{PSL}$ quotients out",
    ],
    examples: [
      {
        id: "the-shortest-geodesic",
        expr: ["ModularWord", ["ModularMatrix", 1, 1, 1, 2]],
        expected: "'LR'",
        caption: "the shortest geodesic",
      },
      {
        id: "a-word-evaluates-as-its-matrix",
        expr: ["ModularTrace", "'LRLR'"],
        expected: 7,
        caption: "a word evaluates as its matrix",
      },
      {
        id: "t-5-fixes-a-cusp",
        expr: ["ModularKind", ["ModularMatrix", 1, 5, 0, 1]],
        expected: "'Parabolic'",
        caption: "$T^5$ fixes a cusp",
        category: "Properties",
      },
      {
        id: "the-s-t-exponents-are-a-continued-fraction",
        expr: ["ModularSTWord", ["ModularMatrix", 1, 5, 0, 1]],
        expected: ["List", 5],
        caption: "the $S$/$T$ exponents are a continued fraction",
        category: "Scope",
      },
    ],
    seeAlso: ["ContinuedFraction", "ModularClasses", "RademacherSymbol"],
  },
  {
    name: "ContinuedFraction",
    domain: "The modular group",
    signature: "ContinuedFraction(x)",
    summary:
      "The regular continued fraction $[a_0; a_1, a_2, \\dots]$ of $p/q$. Its partial quotients are the run lengths of the rational's Stern–Brocot path, and the $T$-exponents of its matrix — one object under three names.",
    signatures: [
      {
        call: "ContinuedFraction(x)",
        description: "the partial quotients of a rational — compute-engine's own head",
      },
      {
        call: "ContinuedFraction(x)",
        description:
          "for a quadratic irrational, the exact eventually-periodic expansion $[a_0, \\overline{a_1,\\dots,a_k}]$, the period written as a nested list",
        library: "enumeratio-modular",
      },
      {
        call: "ContinuedFraction(x, n)",
        description:
          "the first $n$ terms — exact for a quadratic irrational, certified-precision otherwise (compute-engine's own signature, extended)",
      },
      {
        call: "FromContinuedFraction(list)",
        description: "back to the rational — compute-engine's own",
      },
      {
        call: "FromContinuedFraction([a0, [period]])",
        description: "back to the quadratic irrational, from its periodic-tail shape",
        library: "enumeratio-modular",
      },
      {
        call: "SternBrocotPath(p, q)",
        description: "the same data as a word in $L$ and $R$",
        library: "enumeratio-modular",
      },
      {
        call: "FareySequence(n)",
        description: "every reduced $p/q$ in $[0,1]$ with $q \\le n$, in order",
        library: "enumeratio-modular",
      },
    ],
    details: [
      '`ContinuedFraction` and `FromContinuedFraction` are compute-engine\'s heads, extended in place rather than redeclared — pass the RATIONAL, not a numerator and denominator, since the two-argument form means "the first $n$ terms"',
      "For a quadratic irrational $(a+b\\sqrt d)/c$, the one-argument form runs the exact PQa algorithm over bigints and returns the eventually-periodic expansion; the two-argument form truncates it. Anything else irrational — $\\pi$, $e$, a cube root, a sum of surds, the named `GoldenRatio` — goes through a BigDecimal extraction certified by agreement across two working precisions, so it isn't limited to double precision",
      "The expansion is made unique by never ending in $1$: $[\\ldots, k, 1]$ is rewritten $[\\ldots, k+1]$",
      "The path is $R^{a_0}L^{a_1}R^{a_2}\\cdots$ with the LAST exponent one short — the final step is the arrival, not a turn",
      "Consecutive Farey fractions satisfy $ps - qr = -1$, which is a determinant, which is a group element",
      "The Fibonacci fractions alternate $RLRL\\dots$, the sense in which $\\varphi$ is the most irrational number",
    ],
    examples: [
      {
        id: "pi-s-famous-convergent",
        expr: ["ContinuedFraction", ["Rational", 355, 113]],
        expected: ["List", 3, 7, 16],
        caption: "$\\pi$'s famous convergent",
      },
      {
        id: "5-3-1-1-2",
        expr: ["SternBrocotPath", 5, 3],
        expected: "'RLR'",
        caption: "$5/3 = [1; 1, 2]$",
      },
      {
        id: "and-back-again",
        expr: ["FromSternBrocotPath", "'RLR'"],
        expected: ["Rational", 5, 3],
        caption: "and back again",
        category: "Properties",
      },
      {
        id: "1-cdot-2-3-cdot-1-1",
        expr: ["FareyNeighbours", 1, 3, 1, 2],
        expected: "True",
        caption: "$1\\cdot2 - 3\\cdot1 = -1$",
        category: "Properties",
      },
      {
        id: "47-17-2-1-1-1-3-1-4",
        expr: ["ContinuedFraction", ["Rational", 47, 17]],
        expected: ["List", 2, 1, 3, 4],
        caption: "$47/17 = 2 + 1/(1 + 1/(3 + 1/4))$",
      },
      {
        id: "the-first-20-terms-of-a-quadratic-irrational",
        expr: ["ContinuedFraction", ["Sqrt", 13], 20],
        expected: ["List", 3, 1, 1, 1, 1, 6, 1, 1, 1, 1, 6, 1, 1, 1, 1, 6, 1, 1, 1, 1],
        caption: "the first 20 terms of a quadratic irrational — periodic after $a_0$",
      },
      {
        id: "e-s-pattern-1-2k-1",
        expr: ["ContinuedFraction", "ExponentialE", 10],
        expected: ["List", 2, 1, 2, 1, 1, 4, 1, 1, 6, 1],
        caption: "$e$'s pattern $1, 2k, 1$",
        category: "Scope",
      },
      {
        id: "any-constant-compute-engine-can-evaluate",
        expr: ["ContinuedFraction", "EulerGamma", 10],
        expected: ["List", 0, 1, 1, 2, 1, 2, 1, 4, 3, 13],
        caption: "any constant compute-engine can evaluate numerically",
        category: "Scope",
      },
      {
        id: "a-floating-point-number-read-as-the-rational-it",
        expr: ["ContinuedFraction", 3.245],
        expected: ["List", 3, 4, 12, 4],
        caption: "a floating-point number, read as the rational it prints as, $649/200$",
        category: "Scope",
      },
      {
        id: "negative-a-floor-for-a-0-then-positive-terms-3-1",
        expr: ["ContinuedFraction", ["Rational", -47, 17]],
        expected: ["List", -3, 4, 4],
        caption: "negative: a floor for $a_0$, then positive terms — $-3 + 1/(4 + 1/4)$",
        category: "Possible issues",
        divergence: { wolfram: "Wolfram negates every term instead, giving {-2, -1, -3, -4}." },
      },
      {
        id: "fromcontinuedfraction-inverts-it",
        expr: ["FromContinuedFraction", ["ContinuedFraction", ["Rational", 47, 17]]],
        expected: ["Rational", 47, 17],
        caption: "`FromContinuedFraction` inverts it",
        category: "Properties",
      },
      {
        id: "20-terms-of-pi-past-the-13-term-double-precision",
        expr: ["ContinuedFraction", "Pi", 20],
        expected: ["List", 3, 7, 15, 1, 292, 1, 1, 1, 2, 1, 3, 1, 14, 2, 1, 1, 2, 2, 2, 2],
        caption:
          "20 terms of $\\pi$, past the 13-term double-precision wall — certified BigDecimal",
      },
      {
        id: "a-quadratic-irrational-s-exact-expansion-is",
        expr: ["ContinuedFraction", ["Sqrt", 13]],
        expected: ["List", 3, ["List", 1, 1, 1, 1, 6]],
        caption:
          "a quadratic irrational's exact expansion is eventually periodic, written with the period as a nested list",
      },
      {
        id: "varphi-1-overline-1-purely-periodic-so-the",
        expr: ["ContinuedFraction", ["Divide", ["Add", 1, ["Sqrt", 5]], 2]],
        expected: ["List", 1, ["List", 1]],
        caption: "$\\varphi = [1; \\overline{1}]$ — purely periodic, so the period is all there is",
        category: "Scope",
      },
      {
        id: "the-named-constant-unfolded-to-1-sqrt-5-2-first",
        expr: ["ContinuedFraction", "GoldenRatio", 10],
        expected: ["List", 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        caption: "the named constant, unfolded to $(1+\\sqrt5)/2$ first",
        category: "Scope",
      },
      {
        id: "a-sum-of-surds-still-a-quadratic-irrational",
        expr: ["ContinuedFraction", ["Add", 1, ["Sqrt", 2]], 5],
        expected: ["List", 2, 2, 2, 2, 2],
        caption: "a sum of surds — still a quadratic irrational, exact via PQa",
        category: "Scope",
      },
      {
        id: "a-cube-root-algebraic-degree-3-not-periodic-so-a",
        expr: ["ContinuedFraction", ["Power", 2, ["Rational", 1, 3]], 10],
        expected: ["List", 1, 3, 1, 5, 1, 1, 4, 1, 1, 8],
        caption:
          "a cube root, algebraic degree 3 — not periodic, so a certified BigDecimal expansion",
        category: "Scope",
      },
      {
        id: "a-periodic-tail-rebuilds-the-quadratic",
        expr: ["FromContinuedFraction", ["List", 3, ["List", 1, 1, 1, 1, 6]]],
        expected: ["Sqrt", 13],
        caption: "a periodic tail rebuilds the quadratic irrational",
        category: "Properties",
      },
      {
        id: "1-overline-2-sqrt-2",
        expr: ["FromContinuedFraction", ["List", 1, ["List", 2]]],
        expected: ["Sqrt", 2],
        caption: "$[1; \\overline{2}] = \\sqrt2$",
        category: "Properties",
      },
      {
        id: "symbolic-terms-build-the-nested-fraction-left",
        expr: ["FromContinuedFraction", ["List", "a", "b", "c"]],
        expected: ["Add", "a", ["Divide", 1, ["Add", "b", ["Divide", 1, "c"]]]],
        caption: "symbolic terms build the nested fraction, left uncombined",
        category: "Scope",
        divergence: {
          wolfram:
            "Wolfram's own FromContinuedFraction[{a,b,c}] combines it into the single ratio (a + (1+ab)c)/(1+bc); we leave the nested a + 1/(b + 1/c) form, matching what a reader would write down term by term.",
        },
      },
    ],
    seeAlso: ["ModularWord", "IntegerDigits", "Convergents"],
  },
  {
    name: "Convergents",
    domain: "The modular group",
    signature: "Convergents(list) / Convergents(x, n)",
    summary:
      "The successive convergents $p_k/q_k$ of a continued fraction, given as its list of terms or as the number itself.",
    signatures: [
      {
        call: "Convergents(list)",
        description: "the convergents of a term list, such as one `ContinuedFraction` returns",
        library: "enumeratio-modular",
      },
      {
        call: "Convergents(x)",
        description: "every convergent of a rational $x$ — the last one is $x$ itself",
        library: "enumeratio-modular",
      },
      {
        call: "Convergents(x, n)",
        description: "the first $n$ convergents of $x$, via `ContinuedFraction(x, n)`",
        library: "enumeratio-modular",
      },
    ],
    details: [
      "The two-term recurrence $p_k = a_k p_{k-1} + p_{k-2}$, $q_k = a_k q_{k-1} + q_{k-2}$, seeded $p_{-1}=1, p_{-2}=0, q_{-1}=0, q_{-2}=1$ — the same recurrence [[ModularMatrix]] multiplication runs, one $T^{a_k}S$ at a time",
      "Every convergent is in lowest terms, and each is a better rational approximation of $x$ than any fraction with a smaller denominator",
      "`Convergents(x)` (no `n`) needs a RATIONAL $x$, since `ContinuedFraction(x)` alone does; an irrational needs `Convergents(x, n)`",
    ],
    examples: [
      {
        id: "from-a-list-of-terms",
        expr: ["Convergents", ["List", 3, 7, 15, 1]],
        expected: ["List", 3, ["Rational", 22, 7], ["Rational", 333, 106], ["Rational", 355, 113]],
        caption: "from a list of terms",
      },
      {
        id: "the-first-five-convergents-of-pi",
        expr: ["Convergents", "Pi", 5],
        expected: [
          "List",
          3,
          ["Rational", 22, 7],
          ["Rational", 333, 106],
          ["Rational", 355, 113],
          ["Rational", 103993, 33102],
        ],
        caption: "the first five convergents of $\\pi$",
      },
      {
        id: "a-rational-the-last-convergent-is-the-number",
        expr: ["Convergents", ["Rational", 47, 17]],
        expected: ["List", 2, 3, ["Rational", 11, 4], ["Rational", 47, 17]],
        category: "Scope",
        caption: "a rational: the last convergent is the number itself",
      },
      {
        id: "convergents-of-sqrt-2-solve-pell-s-equations-p-2",
        expr: ["Convergents", ["Sqrt", 2], 5],
        expected: [
          "List",
          1,
          ["Rational", 3, 2],
          ["Rational", 7, 5],
          ["Rational", 17, 12],
          ["Rational", 41, 29],
        ],
        category: "Applications",
        caption: "convergents of $\\sqrt2$ solve Pell's equations $p^2 - 2q^2 = \\pm1$",
      },
    ],
    seeAlso: ["ContinuedFraction", "ContinuedFractionK"],
  },
  {
    name: "ContinuedFractionK",
    domain: "The modular group",
    signature: "ContinuedFractionK(f, g, (i, imin, imax))",
    summary:
      "The continued fraction $f_1/(g_1 + f_2/(g_2 + \\cdots))$ over an index range, finite or infinite.",
    signatures: [
      {
        call: "ContinuedFractionK(f, g, (i, imin, imax))",
        description: "the finite continued fraction, exact, for `imin ≤ i ≤ imax`",
        library: "enumeratio-modular",
      },
      {
        call: "ContinuedFractionK(f, g, (i, imin, PositiveInfinity))",
        description: "the infinite fraction, when $f$ and $g$ do not depend on $i$",
        library: "enumeratio-modular",
      },
    ],
    details: [
      "The iterator is written the same way `Sum` and `Product` write theirs: `Tuple(i, imin, imax)`",
      "The finite fraction is built right to left: $f_{imax}/g_{imax}$ first, then each $f_i/(g_i + \\text{that})$ down to $i = imin$",
      "The infinite case is solved algebraically, not truncated: constant $f, g$ make $x = f/(g+x)$, whose positive root $x = (-g + \\sqrt{g^2+4f})/2$ is the fraction's value — an $f$ or $g$ that depends on $i$ has no such closed form here, and the call stays unevaluated",
    ],
    examples: [
      {
        id: "cfrac-1-1-cfrac-1-2-cfrac-1-3-cfrac-1-4-cfrac-15",
        expr: ["ContinuedFractionK", 1, "k", ["Tuple", "k", 1, 5]],
        expected: ["Rational", 157, 225],
        caption: "$\\cfrac{1}{1 + \\cfrac{1}{2 + \\cfrac{1}{3 + \\cfrac{1}{4 + \\cfrac15}}}}$",
      },
      {
        id: "the-infinite-all-ones-fraction-is-1-varphi-sqrt",
        expr: ["ContinuedFractionK", 1, 1, ["Tuple", "k", 1, "PositiveInfinity"]],
        expected: ["Multiply", ["Rational", 1, 2], ["Add", -1, ["Sqrt", 5]]],
        category: "Scope",
        caption: "the infinite all-ones fraction is $1/\\varphi$ — $(\\sqrt5 - 1)/2$",
      },
    ],
    seeAlso: ["Convergents", "ContinuedFraction"],
  },
  {
    name: "IsQuadraticIrrational",
    domain: "The modular group",
    signature: "IsQuadraticIrrational(x)",
    summary:
      "True when $x$ is an irrational root of a quadratic with integer coefficients — exactly the numbers with an eventually periodic continued fraction.",
    signatures: [
      {
        call: "IsQuadraticIrrational(x)",
        description: "whether $x$ is a quadratic irrational",
        library: "enumeratio-modular",
      },
    ],
    details: [
      "Recognised structurally: a rational affine combination with exactly one irrational `Sqrt` term, at any rational scale — $\\sqrt n$, $3\\sqrt2$, $1+\\sqrt5$, $(1+\\sqrt5)/2$, $1-\\sqrt3$",
      "A rational is not irrational, so it is `False`, not merely unrecognised",
      "Wolfram calls this `QuadraticIrrationalQ`; the name here follows compute-engine's own `Is…` convention instead",
      "Every quadratic irrational's continued fraction is eventually periodic (Lagrange's theorem), and conversely — see [[ContinuedFraction]]",
    ],
    examples: [
      {
        id: "isquadraticirrational-sqrt-2",
        expr: ["IsQuadraticIrrational", ["Sqrt", 2]],
        expected: "True",
      },
      {
        id: "the-golden-ratio",
        expr: ["IsQuadraticIrrational", ["Divide", ["Add", 1, ["Sqrt", 5]], 2]],
        expected: "True",
        caption: "the golden ratio",
      },
      {
        id: "a-cube-root-is-algebraic-of-degree-3",
        expr: ["IsQuadraticIrrational", ["Power", 2, ["Rational", 1, 3]]],
        expected: "False",
        caption: "a cube root is algebraic of degree 3",
      },
      {
        id: "a-rational-is-not-irrational",
        expr: ["IsQuadraticIrrational", ["Rational", 3, 4]],
        expected: "False",
        category: "Possible issues",
        caption: "a rational is not irrational",
      },
      {
        id: "transcendental",
        expr: ["IsQuadraticIrrational", "Pi"],
        expected: "False",
        category: "Scope",
        caption: "transcendental",
      },
    ],
    seeAlso: ["ContinuedFraction", "Convergents"],
  },
  {
    name: "ModularClasses",
    domain: "The modular group",
    signature: "ModularClasses(length, primitive?)",
    summary:
      "Every hyperbolic conjugacy class whose $LR$ word has the given length — equivalently, every closed geodesic of that symbolic period on the modular surface. Conjugation rotates the word, so the classes are binary NECKLACES.",
    signatures: [
      {
        call: "ModularClasses(length)",
        description: "the classes, each named by the least rotation of its word",
        library: "enumeratio-modular",
      },
      {
        call: "ModularClasses(length, True)",
        description: "only the primitive ones — not a repeat of a shorter geodesic",
        library: "enumeratio-modular",
      },
      {
        call: "ModularClass(word)",
        description: "the canonical name of one class",
        library: "enumeratio-modular",
      },
    ],
    details: [
      "Conjugating by the first letter rotates the word: $x^{-1}(xw)x = wx$",
      "The count is $\\frac1n\\sum_{d\\mid n}\\varphi(d)2^{n/d} - 2$ — binary necklaces, less the two constant ones, which are parabolic",
      "The primitive classes are the aperiodic necklaces, counted by $\\frac1n\\sum_{d\\mid n}\\mu(d)2^{n/d}$ — Lyndon words",
      "Word length is the SYMBOLIC period; the geodesic's length is $2\\,\\mathrm{arccosh}(|\\mathrm{tr}|/2)$, and the two orderings differ",
    ],
    examples: [
      {
        id: "four-closed-geodesics-of-symbolic-length-4",
        expr: ["ModularClasses", 4],
        expected: ["List", "'LLLR'", "'LLRR'", "'LRLR'", "'LRRR'"],
        caption: "four closed geodesics of symbolic length 4",
      },
      {
        id: "the-same-geodesic-entered-elsewhere",
        expr: ["ModularClass", "'LRL'"],
        expected: "'LLR'",
        caption: "the same geodesic, entered elsewhere",
        category: "Properties",
      },
      {
        id: "lrlr-is-lr-traversed-twice",
        expr: ["IsPrimitiveClass", "'LRLR'"],
        expected: "False",
        caption: "$LRLR$ is $LR$ traversed twice",
        category: "Properties",
      },
      {
        id: "same-word-length-as-lllr-different-geodesic",
        expr: ["ModularTrace", "'LRLR'"],
        expected: 7,
        caption: "same word length as $LLLR$, different geodesic length",
        category: "Scope",
      },
    ],
    seeAlso: ["RademacherSymbol", "ModularWord"],
  },
  {
    name: "RademacherSymbol",
    domain: "The modular group",
    signature: "RademacherSymbol(matrix)",
    summary:
      "The Rademacher symbol $\\Psi$ of a hyperbolic element. By Ghys's theorem it is the linking number of the element's modular knot with the trefoil — and it is also just the number of $R$'s minus the number of $L$'s in its word.",
    signatures: [
      {
        call: "RademacherSymbol(matrix)",
        description: "$\\Psi(M) = \\Phi(M) - 3\\,\\mathrm{sign}(c(a+d))$, via Dedekind sums",
        library: "enumeratio-modular",
      },
      {
        call: "WordSymbol(word)",
        description: "the same number by counting letters",
        library: "enumeratio-modular",
      },
      {
        call: "LinkingWithTrefoil(matrix)",
        description: "the same number again, named for what it measures",
        library: "enumeratio-modular",
      },
      {
        call: "DedekindSum(h, k)",
        description: "$s(h,k)$, exactly",
        library: "enumeratio-modular",
      },
    ],
    details: [
      "$\\mathrm{SL}(2,\\mathbb{Z})\\backslash\\mathrm{SL}(2,\\mathbb{R})$ is the complement of a trefoil in $S^3$, so a closed orbit of the modular flow is a knot in that complement",
      "Ghys: the modular knots are exactly the LORENZ knots, and $\\mathrm{lk}(k_\\gamma,\\text{trefoil}) = \\Psi(\\gamma)$",
      "$\\Phi(M) = (a+d)/c - 12\\,\\mathrm{sign}(c)\\,s(d,|c|)$ is a quasimorphism, NOT a class function; only the corrected $\\Psi$ is",
      "Dedekind sums are checked against reciprocity, $s(h,k)+s(k,h) = -\\frac14 + \\frac{1}{12}(h/k + k/h + 1/hk)$",
      "$\\Psi$ is undefined on elliptic and parabolic elements — they have no closed geodesic",
    ],
    examples: [
      {
        id: "four-rights-one-left",
        expr: ["RademacherSymbol", "'LRRRR'"],
        expected: 3,
        caption: "four rights, one left",
      },
      {
        id: "turning-equally-both-ways-gives-linking-number",
        expr: ["LinkingWithTrefoil", "'LLRR'"],
        expected: 0,
        caption: "turning equally both ways gives linking number zero",
        category: "Properties",
      },
      {
        id: "the-arithmetic-side",
        expr: ["DedekindSum", 4, 3],
        expected: ["Rational", 1, 18],
        caption: "the arithmetic side",
        category: "Scope",
      },
      {
        id: "phi-on-t-n-just-counts",
        expr: ["RademacherPhi", ["ModularMatrix", 1, 7, 0, 1]],
        expected: 7,
        caption: "$\\Phi$ on $T^n$ just counts",
        category: "Scope",
      },
    ],
    seeAlso: ["ModularClasses", "ModularWord"],
  },
  {
    name: "FormClassNumber",
    domain: "The modular group",
    signature: "FormClassNumber(discriminant)",
    summary:
      "How many classes of indefinite binary quadratic forms a discriminant has. A class is not one reduced form but a CYCLE of them, and that cycle is a periodic continued fraction — which is to say, a closed geodesic.",
    signatures: [
      {
        call: "FormClassNumber(D)",
        description: "the number of classes",
        library: "enumeratio-modular",
      },
      {
        call: "FormCycle(form)",
        description: "the class the form lies in, listed",
        library: "enumeratio-modular",
      },
      {
        call: "ReducedForms(D)",
        description: "every reduced form of that discriminant",
        library: "enumeratio-modular",
      },
      {
        call: "FormAutomorph(form)",
        description: "the hyperbolic matrix generating the form's stabiliser",
        library: "enumeratio-modular",
      },
      {
        call: "PellSolution(D)",
        description: "the fundamental $(t, u)$ with $t^2 - Du^2 = 4$",
        library: "enumeratio-modular",
      },
    ],
    details: [
      "Indefinite means $D > 0$ and $D$ is not a perfect square; a square discriminant gives a form that factors, with no cycle",
      "$\\mathrm{SL}(2,\\mathbb{Z})$ acts by $(x,y) \\mapsto (px+qy, rx+sy)$ and preserves $D$, so classes live inside one discriminant",
      "Gauss's reduction condition is $|\\sqrt{D} - 2|a|| < b < \\sqrt{D}$, and `FormRho` steps round the cycle",
      "A cycle's length is always even, because $\\rho$ flips the sign of the leading coefficient",
      "The automorph has trace $t > 2$, hence is hyperbolic — so a form class IS one of the closed geodesics [[ModularClasses]] counts",
      "A discriminant $\\not\\equiv 0, 1 \\pmod 4$ has no forms at all, and the class number is 0",
    ],
    examples: [
      {
        id: "four-classes-of-discriminant-60",
        expr: ["FormClassNumber", 60],
        expected: 4,
        caption: "four classes of discriminant 60",
      },
      {
        id: "the-action-preserves-the-discriminant",
        expr: [
          "FormDiscriminant",
          ["FormAction", ["QuadraticForm", 1, 1, -1], ["ModularMatrix", 1, 1, 0, 1]],
        ],
        expected: 5,
        caption: "the action preserves the discriminant",
        category: "Properties",
      },
      {
        id: "3-2-5-cdot-1-2-4",
        expr: ["PellSolution", 5],
        expected: ["List", 3, 1],
        caption: "$3^2 - 5\\cdot 1^2 = 4$",
        category: "Properties",
      },
      {
        id: "the-class-read-back-as-a-geodesic",
        expr: ["ModularWord", ["FormAutomorph", ["QuadraticForm", 1, 1, -1]]],
        expected: "'LR'",
        caption: "the class, read back as a geodesic",
        category: "Applications",
      },
    ],
    seeAlso: ["ModularClasses", "ContinuedFraction", "RademacherSymbol"],
  },
];

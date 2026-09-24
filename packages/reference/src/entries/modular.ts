import type { MathJSON, ReferenceEntry } from "../types.ts";

const DOMAIN = "The modular group";
/** A MathJSON string literal — also the form these heads hand back. */
const W = (word: string): MathJSON => `'${word}'`;
const M = (a: number, b: number, c: number, d: number): MathJSON => ["ModularMatrix", a, b, c, d];
const F = (a: number, b: number, c: number): MathJSON => ["QuadraticForm", a, b, c];

export const modular: readonly ReferenceEntry[] = [
  {
    name: "ModularMatrix",
    domain: DOMAIN,
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
        expr: ["Dot", M(1, 1, 0, 1), M(1, 0, 1, 1)],
        expected: M(2, 1, 1, 1),
        caption: "the group product",
      },
      {
        expr: ["Inverse", M(1, 1, 0, 1)],
        expected: M(1, -1, 0, 1),
        caption: "no division needed at determinant 1",
      },
      {
        expr: ["MatrixPower", M(1, 1, 0, 1), 5],
        expected: M(1, 5, 0, 1),
        caption: "$T^5$",
      },
      {
        expr: ["Dot", W("L"), W("R")],
        expected: M(1, 1, 1, 2),
        caption: "words multiply their matrices",
        category: "Scope",
        divergence: {
          wolfram:
            "Wolfram has no word spelling for a modular-group element; its Dot leaves two strings unevaluated.",
        },
      },
      {
        expr: ["Inverse", W("L")],
        expected: M(1, 0, -1, 1),
        caption: "the inverse of a word",
        category: "Scope",
      },
      {
        expr: ["MatrixPower", W("R"), 3],
        expected: M(1, 3, 0, 1),
        caption: "$R^3$",
        category: "Scope",
      },
    ],
    seeAlso: ["ModularWord", "RademacherSymbol"],
  },
  {
    name: "ModularWord",
    domain: DOMAIN,
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
      { expr: ["ModularWord", M(1, 1, 1, 2)], expected: W("LR"), caption: "the shortest geodesic" },
      {
        expr: ["ModularTrace", W("LRLR")],
        expected: 7,
        caption: "a word evaluates as its matrix",
      },
      {
        expr: ["ModularKind", M(1, 5, 0, 1)],
        expected: W("Parabolic"),
        caption: "$T^5$ fixes a cusp",
        category: "Properties",
      },
      {
        expr: ["ModularSTWord", M(1, 5, 0, 1)],
        expected: ["List", 5],
        caption: "the $S$/$T$ exponents are a continued fraction",
        category: "Scope",
      },
    ],
    seeAlso: ["ContinuedFraction", "ModularClasses", "RademacherSymbol"],
  },
  {
    name: "ContinuedFraction",
    domain: DOMAIN,
    signature: "ContinuedFraction(x)",
    summary:
      "The regular continued fraction $[a_0; a_1, a_2, \\dots]$ of $p/q$. Its partial quotients are the run lengths of the rational's Stern–Brocot path, and the $T$-exponents of its matrix — one object under three names.",
    signatures: [
      {
        call: "ContinuedFraction(x)",
        description: "the partial quotients of a rational — compute-engine's own head",
      },
      {
        call: "ContinuedFraction(x, n)",
        description: "the first $n$ terms, for an irrational — also compute-engine's",
      },
      {
        call: "FromContinuedFraction(list)",
        description: "back to the rational — compute-engine's own",
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
      '`ContinuedFraction` and `FromContinuedFraction` are compute-engine\'s, not ours — pass the RATIONAL, not a numerator and denominator, since the two-argument form means "the first $n$ terms"',
      "The expansion is made unique by never ending in $1$: $[\\ldots, k, 1]$ is rewritten $[\\ldots, k+1]$",
      "The path is $R^{a_0}L^{a_1}R^{a_2}\\cdots$ with the LAST exponent one short — the final step is the arrival, not a turn",
      "Consecutive Farey fractions satisfy $ps - qr = -1$, which is a determinant, which is a group element",
      "The Fibonacci fractions alternate $RLRL\\dots$, the sense in which $\\varphi$ is the most irrational number",
    ],
    examples: [
      {
        expr: ["ContinuedFraction", ["Rational", 355, 113]],
        expected: ["List", 3, 7, 16],
        caption: "$\\pi$'s famous convergent",
      },
      {
        expr: ["SternBrocotPath", 5, 3],
        expected: W("RLR"),
        caption: "$5/3 = [1; 1, 2]$",
      },
      {
        expr: ["FromSternBrocotPath", W("RLR")],
        expected: ["Rational", 5, 3],
        caption: "and back again",
        category: "Properties",
      },
      {
        expr: ["FareyNeighbours", 1, 3, 1, 2],
        expected: "True",
        caption: "$1\\cdot2 - 3\\cdot1 = -1$",
        category: "Properties",
      },
    ],
    seeAlso: ["ModularWord", "IntegerDigits"],
  },
  {
    name: "ModularClasses",
    domain: DOMAIN,
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
        expr: ["ModularClasses", 4],
        expected: ["List", W("LLLR"), W("LLRR"), W("LRLR"), W("LRRR")],
        caption: "four closed geodesics of symbolic length 4",
      },
      {
        expr: ["ModularClass", W("LRL")],
        expected: W("LLR"),
        caption: "the same geodesic, entered elsewhere",
        category: "Properties",
      },
      {
        expr: ["IsPrimitiveClass", W("LRLR")],
        expected: "False",
        caption: "$LRLR$ is $LR$ traversed twice",
        category: "Properties",
      },
      {
        expr: ["ModularTrace", W("LRLR")],
        expected: 7,
        caption: "same word length as $LLLR$, different geodesic length",
        category: "Scope",
      },
    ],
    seeAlso: ["RademacherSymbol", "ModularWord"],
  },
  {
    name: "RademacherSymbol",
    domain: DOMAIN,
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
        expr: ["RademacherSymbol", W("LRRRR")],
        expected: 3,
        caption: "four rights, one left",
      },
      {
        expr: ["LinkingWithTrefoil", W("LLRR")],
        expected: 0,
        caption: "turning equally both ways gives linking number zero",
        category: "Properties",
      },
      {
        expr: ["DedekindSum", 4, 3],
        expected: ["Rational", 1, 18],
        caption: "the arithmetic side",
        category: "Scope",
      },
      {
        expr: ["RademacherPhi", M(1, 7, 0, 1)],
        expected: 7,
        caption: "$\\Phi$ on $T^n$ just counts",
        category: "Scope",
      },
    ],
    seeAlso: ["ModularClasses", "ModularWord"],
  },
  {
    name: "FormClassNumber",
    domain: DOMAIN,
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
        expr: ["FormClassNumber", 60],
        expected: 4,
        caption: "four classes of discriminant 60",
      },
      {
        expr: ["FormDiscriminant", ["FormAction", F(1, 1, -1), M(1, 1, 0, 1)]],
        expected: 5,
        caption: "the action preserves the discriminant",
        category: "Properties",
      },
      {
        expr: ["PellSolution", 5],
        expected: ["List", 3, 1],
        caption: "$3^2 - 5\\cdot 1^2 = 4$",
        category: "Properties",
      },
      {
        expr: ["ModularWord", ["FormAutomorph", F(1, 1, -1)]],
        expected: W("LR"),
        caption: "the class, read back as a geodesic",
        category: "Applications",
      },
    ],
    seeAlso: ["ModularClasses", "ContinuedFraction", "RademacherSymbol"],
  },
];

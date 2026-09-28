---
name: Sign
domain: Arithmetic
signature: Sign(x)
summary: "The sign of x: -1, 0, or 1 for negative, zero, or positive x."
signatures:
  - call: Sign(x)
    description: -1, 0, or 1 for negative, zero, or positive real x; $z/|z|$ for complex z.
  - call: Sign(x)
    description: "The sign of x: -1, 0, or 1 for negative, zero, or positive x."
    library: enumeratio-analytic
    type: (complex | signed_infinity) -> complex
    overrides: compute-engine
  - call: Sign(x)
    description: "The sign of x: -1, 0, or 1 for negative, zero, or positive x."
    library: enumeratio-collections
    type: (complex | signed_infinity) -> complex
    overrides: enumeratio-analytic
  - call: Sign(p)
    description: "A permutation's sign: 1 when it has an even number of inversions, -1 when odd (FindStat St000037)."
    library: enumeratio-statistics
    type: ((permutation) -> number) & ((complex | signed_infinity) -> complex)
    overrides: enumeratio-collections
details:
  - $\operatorname{sign}(x) = -1, 0, 1$ for $x < 0$, $x = 0$, $x > 0$ respectively.
  - For a complex number, $\operatorname{sign}(z) = z/|z|$, the unit complex number pointing toward z. See [[Abs]].
  - 'Recovers the original magnitude: $x = |x|\,\operatorname{sign}(x)$.'
  - $\operatorname{sign}(\pm\infty) = \pm 1$, but $\operatorname{sign}(\mathrm{NaN})$ propagates as NaN rather than 0.
seeAlso:
  - Abs
  - Negate
references:
  - system: wikipedia
    identity: Sign function
  - system: mathworld
    identity: Sign
names:
  dlmf: sign of
  wolframIdentity: true
bindings:
  - origin: mapped
    form: wolfram
    template: Sign[$1]
    arity: 1
    threadArg: 1
  - origin: mapped
    form: sympy
    template: sign($1)
    arity: 1
    threadArg: 1
  - origin: mapped
    form: mpmath
    template: sign($1)
    arity: 1
    threadArg: 1
  - origin: mapped
    form: sage
    template: sign($1)
    arity: 1
    threadArg: 1
statOn:
  - Permutation
---

---
name: DiracDelta
domain: Elementary functions
signature: DiracDelta(x1, x2, …)
summary: "The Dirac delta generalized function: 0 for any nonzero real argument, unevaluated at 0."
signatures:
  - call: DiracDelta(x)
    description: 0 if x is a nonzero real number; unevaluated (stays symbolic) at x = 0 or for a symbolic argument.
    library: "@enumeratio/analytic"
    type: (real, real*) -> number
  - call: DiracDelta(x1, x2, …)
    description: the multidimensional delta -- 0 as soon as any argument is a nonzero real, unevaluated otherwise.
    library: "@enumeratio/analytic"
    arity: 2
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: sympy
    template: DiracDelta($1)
    arity: 1
    threadArg: 1
    checked:
      version: 1.14.0
      on: 2026-10-14
---

- DiracDelta has no ordinary value at 0 -- it is not a function in the usual sense, so DiracDelta(0) stays unevaluated rather than becoming Infinity or an error.
- D(HeavisideTheta(x), x) = DiracDelta(x) -- see [[HeavisideTheta]].

---
name: Minimize
domain: Calculus
signature: Minimize(f, x)
summary: The global minimum of f over the real line (or a simple interval constraint), as {value, {x -> point}} -- an exact, provably global answer, not a local one.
signatures:
  - call: Minimize(f, x)
    description: the global minimum of f, a real expression in the single variable x, over f's own natural domain.
    library: "@enumeratio/analytic"
    type: (expression, list<symbol> | symbol) -> expression
  - call: Minimize(f, {x})
    description: same as Minimize(f, x) -- Wolfram accepts the variable either bare or wrapped in a one-element list.
    library: "@enumeratio/analytic"
  - call: Minimize({f, cons}, x)
    description: the global minimum of f restricted to cons, a simple interval constraint (x >= a, a <= x <= b, an And of two one-sided bounds, ...).
    library: "@enumeratio/analytic"
seeAlso:
  - Maximize
  - MinValue
  - MaxValue
  - NMinimize
  - Solve
  - Limit
names:
  wolframIdentity: true
attributes:
  - HoldAll
---

- An EXACT core, never a numerical search (see [[NMinimize]] for that): a polynomial (any degree), a rational function with no real pole splitting its domain in two, Sqrt/Ln of an affine-or-quadratic argument, and Exp of an affine argument, each on the whole real line or a simple interval. Every critical point comes from compute-engine's own [[D]] (the derivative) on the ORIGINAL expression, [[Factor]]ed and then solved piece by piece -- a linear or quadratic factor by our own exact formula, anything else via compute-engine's own [[Solve]] -- and every boundary/limit behaviour from compute-engine's own [[Limit]]. A factor is trusted only when its roots come back exact (no numeric fallback, from either route); one inexact factor declines the whole call rather than risk missing the real global minimum -- an irreducible cubic-or-higher factor `Solve` itself can't do exactly is the usual reason.
- Sin/Cos of an affine argument are supported only through [[MinValue]]/[[MaxValue]] (the exact amplitude, +-1) -- Minimize itself declines them even when a point exists, because Wolfram's own choice of WHICH of the infinitely many minimizers to report (verified against wolframscript) comes from an internal search this package has no way to reproduce or verify, and a wrong "the" point is worse than no point.
- A rational function's real pole sitting strictly inside the interval being optimized over (given or implied) declines, as does a Sqrt whose domain splits into two disjoint rays under the interval in force -- either would need comparing across more than one connected piece, which this file does not attempt.
- More than one variable declines outright; multivariate optimization isn't attempted.
- A constant f declines: every real x is an equally valid minimizer, and Wolfram's own choice of WHICH one to print (verified against wolframscript -- `Minimize[5, x]` names an arbitrary-looking rational) isn't reproducible or verifiable here.
- Matches Wolfram's output shape, `{value, {x -> point}}`, via [[Rule]] -- including for an unbounded minimum, `{-Infinity, {x -> point}}`, where point is whichever end (or domain edge) the limit is taken at.

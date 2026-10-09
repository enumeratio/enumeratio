---
name: InverseCDF
domain: Statistics
signature: InverseCDF(dist, q)
summary: "The quantile function: the $x$ such that $CDF(dist, x) = q$."
signatures:
  - call: InverseCDF(dist, q)
    description: numeric only — bisection against [[CDF]], bracketed from [[Mean]]/[[Variance]] and widened geometrically otherwise. No exact closed forms are attempted (a documented divergence from Wolfram, which answers several of these symbolically); a non-numeric $q$ stays unevaluated.
    library: enumeratio-statistics
    type: (distribution, real) -> real
seeAlso:
  - CDF
  - SurvivalFunction
  - Median
names:
  wolframIdentity: true
---

- Generic over every distribution this package's [[CDF]] can evaluate numerically, old or new — including compute-engine's own natives.
- `Median(dist)` is the exact quantile at $1/2$ where one exists: a closed form for the common continuous laws, and for a discrete law with rational parameters the least $k$ whose CDF reaches $1/2$, decided in exact arithmetic. Other laws stay unevaluated; `InverseCDF(dist, 1/2)` gives the numeric value.

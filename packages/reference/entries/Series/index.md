---
name: Series
domain: Compute engine
signature: "Series(expression, variable: symbol?, point: value?, order: number?) -> number"
summary: 'Taylor series expansion of an expression about a point (or an asymptotic expansion at ±∞), including Laurent, Puiseux (fractional-power), and log-aware expansions at poles and branch points. Only essential singularities, irrational exponents, and nested/reciprocal logarithms are left unevaluated. Example: Series(\sin x, x) → x - x^3/6 + x^5/120 + O(x^7)'
signatures:
  - call: "Series(expression, variable: symbol?, point: value?, order: number?) -> number"
    description: as compute-engine declares it
stub: engine
names:
  wolframIdentity: true
---

---
name: FromContinuedFraction
domain: Compute engine
signature: FromContinuedFraction(terms)
summary: The value of a continued fraction given its list of terms $[a_0, a_1, \ldots]$.
signatures:
  - call: FromContinuedFraction(terms)
    description: For a flat list of integers/symbols with at least one symbol, builds the nested unsimplified form $a + 1/(b + 1/c)$ term by term rather than compute-engine's combined single ratio.
    library: enumeratio-analytic
    type: (collection<any>) -> number
    overrides: compute-engine
  - call: FromContinuedFraction(terms)
    description: For a periodic tail `[a0, [period]]`, solves the repeating part's fixed point as an exact quadratic and returns $a_0 + 1/\text{tail}$, evaluated so compute-engine folds it into canonical $\sqrt{n}$ form.
    library: enumeratio-modular
    type: (collection<any>) -> number
    overrides: enumeratio-analytic
seeAlso:
  - ContinuedFraction
---

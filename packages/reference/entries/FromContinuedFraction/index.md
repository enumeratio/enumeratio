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
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: sympy
    template: continued_fraction_reduce($1)
    arity: 1
    checked:
      version: 1.14.0
      on: 2026-10-21
    note: A periodic tail `[a0, [period]]` is SymPy's own nested-list form. The empty list is 0 there, where ours stays unevaluated and Wolfram answers Infinity.
  - origin: mapped
    form: sage
    template: continued_fraction($1).value()
    arity: 1
    checked:
      version: "10.9"
      on: 2026-10-16
---

- Takes the list of terms $[a_0; a_1, \ldots]$, or $[a_0, [\text{period}]]$ for a periodic tail, as Wolfram's does; [[ContinuedFraction]] is its inverse.
- The empty list stays unevaluated, where Wolfram answers `Infinity`.

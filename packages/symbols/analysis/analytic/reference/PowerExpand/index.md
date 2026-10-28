---
name: PowerExpand
domain: Transformations
signature: PowerExpand(expr)
summary: Expand powers and logarithms of products in `expr` as though every variable were positive. Provided by `@enumeratio/analytic`.
signatures:
  - call: PowerExpand(expr)
    description: "`expr` with Ln and Power distributed over products, assuming positivity."
    library: "@enumeratio/analytic"
    type: (expression) -> expression
bindings:
  - origin: mapped
    form: sympy
    template: expand_log(powdenest(expand_power_base($1, force=True), force=True), force=True)
    arity: 1
    checked:
      version: 1.14.0
      on: 2026-10-28
seeAlso:
  - FunctionExpand
  - Ln
names:
  wolframIdentity: true
---

- A bottom-up rewrite: Ln(xy) → Ln(x) + Ln(y), Ln(x^n) → n·Ln(x), (ab)^c → a^c·b^c, and the same two rules specialized for Sqrt.
- Does not check or track positivity -- it assumes it unconditionally, same as Wolfram's default (`PowerExpand` ignores `Assumptions` unless told otherwise, which this does not model either).

---
name: FullSimplify
domain: Transformations
signature: FullSimplify(expr)
summary: Simplify `expr` harder than Simplify, trying a wider set of transformations including special-function identities. Provided by `@enumeratio/analytic`.
signatures:
  - call: FullSimplify(expr)
    description: compute-engine's own `simplify()`, plus a few extra targeted passes.
    library: "@enumeratio/analytic"
    type: (expression) -> expression
seeAlso:
  - FunctionExpand
  - ExpToTrig
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: sympy
    template: simplify($1)
    arity: 1
    threadArg: 1
    checked:
      version: 1.14.0
      on: 2026-10-14
    note: SymPy has no stronger simplifier than `simplify`, so FullSimplify maps to the same call as Simplify. The scan compares what each answers by value (the difference simplifies to zero, or agrees at sample points), not by form; an answer ours leaves as written is no agreement unless SymPy leaves it too. Assumptions (a second operand) are not mapped.
---

- Starts from compute-engine's native `simplify()`, which already folds the Pythagorean identity and a double-angle product on its own.
- Adds exactly four passes: the Gamma functional equation Γ(a)/Γ(b) for a concrete integer a−b; the hyperbolic Pythagorean identity cosh²(u) − sinh²(u) = 1; denesting Sqrt(a + 2·Sqrt(b)) for concrete rational a, b with a rational discriminant; and ExpToTrig everywhere in the tree (which is how a (e^x − e^(−x))/2 shows up as Sinh(x), with no separate 'looks like a hyperbolic definition' rule needed).
- NOT a general simplifier: no broader special-function identity table beyond the one Gamma shift above, no general nested-radical denesting past the one quadratic form, and no trigonometric identities beyond what `simplify()` already has. An expression needing more than this list is left exactly as `simplify()` leaves it.

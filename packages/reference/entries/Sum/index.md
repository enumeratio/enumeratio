---
name: Sum
domain: Compute engine
signature: Sum(any, tuple*) -> number
summary: "`Sum(f, [a, b])` computes the sum of `f` from `a` to `b`; `Sum(L)` sums the elements of a collection `L`"
signatures:
  - call: Sum(any, tuple*) -> number
    description: as compute-engine declares it
  - call: Sum(any, tuple*) -> number
    description: "`Sum(f, [a, b])` computes the sum of `f` from `a` to `b`; `Sum(L)` sums the elements of a collection `L`"
    library: enumeratio-analytic
    type: (any, tuple*) -> number
    overrides: enumeratio-evaluation
  - call: Sum(any, tuple*) -> number
    description: "`Sum(f, [a, b])` computes the sum of `f` from `a` to `b`; `Sum(L)` sums the elements of a collection `L`"
    library: enumeratio-evaluation
    type: (any, tuple*) -> number
    overrides: compute-engine
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: sympy
    template: summation($1, $2)
    arity: 2
    checked:
      version: 1.14.0
      on: 2026-10-12
    note: "The iterator (Limits or Tuple, k from a to b, or from 1 when a is Nothing) is emitted as SymPy's (k, a, b). SymPy sums reversed bounds by Karr's convention: b < a - 1 gives a negative sum."
stub: engine
statOn:
  - Finset
  - PermutationInversion
  - SubexcedantSeq
attributes:
  - HoldAll
---

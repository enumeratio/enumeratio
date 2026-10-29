---
name: Max
domain: Arithmetic
signature: Max(a, b, …)
summary: The largest of its arguments.
signatures:
  - call: Max(a, b, …)
    description: the largest of two or more values.
  - call: Max(list)
    description: the largest value in a list.
  - call: Max(a, b, …)
    description: The largest of its arguments.
    library: enumeratio-analytic
    type: (value*) -> number
    overrides: compute-engine
  - call: Max(a, b, …)
    description: for values of any ordered type, not just numbers -- the join, in a lattice that is not a total order.
    library: enumeratio-structures
    type: (any*) -> any
    overrides: enumeratio-analytic
  - call: Max(finset)
    description: the largest member of a [[Finset]].
    library: enumeratio-combinatorics
    type: (any*) -> any
    overrides: enumeratio-structures
    on:
      - Finset
seeAlso:
  - Min
  - Clamp
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: mathlib4
    template: "(([$*,] : List ℚ).max?.get (by decide +kernel))"
    note: The largest of the arguments as exact rationals. Several arguments are the pool; a lone argument is a list of numbers. The empty pool (ours is NaN) and a nested list (ours flattens it) fail to elaborate rather than defaulting.
  - origin: mapped
    form: mathlib4
    template: "(($1 : List ℚ).max?.get (by decide +kernel))"
    arity: 1
    note: A single list of numbers; a lone number fails to elaborate.
  - origin: mapped
    form: wolfram
    template: Max[$*,]
    note: Wolfram (and our Max) flattens nested lists into one pool; bare SymPy Max()/Sage max() on a list (or a list of lists) either raise or compare lexicographically instead, so both go through a flattening helper (run.ts's SYMPY_PREAMBLE / SAGE_PREAMBLE).
  - origin: mapped
    form: sympy
    template: enumeratio_max($*,)
    note: Wolfram (and our Max) flattens nested lists into one pool; bare SymPy Max()/Sage max() on a list (or a list of lists) either raise or compare lexicographically instead, so both go through a flattening helper (run.ts's SYMPY_PREAMBLE / SAGE_PREAMBLE).
  - origin: mapped
    form: sage
    template: enumeratio_max($*,)
    note: Wolfram (and our Max) flattens nested lists into one pool; bare SymPy Max()/Sage max() on a list (or a list of lists) either raise or compare lexicographically instead, so both go through a flattening helper (run.ts's SYMPY_PREAMBLE / SAGE_PREAMBLE).
  - origin: mapped
    form: julia
    template: enumeratio_max($*,)
    checked:
      version: Nemo 0.56.1
      on: 2026-10-16
  - origin: mapped
    form: rust
    template: maximum($1, $2)
    arity: 2
    note: Two operands.
    checked:
      version: num-rational 0.4.2
      on: 2026-10-16
---

- The largest of its arguments, or of a single list argument.
- Multiple arguments -- lists included -- are flattened into one pool rather than compared pairwise or threaded element-wise. See [[Min]].
- Commutative and associative: order and grouping don't matter.
- NaN poisons the result: it beats every other comparison, even $+\infty$.
- With no arguments, compute-engine returns NaN rather than $-\infty$, the true identity element.
- Takes a [[Finset]] too: its largest member, and NaN for the empty one, as for an empty list.

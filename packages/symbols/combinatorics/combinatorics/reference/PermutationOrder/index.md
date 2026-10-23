---
name: PermutationOrder
domain: Permutation statistics
signature: PermutationOrder(p)
summary: The order of p in the symmetric group — the lcm of its cycle lengths.
formerly:
  - Order
statOn:
  - Permutation
signatures:
  - call: PermutationOrder(p)
    description: The order of p in the symmetric group — the lcm of its cycle lengths.
    library: enumeratio-combinatorics
    type: (permutation) -> number
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: sage
    template: enumeratio_stat("Permutation", $1, "PermutationOrder")
    arity: 1
    checked:
      version: "10.9"
      on: 2026-10-16
catalog:
  - system: findstat
    identity: St000058
    url: https://www.findstat.org/St000058
    on: Permutation
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- Wolfram's PermutationOrder. The bare `Order` is Wolfram's canonical-ordering comparison `Order[a, b]`, so this head replaces it. The old name is recorded in `formerly` but does not resolve: `Order(p)` is now Wolfram's `Order`.

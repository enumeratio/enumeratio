---
name: Inverse
domain: Combinatorial maps
signature: Inverse(Permutation)
summary: "The inverse permutation: position of each value."
references:
  - system: wikipedia
    identity: Permutation#Composition of permutations
catalog:
  - system: findstat
    identity: Mp00066
    url: https://www.findstat.org/Mp00066
    on: Permutation
mapOn:
  - Permutation
  - SignedPermutation
signatures:
  - call: Inverse(Permutation)
    description: "The inverse permutation: position of each value."
    library: enumeratio-modular
    type: (expression<ModularMatrix> | matrix | string) -> expression<ModularMatrix> | matrix
    overrides: compute-engine
  - call: Inverse(Permutation)
    description: "The inverse permutation: position of each value."
    library: enumeratio-combinatorics
    type: (permutation) -> permutation
    overrides: enumeratio-modular
    types:
      - permutation
laws:
  - involution
  - graded:
      from: Permutations
      to: Permutations
    on: permutation
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: sage
    template: "[list(r) for r in matrix($1).inverse().rows()]"
    arity: 1
    checked:
      version: "10.9"
      on: 2026-10-16
---

- Takes a `Permutation` and returns a `Permutation` — a typed map, so a wrong carrier is a type error rather than a wrong answer.

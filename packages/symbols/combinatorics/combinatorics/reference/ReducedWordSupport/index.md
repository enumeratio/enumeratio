---
name: ReducedWordSupport
domain: Permutation statistics
signature: ReducedWordSupport(p)
summary: "The simple reflections in a reduced word: the i < n with some entry of p(1), ..., p(i) larger than i."
catalog:
  - system: findstat
    identity: St000019
    url: https://www.findstat.org/St000019
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: ReducedWordSupport(p)
    description: "The simple reflections in a reduced word: the i < n with some entry of p(1), ..., p(i) larger than i."
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- The size of the support in the Coxeter sense: the i for which p does not preserve {1, ..., i}. PermutationSupport counts the moved points instead.

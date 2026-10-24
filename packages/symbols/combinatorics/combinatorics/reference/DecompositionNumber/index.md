---
name: DecompositionNumber
domain: Permutation statistics
signature: DecompositionNumber(p)
summary: "The k with {p(1), ..., p(k)} = {1, ..., k}: the blocks of p as a direct sum."
signatures:
  - call: DecompositionNumber(p)
    description: "The k with {p(1), ..., p(k)} = {1, ..., k}: the blocks of p as a direct sum."
    library: enumeratio-combinatorics
    type: (permutation) -> number
catalog:
  - system: findstat
    identity: St000056
    url: https://www.findstat.org/St000056
    on: Permutation
statOn:
  - Permutation
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- One more than GlobalAscents; also called the block number.

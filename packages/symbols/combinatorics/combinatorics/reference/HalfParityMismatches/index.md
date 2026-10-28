---
name: HalfParityMismatches
domain: Permutation statistics
signature: HalfParityMismatches(p)
summary: Half the positions i where i and p(i) differ in parity.
catalog:
  - system: findstat
    identity: St001801
    url: https://www.findstat.org/St001801
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: HalfParityMismatches(p)
    description: Half the positions i where i and p(i) differ in parity.
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.

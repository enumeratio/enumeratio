---
name: OccurrencesOf321Or3412
domain: Permutation statistics
signature: OccurrencesOf321Or3412(p)
summary: Triples ordered as 321, plus quadruples ordered as 3412.
catalog:
  - system: findstat
    identity: St001411
    url: https://www.findstat.org/St001411
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: OccurrencesOf321Or3412(p)
    description: Triples ordered as 321, plus quadruples ordered as 3412.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
- A permutation avoids both exactly when it is boolean: its Bruhat interval below is a boolean lattice.

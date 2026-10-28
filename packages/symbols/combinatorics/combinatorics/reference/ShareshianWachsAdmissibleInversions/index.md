---
name: ShareshianWachsAdmissibleInversions
domain: Permutation statistics
signature: ShareshianWachsAdmissibleInversions(p)
summary: Pairs i < j with p(i) > p(j) and either p(j) < p(j+1) or some entry between them smaller than p(j).
catalog:
  - system: findstat
    identity: St000866
    url: https://www.findstat.org/St000866
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: ShareshianWachsAdmissibleInversions(p)
    description: Pairs i < j with p(i) > p(j) and either p(j) < p(j+1) or some entry between them smaller than p(j).
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.

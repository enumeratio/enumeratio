---
name: AdmissibleInversions
domain: Permutation statistics
signature: AdmissibleInversions(p)
summary: Pairs i < j with p(i) > p(j) and either p(i-1) < p(i) or some entry between them larger than p(i).
catalog:
  - system: findstat
    identity: St000463
    url: https://www.findstat.org/St000463
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: AdmissibleInversions(p)
    description: Pairs i < j with p(i) > p(j) and either p(i-1) < p(i) or some entry between them larger than p(i).
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
- FindStat's St000866 is the Shareshian-Wachs version, which differs.

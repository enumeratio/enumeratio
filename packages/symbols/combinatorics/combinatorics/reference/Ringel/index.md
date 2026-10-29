---
name: Ringel
domain: Combinatorial maps
signature: Ringel(DyckPath)
summary: The Ringel permutation of the Nakayama algebra whose Kupisch series the path gives, one size up.
catalog:
  - system: findstat
    identity: Mp00201
    url: https://www.findstat.org/Mp00201
    on: DyckPath
mapOn:
  - DyckPath
signatures:
  - call: Ringel(DyckPath)
    description: The Ringel permutation of the Nakayama algebra whose Kupisch series the path gives, one size up.
    library: enumeratio-combinatorics
    type: (dyck_path) -> permutation
---

- Takes a `DyckPath` and returns a `Permutation` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00201, after Ringel's The finitistic dimension of a Nakayama algebra. Injective, into the permutations of n + 1.

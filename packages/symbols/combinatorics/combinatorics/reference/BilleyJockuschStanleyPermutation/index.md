---
name: BilleyJockuschStanleyPermutation
domain: Combinatorial maps
signature: BilleyJockuschStanleyPermutation(DyckPath)
summary: "The 321-avoiding permutation with entry (ups through a valley) + 1 at the position of its downs through that valley: the Billey-Jockusch-Stanley bijection."
laws:
  - graded:
      from: DyckPaths
      to: Permutations
    on: dyck_path
catalog:
  - system: findstat
    identity: Mp00129
    url: https://www.findstat.org/Mp00129
    on: DyckPath
mapOn:
  - DyckPath
signatures:
  - call: BilleyJockuschStanleyPermutation(DyckPath)
    description: "The 321-avoiding permutation with entry (ups through a valley) + 1 at the position of its downs through that valley: the Billey-Jockusch-Stanley bijection."
    library: enumeratio-combinatorics
    type: (dyck_path) -> permutation
---

- Takes a `DyckPath` and returns a `Permutation` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00129. The other entries fill the remaining positions increasingly. Injective: it reaches the 321-avoiding permutations.

---
name: Avoiding321Permutation
domain: Combinatorial maps
signature: Avoiding321Permutation(DyckPath)
summary: The 321-avoiding permutation whose RSK pair is the pair of two-row tableaux read off the first and last halves of the path.
laws:
  - graded:
      from: DyckPaths
      to: Permutations
    on: dyck_path
catalog:
  - system: findstat
    identity: Mp00024
    url: https://www.findstat.org/Mp00024
    on: DyckPath
mapOn:
  - DyckPath
signatures:
  - call: Avoiding321Permutation(DyckPath)
    description: The 321-avoiding permutation whose RSK pair is the pair of two-row tableaux read off the first and last halves of the path.
    library: enumeratio-combinatorics
    type: (dyck_path) -> permutation
---

- Takes a `DyckPath` and returns a `Permutation` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00024. It sends centered tunnels to fixed points and the semilength plus the height of the middle point to twice the longest increasing subsequence. Injective.

---
name: KrattenthalerPermutation
domain: Combinatorial maps
signature: KrattenthalerPermutation(DyckPath)
summary: "The 321-avoiding permutation whose left-to-right maxima are the path's peaks: Krattenthaler's bijection."
laws:
  - graded:
      from: DyckPaths
      to: Permutations
    on: dyck_path
catalog:
  - system: findstat
    identity: Mp00119
    url: https://www.findstat.org/Mp00119
    on: DyckPath
mapOn:
  - DyckPath
signatures:
  - call: KrattenthalerPermutation(DyckPath)
    description: "The 321-avoiding permutation whose left-to-right maxima are the path's peaks: Krattenthaler's bijection."
    library: enumeratio-combinatorics
    type: (dyck_path) -> permutation
---

- Takes a `DyckPath` and returns a `Permutation` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00119. The value at a peak is the ups so far and its position the downs so far plus one; the other values fill the other positions increasingly. The first step of KnuthKrattenthaler.

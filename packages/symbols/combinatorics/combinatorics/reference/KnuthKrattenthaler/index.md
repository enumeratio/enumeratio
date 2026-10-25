---
name: KnuthKrattenthaler
domain: Combinatorial maps
signature: KnuthKrattenthaler(DyckPath)
summary: The 321-avoiding permutation whose left-to-right maxima are the path's peaks, its RSK pair, and the first row of P with the second row of Q as ups.
laws:
  - bijection
  - graded:
      from: DyckPaths
      to: DyckPaths
    on: dyck_path
catalog:
  - system: findstat
    identity: Mp00296
    url: https://www.findstat.org/Mp00296
    on: DyckPath
mapOn:
  - DyckPath
signatures:
  - call: KnuthKrattenthaler(DyckPath)
    description: The 321-avoiding permutation whose left-to-right maxima are the path's peaks, its RSK pair, and the first row of P with the second row of Q as ups.
    library: enumeratio-combinatorics
    type: (dyck_path) -> dyck_path
---

- Takes a `DyckPath` and returns a `DyckPath` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00296: Dyck path, to 321-avoiding permutation (Krattenthaler's bijection), to RSK pair, to Dyck path (Knuth).

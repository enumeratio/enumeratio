---
name: MajorIndex
domain: Permutation statistics
signature: MajorIndex(p)
summary: 'The major index of $p$: the sum of the descent positions $\sum_{p_i > p_{i+1}} i$.'
bindings:
  - origin: reference
    form: notatio
    environment: engine
    expr:
      [
        If,
        [Less, [Length, _p], 2],
        0,
        [
          Sum,
          [
            Filter,
            [Range, 1, [Subtract, [Length, _p], 1]],
            [Function, [Greater, [At, _p, i], [At, _p, [Add, i, 1]]], i],
          ],
        ],
      ]
    note: Checked against the implementation over every permutation of 1..6.
  - origin: native
    form: typescript
    environment: engine
    source: packages/symbols/combinatorics/combinatorics/collections/src/stats.ts:majorIndex
signatures:
  - call: MajorIndex(p)
    description: the major index of a one-line permutation $p$
    library: enumeratio-combinatorics
    type: (dyck_path | list | permutation) -> integer | number
seeAlso:
  - Inversions
  - Descents
  - SymmetricGroup
catalog:
  - system: findstat
    identity: St000004
    url: https://www.findstat.org/St000004
    on: Permutation
  - system: findstat
    identity: St000330
    url: https://www.findstat.org/St000330
    on: StandardTableau
statOn:
  - DyckPath
  - Permutation
  - StandardTableau
---

- Introduced by MacMahon, who proved it equidistributed with [[Inversions]] over $S_n$
- Both are Mahonian, so their common generating function is the q-factorial $[n]_q!$
- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
- The distinction from Descents is the entire content of the statistic.
- A separate definition exists for `DyckPath` (The sum of the descent positions of the step word — where an up step is followed by a down step.) but is not the one declared: one head, one owner.

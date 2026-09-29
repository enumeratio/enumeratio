---
name: CombinatorialStat
domain: Structures
signature: CombinatorialStat(x, name)
summary: A combinatorial statistic of a value, by name or FindStat id, found through the value's carrier.
signatures:
  - call: CombinatorialStat(x, name)
    description: the statistic `name` (or FindStat id, `"St000018"`) of `x`, a value of a carrier such as `Permutation`; over a collection, the statistic of each element, lazily, and `"Count"` the collection's size.
    library: enumeratio-structures
    type: (any, any) -> any
attributes:
  - HoldAll
seeAlso:
  - CombinatorialMap
  - Count
---

- A carrier's statistics are too many, and too generically named, for a head each: they live in the carrier's table, and this is the way in. Packages add to a table, a fast kernel from one and the defining expression from another; the same part twice is an error.
- The carrier is found from the value's type, as a protocol member finds its implementation, so a type a user declares can have statistics too.
- Over a collection it is the statistic's distribution: `Tally(CombinatorialStat(SymmetricGroup(4), "Inversions"))` is the Mahonian numbers.
- Where FindStat has the statistic, its id is another name for it. Several of our names can be one FindStat statistic.

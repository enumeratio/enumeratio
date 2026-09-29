---
name: CombinatorialMap
domain: Structures
signature: CombinatorialMap(x, name)
summary: A combinatorial map applied to a value, by name or FindStat id, found through the value's carrier.
signatures:
  - call: CombinatorialMap(x, name)
    description: the map `name` (or FindStat id, `"Mp00066"`) applied to `x`, a value of a carrier such as `Permutation`, giving a value of the map's target carrier; over a collection, the map applied to each element, lazily.
    library: enumeratio-structures
    type: (any, any) -> any
attributes:
  - HoldAll
seeAlso:
  - CombinatorialStat
---

- A map between carriers (FindStat's "map"): it need preserve nothing, so it is not a morphism. Found through its source carrier's table, as a statistic is.

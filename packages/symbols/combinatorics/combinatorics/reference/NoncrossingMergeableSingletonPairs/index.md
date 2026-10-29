---
name: NoncrossingMergeableSingletonPairs
domain: Dyck path statistics
signature: NoncrossingMergeableSingletonPairs(path)
summary: Pairs of singleton blocks of the path's noncrossing partition that can be merged into one block, leaving the partition noncrossing.
catalog:
  - system: findstat
    identity: St001932
    url: https://www.findstat.org/St001932
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: NoncrossingMergeableSingletonPairs(path)
    description: Pairs of singleton blocks of the path's noncrossing partition that can be merged into one block, leaving the partition noncrossing.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- FindStat's St001932, under Biane's bijection (`NoncrossingPartition`): the ups whose matching downs share a run form a block.

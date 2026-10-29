---
name: AdjointInvariantDescents
domain: Dyck path statistics
signature: AdjointInvariantDescents(path)
summary: The descents of the invariant in a tensor power of the adjoint representation of GL2 that the path indexes, read over its step pairs.
catalog:
  - system: findstat
    identity: St001104
    url: https://www.findstat.org/St001104
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: AdjointInvariantDescents(path)
    description: The descents of the invariant in a tensor power of the adjoint representation of GL2 that the path indexes, read over its step pairs.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- FindStat's St001104. The step pairs are up-up, up-down, down-up or down-down; a descent is a pair after which the next pair breaks the pattern, an up-up pair judged against the level reached.

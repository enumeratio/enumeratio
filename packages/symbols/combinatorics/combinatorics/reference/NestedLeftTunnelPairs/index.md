---
name: NestedLeftTunnelPairs
domain: Dyck path statistics
signature: NestedLeftTunnelPairs(path)
summary: Pairs of left tunnels, one strictly inside the other.
catalog:
  - system: findstat
    identity: St000791
    url: https://www.findstat.org/St000791
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: NestedLeftTunnelPairs(path)
    description: Pairs of left tunnels, one strictly inside the other.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.

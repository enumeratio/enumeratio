---
name: ValleyTunnelSemilengthSum
domain: Dyck path statistics
signature: ValleyTunnelSemilengthSum(path)
summary: The sum of the semilengths of the tunnels that end at a valley.
catalog:
  - system: findstat
    identity: St000476
    url: https://www.findstat.org/St000476
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: ValleyTunnelSemilengthSum(path)
    description: The sum of the semilengths of the tunnels that end at a valley.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.

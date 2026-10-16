---
name: LeftTunnels
domain: Dyck path statistics
signature: LeftTunnels(path)
summary: "Tunnels (an up step with its matching down step) left of the middle: positions summing to less than the length plus one."
catalog:
  - system: findstat
    identity: St000120
    url: https://www.findstat.org/St000120
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: LeftTunnels(path)
    description: "Tunnels (an up step with its matching down step) left of the middle: positions summing to less than the length plus one."
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.

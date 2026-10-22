---
name: LongTunnels
domain: Dyck path statistics
signature: LongTunnels(path)
summary: "The longest sequences of consecutive tunnels: the semilength less the valleys."
catalog:
  - system: findstat
    identity: St000443
    url: https://www.findstat.org/St000443
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: LongTunnels(path)
    description: "The longest sequences of consecutive tunnels: the semilength less the valleys."
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- Tunnels meet end to start exactly at valleys, and each valley joins one pair, so merging them leaves one long tunnel per tunnel not joined.

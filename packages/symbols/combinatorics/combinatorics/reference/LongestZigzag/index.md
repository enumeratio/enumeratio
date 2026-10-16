---
name: LongestZigzag
domain: Dyck path statistics
signature: LongestZigzag(path)
summary: The length of the longest stretch of steps that alternate between up and down.
catalog:
  - system: findstat
    identity: St000981
    url: https://www.findstat.org/St000981
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: LongestZigzag(path)
    description: The length of the longest stretch of steps that alternate between up and down.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- Starts the count again at 1 on a repeated step; the accumulator is (best, current, previous step), with 2 for no previous step.

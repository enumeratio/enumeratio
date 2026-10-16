---
name: Area
domain: Dyck path statistics
signature: Area(path)
summary: "The whole squares between the path and the diagonal below it: the sum of the area sequence."
catalog:
  - system: findstat
    identity: St000012
    url: https://www.findstat.org/St000012
    on: DyckPath
statOn:
  - DelannoyPath
  - DyckPath
  - MotzkinPath
  - PythagoreanTriple
signatures:
  - call: Area(path)
    description: "The whole squares between the path and the diagonal below it: the sum of the area sequence."
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- Haglund's area (FindStat St000012). Half of: the total of the heights after each step, less the semilength.

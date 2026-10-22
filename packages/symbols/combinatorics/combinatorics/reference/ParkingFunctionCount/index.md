---
name: ParkingFunctionCount
domain: Dyck path statistics
signature: ParkingFunctionCount(path)
summary: "The parking functions supported by the path: semilength factorial over the product of the factorials of the rise lengths."
catalog:
  - system: findstat
    identity: St000014
    url: https://www.findstat.org/St000014
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: ParkingFunctionCount(path)
    description: "The parking functions supported by the path: semilength factorial over the product of the factorials of the rise lengths."
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- A parking function is a path with the cars of each column labeled; the labels must increase up each rise, which leaves n!/(r_1! r_2! ...) of them.

---
name: InverseDescentParkingFunctionCount
domain: Composition statistics
signature: InverseDescentParkingFunctionCount(composition)
summary: Parking functions of size n whose diagonal reading word has the inverse descent composition c.
catalog:
  - system: findstat
    identity: St000285
    url: https://www.findstat.org/St000285
    on: Composition
statOn:
  - Composition
signatures:
  - call: InverseDescentParkingFunctionCount(composition)
    description: Parking functions of size n whose diagonal reading word has the inverse descent composition c.
    library: enumeratio-combinatorics
    type: (composition) -> number
---

- Defined over `Composition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Composition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- FindStat's St000285 is the size of that preimage; the count here is the equivalent word count, 1/(n+1) of the words on 1 .. n+1 that fall within each block and rise between blocks.

---
name: SupportDyckPath
domain: Combinatorial maps
signature: SupportDyckPath(ParkingFunction)
summary: "The Dyck path whose area sequence is j minus the j-th smallest entry: the parking function's support."
laws:
  - graded:
      from: ParkingFunctions
      to: DyckPaths
    on: parking_function
catalog:
  - system: findstat
    identity: Mp00056
    url: https://www.findstat.org/Mp00056
    on: ParkingFunction
mapOn:
  - ParkingFunction
signatures:
  - call: SupportDyckPath(ParkingFunction)
    description: "The Dyck path whose area sequence is j minus the j-th smallest entry: the parking function's support."
    library: enumeratio-combinatorics
    type: (parking_function) -> dyck_path
---

- Takes a `ParkingFunction` and returns a `DyckPath` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00056, Sage's to_area_sequence. A surjection: the preimage of a path is its parking functions, the labelings of its up steps.

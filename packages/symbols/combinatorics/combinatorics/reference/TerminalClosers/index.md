---
name: TerminalClosers
domain: Set partition statistics
signature: TerminalClosers(partition)
summary: Closers e with every larger element also a closer.
catalog:
  - system: findstat
    identity: St001050
    url: https://www.findstat.org/St001050
    on: SetPartition
statOn:
  - SetPartition
signatures:
  - call: TerminalClosers(partition)
    description: Closers e with every larger element also a closer.
    library: enumeratio-combinatorics
    type: (set_partition) -> number
---

- Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `SetPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.

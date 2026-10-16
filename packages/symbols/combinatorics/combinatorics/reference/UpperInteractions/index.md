---
name: UpperInteractions
domain: Dyck path statistics
signature: UpperInteractions(path)
summary: "Over each valley, the shorter of the down run before it and the up run after it, summed: the factors of k down steps then k up steps."
catalog:
  - system: findstat
    identity: St000331
    url: https://www.findstat.org/St000331
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: UpperInteractions(path)
    description: "Over each valley, the shorter of the down run before it and the up run after it, summed: the factors of k down steps then k up steps."
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- Over a valley, the shorter of the down run before it and the up run after it.

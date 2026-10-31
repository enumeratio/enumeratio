---
name: Peaks
domain: Permutation statistics
signature: Peaks(p)
summary: "The number of peaks of $p$: interior positions $i$ with $p_{i-1} < p_i > p_{i+1}$."
signatures:
  - call: Peaks(p)
    description: the peak count of a one-line permutation $p$
    library: enumeratio-combinatorics
    type: (composition | dyck_path | list | motzkin_path | permutation | schroeder_path) -> integer | number
seeAlso:
  - Valleys
  - Descents
  - SymmetricGroup
catalog:
  - system: findstat
    identity: St000023
    url: https://www.findstat.org/St000023
    on: Permutation
  - system: findstat
    identity: St000768
    url: https://www.findstat.org/St000768
    on: Composition
  - system: findstat
    identity: St000015
    url: https://www.findstat.org/St000015
    on: DyckPath
  - system: findstat
    identity: St001068
    url: https://www.findstat.org/St001068
    on: DyckPath
statOn:
  - ColoredMotzkinPath
  - Composition
  - DyckPath
  - KDyckPath
  - KMotzkinPath
  - MotzkinPath
  - Permutation
  - SchroederPath
bindings:
  - origin: mapped
    form: sage
    template: enumeratio_stat("Permutation", $1, "Peaks")
    arity: 1
    checked:
      version: "10.9"
      on: 2026-10-16
---

- Only interior positions count ($1 < i < n$), so $\mathrm{Peaks}(p) = 0$ whenever $n \leq 2$
- Peaks and [[Valleys]] alternate along the sequence, so they differ by at most $1$
- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
- A separate definition exists for `DyckPath` (Occurrences of an up step immediately followed by a down step.) but is not the one declared: one head, one owner.
- A separate definition exists for `MotzkinPath` (Occurrences of an up step immediately followed by a down step.) but is not the one declared: one head, one owner.
- A separate definition exists for `SchroederPath` (Occurrences of an up step immediately followed by a down step.) but is not the one declared: one head, one owner.

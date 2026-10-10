---
name: Peaks
domain: Permutation statistics
signature: Peaks(p)
summary: "The number of peaks of $p$: interior positions $i$ with $p_{i-1} < p_i > p_{i+1}$."
signatures:
  - call: Peaks(p)
    description: the peak count of a one-line permutation $p$
    library: enumeratio-combinatorics
    type: (dyck_path | list | permutation) -> integer | number
seeAlso:
  - Valleys
  - Descents
  - SymmetricGroup
catalog:
  - system: findstat
    identity: St000023
    url: https://www.findstat.org/St000023
    on: Permutation
statOn:
  - ColoredMotzkinPath
  - DelannoyPath
  - DyckPath
  - KDyckPath
  - KMotzkinPath
  - MotzkinPath
  - Permutation
  - SchroederPath
---

- Only interior positions count ($1 < i < n$), so $\mathrm{Peaks}(p) = 0$ whenever $n \leq 2$
- Peaks and [[Valleys]] alternate along the sequence, so they differ by at most $1$
- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
- A separate definition exists for `DyckPath` (Occurrences of an up step immediately followed by a down step.) but is not the one declared: one head, one owner.

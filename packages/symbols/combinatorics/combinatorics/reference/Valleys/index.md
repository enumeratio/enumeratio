---
name: Valleys
domain: Permutation statistics
signature: Valleys(p)
summary: "The number of valleys of $p$: interior positions $i$ with $p_{i-1} > p_i < p_{i+1}$."
signatures:
  - call: Valleys(p)
    description: the valley count of a one-line permutation $p$
    library: enumeratio-combinatorics
    type: (dyck_path | list | permutation) -> integer | number
seeAlso:
  - Peaks
  - Ascents
  - SymmetricGroup
catalog:
  - system: findstat
    identity: St000053
    url: https://www.findstat.org/St000053
    on: DyckPath
  - system: findstat
    identity: St000353
    url: https://www.findstat.org/St000353
    on: Permutation
statOn:
  - DyckPath
  - Permutation
---

- Only interior positions count ($1 < i < n$), so $\mathrm{Valleys}(p) = 0$ whenever $n \leq 2$
- The local minima, complementary in shape to the local maxima counted by [[Peaks]]
- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
- A separate definition exists for `DyckPath` (Occurrences of a down step immediately followed by an up step.) but is not the one declared: one head, one owner.

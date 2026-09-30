---
name: Table
domain: Collections
signature: Table(expr, {i, lo, hi, step?})
summary: An alias for `Tabulate` (the preferred name) that additionally accepts Mathematica-style iterator specs, e.g. `Table(i^2, {i, 1, n})`, and the equivalent tuple spelling `Table(i^2, (i, 1, n))`.
signatures:
  - call: Table(expr, {i, lo, hi})
    description: $[expr]_{i=lo}^{hi}$, $expr$ evaluated at each value of $i$ from $lo$ to $hi$.
    type: (function, integer, integer?) -> collection
  - call: Table(expr, {i, lo, hi, step})
    description: as above, stepping by $step$ instead of 1.
  - call: Table(f, n)
    description: the same as `Tabulate(f, n)` — $f$ applied to each index from 1 to $n$.
seeAlso:
  - Tabulate
  - Map
names:
  wolframIdentity: true
---

- `{i, lo, hi}` is `[Set, i, lo, hi]` in MathJSON, read here as an iterator spec rather than a set.
- Holds its body: $expr$ is evaluated fresh at each value of $i$, not evaluated once and reused.

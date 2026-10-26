---
name: TotalSquaredDisplacement
domain: Permutation statistics
signature: TotalSquaredDisplacement(p)
summary: The sum of (p(i) - i)^2.
catalog:
  - system: findstat
    identity: St000828
    url: https://www.findstat.org/St000828
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: TotalSquaredDisplacement(p)
    description: The sum of (p(i) - i)^2.
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- Twice InversionSum, though neither definition shows it. FindStat calls it Spearman's rho of p against the identity.

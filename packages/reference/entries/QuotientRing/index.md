---
name: QuotientRing
domain: Compute engine
signature: QuotientRing(Integers, m)
summary: Compute-engine's own `QuotientRing`, widened so $\mathbb{Z}/m\mathbb{Z}$ — what `QuotientRing(Integers, m)` parses to — specialises to [[IntegerModRing]].
signatures:
  - call: QuotientRing(Integers, m)
    description: the same ring as IntegerModRing(m)
    library: enumeratio-residues
    type: (set<any>, any) -> set
    overrides: compute-engine
seeAlso:
  - IntegerModRing
  - IntegerMod
---

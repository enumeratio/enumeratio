---
name: QuotientRing
domain: Modular arithmetic
signature: QuotientRing(Integers, m)
summary: "The ring $\\mathbb{Z}/m\\mathbb{Z}$: compute-engine's `QuotientRing`, made the finite collection of its $m$ [[IntegerMod]] classes."
signatures:
  - call: QuotientRing(Integers, m)
    description: $\mathbb{Z}/m\mathbb{Z}$ — Sage's `Zmod(m)`
    type: (set<any>, any) -> set
seeAlso:
  - IntegerMod
  - IntegerModRing
---

- A collection: it counts, enumerates and answers membership, so `Count`, `ListFrom` and `Element` work on it directly
- Membership is by modulus — `IntegerMod(3, 7)` is not in $\mathbb{Z}/5\mathbb{Z}$
- Its elements are residue classes, so it is typed `set<value>`, not compute-engine's `set<integer>`
- Another base ring, or a symbolic $m$, stays inert, as compute-engine has it
- Written $\mathbb{Z}/m\mathbb{Z}$, which reads back as itself; [[IntegerModRing]](m) is its old spelling

---
name: TorusBraid
domain: Braids and knots
signature: TorusBraid(p, q)
summary: $(\sigma_1\cdots\sigma_{p-1})^q$ in $B_p$, whose closure is the torus link $T(p,q)$.
signatures:
  - call: TorusBraid(p, q)
    description: $(\sigma_1\cdots\sigma_{p-1})^q$, whose closure is $T(p,q)$
    library: enumeratio-braid
    type: (integer, integer) -> expression<Braid>
seeAlso:
  - TorusKnot
  - Braid
---

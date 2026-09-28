---
name: QSymAlgebra
domain: Hopf algebras
signature: QSymAlgebra(n)
summary: The degree-$n$ graded piece of QSym — one basis element per composition of $n$, $2^{n-1}$ of them for $n \geq 1$.
signatures:
  - call: QSymAlgebra(n)
    description: the degree-$n$ piece of QSym
    library: enumeratio-hopf
    type: (integer) -> graded_hopf_algebra
seeAlso:
  - QSymM
  - NSymAlgebra
---

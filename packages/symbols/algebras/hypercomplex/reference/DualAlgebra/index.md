---
name: DualAlgebra
domain: Hypercomplex algebra
signature: DualAlgebra(n)
summary: The multi-dual algebra $\mathbb{R}[\varepsilon_1,\ldots,\varepsilon_n]/(\varepsilon_k^2)$ on $n$ commuting nilpotent generators, each squaring to $0$.
signatures:
  - call: DualAlgebra(n)
    description: the dual algebra on $n$ commuting nilpotent generators
    library: enumeratio-hypercomplex
    type: (integer) -> clifford_algebra
seeAlso:
  - Basis
  - MulticomplexAlgebra
  - SplitAlgebra
references:
  - system: wikipedia
    identity: Dual number
---

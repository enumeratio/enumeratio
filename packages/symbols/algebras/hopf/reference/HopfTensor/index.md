---
name: HopfTensor
domain: Hopf algebras
signature: HopfTensor(left, right)
summary: One tensor pair of a `Coproduct` expansion, $\text{left} \otimes \text{right}$ — its own head because `CircleTimes` already names the shared ordered product.
signatures:
  - call: HopfTensor(left, right)
    description: $\text{left} \otimes \text{right}$, one summand of a coproduct
    library: enumeratio-hopf
    type: (number, number) -> number
seeAlso:
  - Coproduct
---

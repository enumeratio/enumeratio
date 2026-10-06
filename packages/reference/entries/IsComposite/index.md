---
name: IsComposite
domain: Compute engine
signature: IsComposite(number) -> boolean
summary: "`IsComposite(n)` returns `True` if `n` is a composite number"
signatures:
  - call: IsComposite(number) -> boolean
    description: as compute-engine declares it
  - call: IsComposite(z)
    description: for a complex $z$, whether it is composite in $\mathbb{Z}[i]$ (neither zero, a unit nor a Gaussian prime), so $3 + i = (1 + i)(2 - i)$ is.
    library: enumeratio-number-theory
    type: (number | quadratic_integer, any*) -> boolean
    overrides: compute-engine
names:
  wolfram: CompositeQ
stub: engine
---

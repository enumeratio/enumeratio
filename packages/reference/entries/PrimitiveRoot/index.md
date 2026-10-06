---
name: PrimitiveRoot
domain: Compute engine
signature: PrimitiveRoot(integer) -> integer
summary: The smallest primitive root modulo `n` (a generator of the multiplicative group of integers mod `n`), or undefined if none exists (which happens unless `n` is 1, 2, 4, pᵏ, or 2pᵏ for an odd prime p). The sign of `n` is ignored, and `PrimitiveRoot(1)` is 0. Undefined for `n = 0`.
signatures:
  - call: PrimitiveRoot(integer) -> integer
    description: as compute-engine declares it
stub: engine
names:
  wolframIdentity: true
---

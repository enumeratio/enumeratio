---
name: KroneckerDelta
domain: Compute engine
signature: KroneckerDelta(value+) -> integer
summary: "Return 1 if the arguments are equal, 0 otherwise. With a single argument n, this is δ_{n,0}: 1 if n = 0, 0 otherwise."
signatures:
  - call: KroneckerDelta(value+) -> integer
    description: as compute-engine declares it
stub: engine
names:
  wolframIdentity: true
---

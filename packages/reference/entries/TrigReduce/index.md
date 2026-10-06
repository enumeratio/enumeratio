---
name: TrigReduce
domain: Compute engine
signature: TrigReduce(value) -> value
summary: "Rewrite products and integer powers of trigonometric and hyperbolic functions as a linear combination of functions of multiple angles (the inverse of TrigExpand). Example: TrigReduce(sin(x)^2) → (1 - cos(2x))/2"
signatures:
  - call: TrigReduce(value) -> value
    description: as compute-engine declares it
stub: engine
names:
  wolframIdentity: true
---

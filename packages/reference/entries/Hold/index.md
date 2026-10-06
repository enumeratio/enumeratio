---
name: Hold
domain: Compute engine
signature: Hold(any) -> unknown
summary: Hold an expression, preventing it from being canonicalized or evaluated until `ReleaseHold` is applied to it
signatures:
  - call: Hold(any) -> unknown
    description: as compute-engine declares it
stub: engine
names:
  wolframIdentity: true
---

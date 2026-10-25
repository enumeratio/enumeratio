---
name: FixedPoint
domain: Collections
signature: FixedPoint(f, x, maxIterations?)
summary: Iterates f from x until the result no longer changes.
signatures:
  - call: FixedPoint(f, x, maxIterations?)
    description: iterates $f$ starting from $x$ until two successive values are equal, or for at most $maxIterations$ steps.
    library: enumeratio-combinatorics
    type: "(function, initial: any, maxIterations: integer?) -> unknown"
    overrides: compute-engine
seeAlso:
  - Nest
  - NestList
names:
  wolframIdentity: true
---

- compute-engine's own $FixedPoint$ does the iterating. Two successive values are the same when they are structurally identical or, for a float, agree to the working precision. It stays unevaluated when the iteration cannot converge: a value that nests the previous one, an exact number that gains digits at every step, or the default iteration limit reached without settling. A given `maxIterations` returns the last value instead, as Wolfram's does.
- An inexact iteration runs with ten guard digits past the engine's precision and the answer is rounded back to it, so every printed digit is right: the last step of a convergent iteration is off by a few times the stopping gap, which at the engine's own precision would reach the last digit or two.
- Newton's method for $\sqrt{2}$ on an exact rational start gains digits at every step, so it never settles and the call stays unevaluated (Wolfram aborts there too). The two exact-rational examples record the rational a finite run would reach as a gap.

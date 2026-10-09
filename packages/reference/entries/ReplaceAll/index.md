---
name: ReplaceAll
domain: Compute engine
signature: ReplaceAll(any, any+) -> any
summary: "ReplaceAll(expr, rules): apply one or more replacement rules to `expr`, then evaluate the result (Mathematica `expr /. rules`). A rule is `Rule(lhs, rhs)`, or `lhs -> rhs` in LaTeX (parsed as `To`; in Epsil `->` builds a dictionary entry, which is not a rule). Several rules may be given as extra arguments or as a `List`/`Set` of rules; they are applied simultaneously in a single pass."
signatures:
  - call: ReplaceAll(any, any+) -> any
    description: as compute-engine declares it
  - call: ReplaceAll(any, any+) -> any
    description: a rule with a compound left side applies wherever it matches, top-down, the first matching rule winning at each part.
    library: enumeratio-combinatorics
    type: (any, any+) -> any
    overrides: compute-engine
stub: engine
attributes:
  - HoldAll
names:
  wolframIdentity: true
---

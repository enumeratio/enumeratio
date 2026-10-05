---
name: FreeQ
domain: Collections
signature: FreeQ(expr, pattern)
summary: Whether pattern matches nowhere in expr — itself, or any subexpression, at any depth.
signatures:
  - call: FreeQ(expr, pattern)
    description: True unless pattern matches expr or some subexpression
    library: enumeratio-combinatorics
    type: (any, any) -> boolean
seeAlso:
  - MatchQ
  - Level
names:
  wolframIdentity: true
attributes:
  - HoldAll
---

- Searches the WHOLE tree, not just the top level — that's the difference from [[MatchQ]], which only checks expr itself.
- An Association's keys are not parts: only its values are searched.
- Uses the same wildcard grammar as [[MatchQ]] — see its reference entry for what's supported.

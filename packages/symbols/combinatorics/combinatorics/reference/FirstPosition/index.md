---
name: FirstPosition
domain: Collections
signature: FirstPosition(collection, value)
summary: The position of the first occurrence of value, searching every level.
signatures:
  - call: FirstPosition(collection, value)
    description: the position of the first occurrence of `value`, searching every level rather than just the top one.
    library: enumeratio-combinatorics
    type: (any, any) -> list<integer>
seeAlso:
  - IndexOf
  - Position
  - At
names:
  wolframIdentity: true
---

- Unlike [[IndexOf]], which only looks at the top level, FirstPosition descends into nested expressions of any head — depth-first, outer to inner, left to right — and matches heads too, at index $0$: the first $Power$ in $x^2 + y^2$ is at $\{1, 0\}$. It is [[Position]]'s first answer.
- The empty $List$ when the value isn't found anywhere.

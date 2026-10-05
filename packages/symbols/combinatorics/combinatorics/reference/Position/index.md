---
name: Position
domain: Collections
signature: Position(collection, value)
summary: Every position value occurs at in the collection.
signatures:
  - call: Position(collection, value)
    description: every position `value` occurs at, each wrapped in its own $List$.
    library: enumeratio-combinatorics
    type: (indexed_collection<any>, any) -> list<integer> | list<list<integer>>
    overrides: compute-engine
seeAlso:
  - IndexOf
  - At
names:
  wolframIdentity: true
---

- Wolfram's answer where [[IndexOf]] reports only the first occurrence, as a plain index.
- An empty $List$ when the value isn't present.
- Each position is a $List$ of indices, one per level: the search goes into nested collections, so $\{2, 3\}$ is the third part of the second.
- Heads count as well, at index $0$: `Position({{1}, {2}}, List)` is `{{0}, {1, 0}, {2, 0}}`.

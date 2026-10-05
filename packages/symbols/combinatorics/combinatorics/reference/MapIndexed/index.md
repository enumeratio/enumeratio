---
name: MapIndexed
domain: Collections
signature: MapIndexed(f, list) / MapIndexed(f, list, levelspec)
summary: f applied to each part together with its position path, a list.
signatures:
  - call: MapIndexed(f, list)
    description: "{f(a1, {1}), f(a2, {2}), …} — the index is a LIST, not a bare integer"
    library: enumeratio-combinatorics
    type: "(function: any, list<any>, any?) -> list<any>"
  - call: MapIndexed(f, list, levelspec)
    description: f goes on every part in those levels (as in Level), innermost first, with its full position path
    library: enumeratio-combinatorics
seeAlso:
  - MapThread
  - Level
names:
  wolframIdentity: true
---

- The index arrives as a position path, `{i}` at the top level, not `i`; with a level spec, a part at depth 2 gets `{i, j}`, and so on.
- Without a level spec, f goes on the top-level parts only.

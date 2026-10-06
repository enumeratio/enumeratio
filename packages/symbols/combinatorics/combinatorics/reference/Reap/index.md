---
name: Reap
domain: Collections
signature: Reap(expr)
summary: Evaluates an expression together with everything Sow recorded during it.
signatures:
  - call: Reap(expr)
    description: "$\\{value, \\{\\{sown, ...\\}, ...\\}\\}$: $expr$'s value, and one list per distinct tag [[Sow]] used while evaluating it (untagged sows share one group), in first-appearance order. $\\{value, \\{\\}\\}$ if nothing was sown."
    library: enumeratio-combinatorics
    type: (any, any?) -> any
  - call: Reap(expr, tag)
    description: Like $Reap(expr)$, but the second element is the list of groups whose tag matches $tag$ exactly. With a list of tags it holds one such list per tag, so a tag nothing was sown under gives $\{\}$ in its place. $Sow(e, \{tag1, tag2\})$ sows under each of its tags.
    library: enumeratio-combinatorics
seeAlso:
  - Sow
names:
  wolframIdentity: true
attributes:
  - HoldAll
---

- Only exact tag equality is matched here, not Wolfram's fuller pattern-matching form of the second argument.
- Sequencing several $Sow$s in one $expr$: use $[Last, [List, ...]]$ (Wolfram's $a; b; c$), not compute-engine's own $Block$ — see [[Sow]]'s examples and control.ts's module doc for why.

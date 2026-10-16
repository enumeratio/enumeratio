---
name: IsTreeGraph
domain: Collections
signature: IsTreeGraph(g)
summary: Whether a [[Graph]] is a tree — connected, with exactly $|V| - 1$ edges.
signatures:
  - call: IsTreeGraph(g)
    description: true iff $g$ is connected (underlying, direction ignored) and has exactly $|V(g)| - 1$ edges — the standard connected-plus-edge-count tree test.
    library: enumeratio-combinatorics
    type: (value) -> boolean
seeAlso:
  - IsConnectedGraph
  - CompleteKaryTree
names:
  wolfram: TreeGraphQ
bindings:
  - origin: mapped
    form: sage
    template: ($1).is_tree()
    arity: 1
    checked:
      version: "10.9"
      on: 2026-10-16
---

- Wolfram calls this `TreeGraphQ`; this library uses the `Is…` spelling everywhere.

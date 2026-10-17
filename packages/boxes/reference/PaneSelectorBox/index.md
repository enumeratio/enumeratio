---
name: PaneSelectorBox
domain: Boxes
signature: PaneSelectorBox(rules, binding, options)
summary: "Alternatives, one shown: the pane whose key is the binding's value."
signatures:
  - call: PaneSelectorBox(rules, binding, options)
    description: "Alternatives, one shown: the pane whose key is the binding's value."
    library: enumeratio-boxes
    type: (list<tuple<boxes, boxes>>, expression, expression*) -> boxes
seeAlso:
  - DynamicBox
  - PaneBox
names:
  wolframIdentity: true
---

- `PaneSelector([True -> a, False -> b], Dynamic(test))` lowers to it. The panes are `key -> pane` rules and the selector is the binding `Dynamic(test)`, as Wolfram boxes it; the pane drawn is the one whose key reads the same as its value (`True`, `1`, a name). A value with no pane draws nothing. The example's `expected` shows `Tuple`: compute-engine reads a symbol-keyed pair as one.
- A writer with no values (LaTeX, text, a terminal) writes the first pane.
- It is its own element: it follows the page's variables without its parent. A phrase that appears only under a condition is a pane under `True` alone.

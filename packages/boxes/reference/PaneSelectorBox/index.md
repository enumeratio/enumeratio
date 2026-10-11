---
name: PaneSelectorBox
domain: Boxes
signature: PaneSelectorBox(panes, selector, options)
summary: "Alternatives, one shown: the pane whose key is the selector's value."
signatures:
  - call: PaneSelectorBox(panes, selector, options)
    description: "Alternatives, one shown: the pane whose key is the selector's value."
    library: enumeratio-boxes
    type: (list<list<boxes>>, boxes, expression*) -> boxes
seeAlso:
  - DynamicBox
  - PaneBox
names:
  wolframIdentity: true
---

- `PaneSelector([True -> a, False -> b], Dynamic(test))` lowers to it. The panes are `[key, pane]` rows; the selector is a `DynamicBox`, and the pane drawn is the one whose key reads the same as its value (`True`, `1`, a name). A value with no pane draws nothing.
- Wolfram's `PaneSelectorBox` takes rules and a `Dynamic`; ours takes rows and a `DynamicBox`, as the control boxes do.
- A writer with no values (LaTeX, text, a terminal) writes the first pane.
- It is its own element: it follows the page's variables without its parent. A phrase that appears only under a condition is a pane under `True` alone.

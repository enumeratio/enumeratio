---
name: TooltipBox
domain: Boxes
signature: TooltipBox(box, tip, options)
summary: "A box and what shows on hover or focus: what `Tooltip` lowers to."
signatures:
  - call: TooltipBox(box, tip, options)
    description: "A box and what shows on hover or focus: what `Tooltip` lowers to."
    library: enumeratio-boxes
    type: (boxes, boxes, expression*) -> boxes
seeAlso:
  - PaneBox
  - PanelBox
names:
  wolframIdentity: true
---

- The tip is a box; the web shows its text. Every writer but the web's draws the box alone.
- It is a tab stop, so a keyboard reader sees the tip too.

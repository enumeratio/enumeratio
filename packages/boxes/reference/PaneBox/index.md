---
name: PaneBox
domain: Boxes
signature: PaneBox(box, options)
summary: "A box at a size, scrolling or scaling past it: `ImageSize` fixes the room, `Scrollbars` and `ImageSizeAction` say what happens to the overflow."
signatures:
  - call: PaneBox(box, options)
    description: "A box at a size, scrolling or scaling past it: `ImageSize` fixes the room, `Scrollbars` and `ImageSizeAction` say what happens to the overflow."
    library: enumeratio-boxes
    type: (boxes, expression*) -> boxes
seeAlso:
  - PanelBox
  - FrameBox
names:
  wolframIdentity: true
---

- `Pane(x, 200)` lowers to it. Layout reserves the room whatever the content measures.
- It draws nothing of its own, so LaTeX, MathML and text write only the content.

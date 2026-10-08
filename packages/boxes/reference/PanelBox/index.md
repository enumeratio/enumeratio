---
name: PanelBox
domain: Boxes
signature: PanelBox(box, options)
summary: "A box on a background with a frame, padded: what `Panel` lowers to."
signatures:
  - call: PanelBox(box, options)
    description: "A box on a background with a frame, padded: what `Panel` lowers to."
    library: enumeratio-boxes
    type: (boxes, expression*) -> boxes
seeAlso:
  - FrameBox
  - PaneBox
names:
  wolframIdentity: true
---

- `Panel(x)` lowers to it. `Background`, `FrameMargins` and `ImageSize` are its options.
- LaTeX writes `\boxed`; MathML a framed `mrow`; text just the content.

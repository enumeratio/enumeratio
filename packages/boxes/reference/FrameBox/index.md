---
name: FrameBox
domain: Boxes
signature: FrameBox(box)
summary: A box drawn with a frame around it.
signatures:
  - call: FrameBox(box)
    description: A box drawn with a frame around it.
    library: enumeratio-boxes
    type: (boxes, expression*) -> boxes
details:
  - MathML Core has no `menclose`, so MathML draws the frame with CSS on an `mrow`; LaTeX writes `\boxed`.
seeAlso:
  - StyleBox
names:
  wolframIdentity: true
---

---
name: Slider2DBox
domain: Boxes
signature: Slider2DBox(binding, domain, options)
summary: "A square with a draggable point that moves a pair: `Slider2D` lowers to it."
signatures:
  - call: Slider2DBox(binding, domain, options)
    description: "A square with a draggable point that moves a pair: `Slider2D` lowers to it."
    library: enumeratio-boxes
    type: (boxes, expression, expression*) -> boxes
seeAlso:
  - SliderBox
  - DynamicBox
names:
  wolframIdentity: true
---

- The domain is the corners `((x0, y0), (x1, y1))`, and a step.
- Its intent is planar: the binding holds an `(x, y)` pair.

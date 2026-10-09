---
name: LocatorBox
domain: Boxes
signature: LocatorBox(binding, domain, options)
summary: "A point handle you drag inside a figure: `Locator` lowers to it."
signatures:
  - call: LocatorBox(binding, domain, options)
    description: "A point handle you drag inside a figure: `Locator` lowers to it."
    library: enumeratio-boxes
    type: (boxes, expression, expression*) -> boxes
seeAlso:
  - Slider2DBox
  - GraphicsBox
  - DynamicBox
names:
  wolframIdentity: true
---

- Wolfram's `LocatorBox` holds the point; here the binding is a `DynamicBox` over `(p, (x, y))`, and the domain is `Automatic`: the figure it sits in gives the corners.
- Its intent is planar: a host without a figure to drag in draws the point's coordinates.

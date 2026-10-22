---
name: LocatorBox
domain: Boxes
signature: LocatorBox(binding, domain?, options)
summary: "A point handle you drag inside a figure: `Locator` lowers to it."
signatures:
  - call: LocatorBox(binding, domain?, options)
    description: "A point handle you drag inside a figure: `Locator` lowers to it."
    library: enumeratio-boxes
    type: (expression, expression*) -> boxes
seeAlso:
  - Slider2DBox
  - GraphicsBox
  - DynamicBox
names:
  wolframIdentity: true
---

- Wolfram's `LocatorBox` holds the point; here the binding is `Dynamic((p, (x, y)))`, and there is no domain: the figure it sits in gives the corners.
- Its intent is planar: a host without a figure to drag in draws the point's coordinates.
- Wolfram's `Locator[Dynamic[p]]` boxes as `RowBox[{"Locator", ...}]`, with no `LocatorBox` head of its own to compare.

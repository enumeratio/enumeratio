---
name: Show
domain: Graphics
signature: Show(layers..., options...)
summary: "Wolfram's Show: layers drawn in one coordinate frame, sharing one view. Held as written, so a layer's ColorRules name the properties it publishes rather than compute-engine's heads."
names:
  wolframIdentity: true
signatures:
  - call: Show(layers..., options...)
    description: the layers in one frame, sharing one view
    library: enumeratio-formats
    type: (any*) -> any
attributes:
  - HoldAll
seeAlso:
  - Labeled
  - ArrayPlot
---

`Show(LatticeTiles(QuadraticIntegers(-5), ColorRules -> [IsPrime -> Teal]), GridLines -> [10, 10])`
draws the primes of ℤ[√−5] over a grid every 10 units along each axis of the lattice. Its layers
(`LatticeTiles`, `ArrayPlot`) style their elements by `ColorRules`, `ColorMixing` and
`BoundaryStyle`; its options are Wolfram's (`GridLines`, `Axes`, `AspectRatio`, `ImageSize`) with
`Selection` and `GestureHandling` added. The wiki's
[Figures](https://github.com/enumeratio/enumeratio/wiki/Figures) page has the whole design.

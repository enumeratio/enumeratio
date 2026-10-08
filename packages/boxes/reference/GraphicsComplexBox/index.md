---
name: GraphicsComplexBox
domain: Boxes
signature: GraphicsComplexBox(box, options)
summary: "Primitives that share places: `Addresses` and `Places` give each address's position, and a primitive tagged with an address sits there unless it names its own."
signatures:
  - call: GraphicsComplexBox(box, options)
    description: "Primitives that share places: `Addresses` and `Places` give each address's position, and a primitive tagged with an address sits there unless it names its own."
    library: enumeratio-boxes
    type: (boxes, expression*) -> boxes
seeAlso:
  - GraphicsBox
  - TagBox
names:
  wolframIdentity: true
---

- A mark is a `TagBox` of its primitive and its address (`"1,0"`); a link is tagged with its members (`"1,0;2,1"`).

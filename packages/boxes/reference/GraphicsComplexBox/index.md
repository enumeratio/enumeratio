---
name: GraphicsComplexBox
domain: Boxes
signature: GraphicsComplexBox(coordinates, primitives, options)
summary: "Primitives that share places: the coordinates give each address's position (`Addresses` names them), and a primitive tagged with an address sits there unless it names its own."
signatures:
  - call: GraphicsComplexBox(coordinates, primitives, options)
    description: "Primitives that share places: the coordinates give each address's position (`Addresses` names them), and a primitive tagged with an address sits there unless it names its own."
    library: enumeratio-boxes
    type: (list, boxes | list, expression*) -> boxes
seeAlso:
  - GraphicsBox
  - TagBox
names:
  wolframIdentity: true
---

- A mark is a `TagBox` of its primitive and its address (`"1,0"`); a link is tagged with its members (`"1,0;2,1"`).

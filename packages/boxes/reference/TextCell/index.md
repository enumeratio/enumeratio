---
name: TextCell
domain: Boxes
signature: TextCell(content, style)
summary: "A block of prose in a cell style: `Text`, `Section`, `Item`, `DisplayFormula`, `Program`, …"
signatures:
  - call: TextCell(content, style)
    description: "A block of prose in a cell style: `Text`, `Section`, `Item`, `DisplayFormula`, `Program`, …"
    library: enumeratio-boxes
    type: (boxes, string, expression*) -> boxes
seeAlso:
  - TextData
  - FormBox
names:
  wolframIdentity: true
---

- What a markdown block reads as: a paragraph is `Text`, a heading `Title` to `Subsubsubsubsection`, a list item `Item`/`Subitem`/`Subsubitem` (`…Numbered` in a numbered list), a `$$` block `DisplayFormula`, a fenced block `Program` with its `Language`, a block quote `Quote`.
- A document is a sequence of them, as a notebook's cells are.

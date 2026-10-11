---
name: TextData
domain: Boxes
signature: TextData([item1, item2, …])
summary: Running text; its string leaves are words, not tokens.
signatures:
  - call: TextData([item1, item2, …])
    description: Running text; its string leaves are words, not tokens.
    library: enumeratio-boxes
    type: (list<boxes>) -> boxes
seeAlso:
  - TextCell
  - StyleBox
  - ButtonBox
names:
  wolframIdentity: true
---

- `StringTemplate("… {_d} …")` lowers to it (under a `TagBox` that keeps the head): the words are string leaves, a `$…$` island is a `FormBox` of held TeX, `{_d}` a `TemplateSlot`, any other `{…}` a `TemplateExpression`, `{Setter(_e, v, "label")}` a `ButtonBox`.
- The web draws it as a span; each hole is the page's to fill from the scope it sits in.
- Emphasis, strong and code are `StyleBox`es (`FontSlant`, `FontWeight`, `BaseStyle -> "InlineCode"`), links `ButtonBox`es, formulas `FormBox`es.

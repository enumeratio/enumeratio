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

- Emphasis, strong and code are `StyleBox`es (`FontSlant`, `FontWeight`, `BaseStyle -> "InlineCode"`), links `ButtonBox`es, formulas `FormBox`es.

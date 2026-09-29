---
name: Mode
domain: Collections
signature: Mode(collection)
summary: The most frequently occurring element of the collection.
signatures:
  - call: Mode(collection)
    description: the most frequently occurring element.
  - call: Mode(collection)
    description: The most frequently occurring element of the collection.
    library: enumeratio-combinatorics
    type: ((collection<any> | number)+) -> nan | real | signed_infinity
    overrides: compute-engine
seeAlso:
  - Mean
  - Median
  - Commonest
references:
  - system: wikipedia
    identity: Mode (statistics)
  - system: mathworld
    identity: Mode
---

- The mode occurs exactly as many times as the highest frequency in the collection: $Count(c, Mode(c))$ gives that frequency. See [[Count]].
- When several elements share the highest frequency, Mode returns just one. See [[Commonest]] for every tied value.
- See [[Mean]] and [[Median]] for other measures of central tendency.

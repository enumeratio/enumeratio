---
order: 1
title: Try it
---

# Try it

A symbol page shows a **Try it** panel when its head can be driven by controls. The panel is a
[`<notatio-manipulate>`](/docs/components/manipulate) over the head's first example, built
from the head's typed signature. It loads only in the browser.

## How the controls are found

`inferFromSignature` takes the head's first example and lifts each literal at a **typed**
position (not `any`) into a control:

- `IntegerPartitions(8)` over `(integer, any?, any?)` becomes an integer slider `n`
  starting at 8.
- A lifted integer ends at the example's literal or 6, whichever is larger, unless the
  signature's type bounds it, so a collection head never starts at a size that hangs the page.
  The record's `maxSize` bounds it, where it has one.
- An option rule `Key -> value` is lifted when the record declares the key in `optionValues`
  and allows the value: `True` or `False` becomes a checkbox, other values a setter bar
  (up to five) or a popup menu. Symbols and strings work alike, so `ElementOrder -> Natural`
  offers `Natural` and the other declared orders. An option control shows even when every
  positional parameter is `any`.

A head with nothing to lift shows no panel.

## Collection heads

A collection head with no liftable example falls back to the
[collection explorer's](/docs/components/collection-explorer) sized call, and its size control
takes the explorer's bounds (start, minimum, maximum). Where an example does lift, its size
control takes the same bounds, so Try it and the table's stepper agree.

## Records

The `maxSize` and `optionValues` fields are described in
[Reference records](/docs/entry/record-fields).

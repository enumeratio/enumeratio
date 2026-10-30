---
order: 1
title: Record fields for generated UI
---

# Record fields for generated UI

A head's `index.md` front matter carries a few optional fields that the generated interface
reads. None changes what the head evaluates to.

## `maxSize`

The largest value of the head's size parameter (its first integer argument) that is safe to
offer interactively. Past it the collection is too large to draw or count in a moment.

```yaml
maxSize: 8
```

The [Try it panel](/docs/frontend/try-it) stops its size slider here, and the
[collection explorer](/docs/components/collection-explorer) bounds its stepper by it. A head
without one is bounded by its type alone, and the explorer's default is 6.

## `optionValues`

The values an option may take, where the set is finite, by option key. Options are trailing
rules, not positional parameters, so the signature's types cannot say it.

```yaml
optionValues:
  GridLines: [true, false]
  ScalingFunctions: [Linear, Log]
```

Booleans are written as booleans, strings as strings, numbers as numbers, and a bare name as a
symbol. When the head's first example writes `GridLines -> True`, Try it offers a checkbox.

## `glyph` and `enumerate`

A carrier record's `glyph:` names the kind (`permutation`, `subset`, …) that draws one of its
elements in a table. A collection head's `enumerate:` (`expr`, `columns`, `glyph`, `pageSize`)
overrides the derived table field by field.

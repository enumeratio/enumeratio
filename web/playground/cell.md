# Cell

`<notatio-cell>` — a notebook-style In/Out pair: an editable input with its
evaluated output beneath, each labelled. The summary line sits above the cell.

`value` is notatio; the cell converts it to LaTeX for the MathLive field, and what you
type there is LaTeX from then on. `in-form="latex"` skips the conversion and hands the
field the value as written; `in-form="wolfram"` swaps the field for a full-form box.

<Story
  title="A notebook cell">
<template #description>Edit the In line; the Out line re-evaluates.</template>
<notatio-cell value="1 / 2 + 1 / 3" />
</Story>

<Story
  title="Symbolic input">
<notatio-cell value="Sum(k, (k, 1, n))" />
</Story>

## As a Vue component

`<Cell>` is the same element behind a Vue component named for the symbol, whose props
are the attributes, typed — generated from the element source, like every other
component's (see [the playground overview](/playground/#as-vue-components)). A markdown
author composes Vue and gets a compile-time check on the spelling; the element
underneath is unchanged.

<Story
  title="The Vue wrapper">
<Cell value="Binomial(10, 3) + 1 / 2" out-form="input" />
</Story>

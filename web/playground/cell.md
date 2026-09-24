# Cell

`<notatio-cell>` — a notebook-style In/Out pair: an editable input with its
evaluated output beneath, each labelled. The summary line sits above the cell.

`value` is notatio by default -- `format` names the syntax it's written in
(`notatio`, `latex`, `mathjson` or `wolfram`). `in-form` picks the editor: `standard`
(the MathLive field, the default), or a plain text field in `input` (InputForm),
`full` (the MathJSON AST), `wolfram` (Wolfram source) or `tex` (LaTeX) -- each parsed
back on Enter or blur. Click the In label to switch editors or copy the value out.

<Story
  title="A notebook cell">
<template #description>Edit the In line; the Out line re-evaluates.</template>
<notatio-cell value="1 / 2 + 1 / 3" />
</Story>

<Story
  title="Symbolic input">
<notatio-cell value="Sum(k, (k, 1, n))" />
</Story>

## As an expression

`Cell` is a symbol too: `Cell(expr)` holds `expr` unevaluated and draws as this element,
so a cell can be written in notatio anywhere an expression goes. Options, Wolfram's way,
as trailing rules: `InForm` and `OutForm` name the forms (`InputForm`, `TraditionalForm`,
…) and `Expected` is the value the Out should come to.

<Story
  title="A cell, written as an expression">
<notatio-out format="notatio" value="Cell(PowerModList(3, 1/2, 11))" />
</Story>

<Story
  title="Options">
<template #description>InputForm edits as text; the Out is checked against Expected (edit it and the check drops).</template>
<notatio-out format="notatio" value='Cell(Binomial(10, 3), InForm -> "InputForm", OutForm -> "TraditionalForm", Expected -> 120)' />
</Story>

<Story
  title="Cells in a column">
<template #description>A list of cells, laid out -- each evaluates on its own, with no shared state yet.</template>
<notatio-out format="notatio" value="Column([Cell(1/2 + 1/3), Cell(Sum(k, (k, 1, 10))), Cell(PrimitiveRootList(7))])" />
</Story>

<Story
  title="A cell that evaluates to a cell">
<template #description>The In here is <code>Cell(1 + 1)</code>; its value is itself, drawn.</template>
<notatio-cell value="Cell(1 + 1)" />
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

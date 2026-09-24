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

<Story
  title="A control in a cell">
<template #description>The In is source and stays as written; the Out reduces for where it lands, so printing the page samples the slider (<code>env="print"</code> shows it here) rather than drawing one that cannot move.</template>
<notatio-cell value="Row([Slider((k, 2), (0, 5)), Dynamic(k^2)])" />
<notatio-cell value="Row([Slider((k, 2), (0, 5)), Dynamic(k^2)])" env="print" />
</Story>

## Transcripts

`DynamicModule([Cell(...), Cell(...), ...])` — a `List` of `Cell`s — shares one
evaluation scope across its cells, evaluated in document order: a binding one cell
makes is visible to the next (unlike "Cells in a column" above, where each cell is on
its own). Wolfram's `$Line` transcript: editing a cell re-evaluates _that_ cell in the
shared scope, but a later cell does not auto-follow — re-run it yourself to see the new
binding. `Notebook(cells)` is Wolfram's own name for the same configuration.

<Story
  title="A shared scope">
<template #description>The first cell binds <code>a</code>; the second reads it. Change the 5, then edit the second cell to re-run it -- a transcript does not re-run later cells on its own.</template>
<notatio-out format="notatio" value="DynamicModule([Cell(a := 5), Cell(a^2)])" />
</Story>

<Story
  title="History: Out(n), In(n), InString(n)">
<template #description>Every evaluation gets a line number, shown as the In/Out label. <code>Out(n)</code> reads a prior line's result back; <code>In(n)</code> re-evaluates that line's input against the CURRENT scope; <code>InString(n)</code> is its literal text.</template>
<notatio-out format="notatio" value="Notebook([Cell(3 + 4), Cell(Out(1) * 2), Cell(InString(1))])" />
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

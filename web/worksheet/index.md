---
title: Worksheet
sidebar: false
aside: false
pageClass: worksheet-page
---

# Worksheet

Named expressions and a shared view of what they draw. Bind a number with `:=` and it
gets a slider; leave `x` free and it is a curve, `x` and `y` a surface, `z` the complex
plane. Cells are defined by name, so they can go in any order — drag one by its mark.

::: warning Nothing here is saved yet
This worksheet lives only as long as the tab. Keeping worksheets in your browser —
offline, on your machine, with no account — is the next step; see
[the design](https://github.com/enumeratio/enumeratio/blob/main/design/notebooks.md).
:::

<ClientOnly>
<notatio-worksheet seed='["a := 2", "b := 1", "Sin(a * x) + b", "Sin(a * x) * Cos(b * y)"]' />
</ClientOnly>

Everything evaluates here, in the page. For what a cell can say, see the
[worksheet stories](/playground/worksheet); for the heads it can call, the
[symbol reference](/reference/symbol/). Looking for `In[n]`/`Out[n]` and prose between
the cells? That is the [notebook](/notebook/).

<style>
/* The screen wants the width: past VPDoc's centred reading column (same selectors, one
   class more specific), as wide as the viewport allows up to a point. */
.worksheet-page .VPDoc:not(.has-sidebar) .container,
.worksheet-page .VPDoc:not(.has-sidebar) .content {
  max-width: 1280px;
}
</style>

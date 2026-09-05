# `<svg-figure>`

The **generic figure renderer**: it injects a ready-made SVG string verbatim. The geometry is authored in the db —
emitted by `glyph_svg(<carrier>)` — instead of hardcoded in a per-glyph TypeScript element, so this one element draws
every page-space figure. The client-backed [`<enumeratio-figure>`](/develop/packages/components/figure) wraps it to draw an
element's db SVG straight from a `(collection, n, rank)` address.

## Properties

| property | type | meaning |
|---|---|---|
| `svg` | string | a complete `<svg…>…</svg>` string, injected as-is |
| `fullscreenable` | boolean (attr) | render as a block **panel** with a fullscreen toggle, instead of an inline glyph |

`svg` is a **property**; bind it (`:svg` / `.svg`). The injected markup references the shared `--enumeratio-*` hooks,
which inherit through the shadow boundary, so it themes with everything else. Height-driven sizing keeps an inline
glyph in step with the surrounding text.

## Usage

```html
<svg-figure :svg="'<svg viewBox=\'0 0 60 40\'><circle cx=\'20\' cy=\'20\' r=\'14\' fill=\'var(--enumeratio-accent)\' /><rect x=\'34\' y=\'8\' width=\'22\' height=\'24\' fill=\'none\' stroke=\'var(--enumeratio-border)\' /></svg>'"></svg-figure>
```

<p>
<svg-figure :svg="'<svg viewBox=\'0 0 60 40\'><circle cx=\'20\' cy=\'20\' r=\'14\' fill=\'var(--enumeratio-accent, #d97706)\' /><rect x=\'34\' y=\'8\' width=\'22\' height=\'24\' fill=\'none\' stroke=\'var(--enumeratio-border, currentColor)\' /></svg>'"></svg-figure>
</p>

::: warning Trusted SVG only
`svg` is injected with Lit's `unsafeHTML` — pass only SVG you produced (the db's `glyph_svg`, or your own), never
untrusted input.
:::

## Fullscreen (panel mode)

Set the `fullscreenable` attribute to render the figure as a self-contained **block panel** with a fullscreen toggle
in the corner — for a standalone figure worth blowing up to full screen, rather than an inline glyph in prose. The
toggle is the shared [`<fullscreen-button>`](#) control, the same one the polytope figures use in their corner
overlay; it fullscreens the panel via the Fullscreen API and its icon reflects the state (expand ⇄ contract).

```html
<svg-figure fullscreenable :svg="'<svg viewBox=\'0 0 200 120\'>…</svg>'"></svg-figure>
```

<svg-figure fullscreenable :svg="'<svg viewBox=\'0 0 200 120\'><rect x=\'2\' y=\'2\' width=\'196\' height=\'116\' rx=\'6\' fill=\'none\' stroke=\'var(--enumeratio-border, currentColor)\' /><circle cx=\'70\' cy=\'60\' r=\'40\' fill=\'var(--enumeratio-accent, #d97706)\' opacity=\'0.7\' /><rect x=\'110\' y=\'28\' width=\'64\' height=\'64\' fill=\'none\' stroke=\'var(--enumeratio-accent, #d97706)\' stroke-width=\'3\' /></svg>'"></svg-figure>

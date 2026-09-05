---
title: Design system
---

# Design system

One visual system for the whole project — the VitePress docs, the mounted explorer app, and the client-backed
web components all draw from a single set of design tokens. The identity is **bronze/gold on warm paper**: a
restrained, classical-atlas palette fitting a catalog of combinatorial structures.

The tokens are CSS custom properties defined once in
[`docs/.vitepress/theme/tokens.css`](https://github.com/enumeratio/enumeratio/blob/main/docs/.vitepress/theme/tokens.css)
and bridged onto VitePress's `--vp-*` and PrimeVue's `--p-*` variables, so the docs chrome and the app stay in
step without duplicating values. Everything is theme-aware: dark values are keyed off VitePress's `.dark` class,
which its runtime sets from the OS `prefers-color-scheme` on first load and from the toggle after — so the system
preference and an explicit switch are both honoured.

## The mark

The **Pascal-lattice mark** — three rows of the binomial lattice with one enumerated rank-1 path highlighted —
carries over from the numbers repo (the project's precursor), recolored to the identity: bronze on light, gold
on dark, over muted stone.

<div class="ds-marks">
  <figure><img src="/logo-light.svg" alt="mark, light" width="72" style="background:#fdfcfa"><figcaption>light — <code>logo-light.svg</code></figcaption></figure>
  <figure><img src="/logo-dark.svg" alt="mark, dark" width="72" style="background:#1a1714"><figcaption>dark — <code>logo-dark.svg</code></figcaption></figure>
  <figure><img src="/avatar.svg" alt="avatar" width="72" style="border-radius:12px"><figcaption>avatar — <code>avatar.svg</code></figcaption></figure>
</div>

One geometry, four files in `docs/public/`: the favicon (`favicon.svg`, theme-aware via an internal
`prefers-color-scheme` query — a favicon renders outside the page, so it can't read the site's `.dark` class),
the two nav logos (theme-picked by VitePress's `themeConfig.logo`), and the avatar source (gold on deep stone,
rasterized to PNG for the GitHub organization).

## Token layers

| Layer | Prefix | Use it? |
| --- | --- | --- |
| **Primitives** — raw color ramps | `--e-amber-500`, `--e-stone-200`, … | No — internal only |
| **Semantic roles** — what a color *means* | `--e-color-brand`, `--e-color-text-muted`, … | **Yes** — always reach for these |
| **Bridges** — VitePress / PrimeVue vars | `--vp-c-brand-1`, `--p-primary-color` | Only when a framework reads them |

Reach for a **semantic** token, never a primitive. `color: var(--e-color-brand-text)` survives a palette change;
`color: var(--e-amber-800)` does not.

## Color

Two brand hues and two functional ones — no other colors. **Amber/bronze** is the single interactive accent
(links, buttons, primary chips). **Verdigris teal** is the lone secondary accent, used only for the "related"
marker so it stays distinct from the primary. Green and red are strictly functional.

Roles are split for contrast: `-brand` fills a solid (light text passes AA on it), `-brand-text` colors type on
the page background, `-brand-contrast` is the text drawn *on* a brand fill.

<div class="ds-swatches">

| Role | Token | Light | Dark |
| --- | --- | --- | --- |
| Page background | `--e-color-bg` | <span class="ds-chip" style="background:#fdfcfa"></span> `#fdfcfa` | <span class="ds-chip" style="background:#1a1714"></span> `#1a1714` |
| Soft fill | `--e-color-bg-soft` | <span class="ds-chip" style="background:#f6f4f0"></span> `#f6f4f0` | <span class="ds-chip" style="background:#24211d"></span> `#24211d` |
| Elevated / card | `--e-color-bg-elevated` | <span class="ds-chip" style="background:#ffffff"></span> `#ffffff` | <span class="ds-chip" style="background:#211e1a"></span> `#211e1a` |
| Border | `--e-color-border` | <span class="ds-chip" style="background:#e7e5e4"></span> `#e7e5e4` | <span class="ds-chip" style="background:#38332c"></span> `#38332c` |
| Text | `--e-color-text` | <span class="ds-chip" style="background:#292524"></span> `#292524` | <span class="ds-chip" style="background:#ece8e1"></span> `#ece8e1` |
| Text muted | `--e-color-text-muted` | <span class="ds-chip" style="background:#57534e"></span> `#57534e` | <span class="ds-chip" style="background:#a8a29e"></span> `#a8a29e` |
| Brand (fill) | `--e-color-brand` | <span class="ds-chip" style="background:#b45309"></span> `#b45309` | <span class="ds-chip" style="background:#fbbf24"></span> `#fbbf24` |
| Brand (text) | `--e-color-brand-text` | <span class="ds-chip" style="background:#92400e"></span> `#92400e` | <span class="ds-chip" style="background:#fbbf24"></span> `#fbbf24` |
| Accent (related) | `--e-color-accent` | <span class="ds-chip" style="background:#0f766e"></span> `#0f766e` | <span class="ds-chip" style="background:#2dd4bf"></span> `#2dd4bf` |
| Success | `--e-color-success` | <span class="ds-chip" style="background:#16a34a"></span> `#16a34a` | <span class="ds-chip" style="background:#4ade80"></span> `#4ade80` |
| Danger | `--e-color-danger` | <span class="ds-chip" style="background:#dc2626"></span> `#dc2626` | <span class="ds-chip" style="background:#f87171"></span> `#f87171` |

</div>

The swatches above are literal hexes so both themes are always visible. The tiles below are the *live* roles —
toggle the site theme (top bar) and watch them shift:

<div class="ds-live">
  <div class="ds-tile" style="background:var(--e-color-brand);color:var(--e-color-brand-contrast)">brand + contrast</div>
  <div class="ds-tile" style="background:var(--e-color-brand-soft);color:var(--e-color-brand-text)">brand-soft + brand-text</div>
  <div class="ds-tile" style="background:var(--e-color-accent);color:#fff">accent</div>
  <div class="ds-tile" style="background:var(--e-color-bg-soft);color:var(--e-color-text)">bg-soft + text</div>
  <div class="ds-tile" style="background:var(--e-color-bg-soft);color:var(--e-color-text-muted)">text-muted</div>
  <div class="ds-tile" style="background:var(--e-color-success);color:#fff">success</div>
  <div class="ds-tile" style="background:var(--e-color-danger);color:#fff">danger</div>
</div>

## Typography

Three families: a system **sans** for UI and prose, a **mono** for carriers / notation / SQL, and a **serif**
reserved for occasional display. The scale is a modest ramp — most text is `base`, headings step up from `lg`.

<div class="ds-type">
  <div style="font-size:var(--e-text-3xl);font-weight:var(--e-weight-bold)">3xl · 2.2rem — display</div>
  <div style="font-size:var(--e-text-2xl);font-weight:var(--e-weight-bold)">2xl · 1.7rem — page title</div>
  <div style="font-size:var(--e-text-xl);font-weight:var(--e-weight-semibold)">xl · 1.35rem — section</div>
  <div style="font-size:var(--e-text-lg)">lg · 1.15rem — lead</div>
  <div style="font-size:var(--e-text-base)">base · 1rem — body copy</div>
  <div style="font-size:var(--e-text-sm);color:var(--e-color-text-muted)">sm · 0.82rem — captions, meta</div>
  <div style="font-size:var(--e-text-xs);color:var(--e-color-text-muted)">xs · 0.72rem — labels, chip counts</div>
  <div style="font-family:var(--e-font-mono);font-size:var(--e-text-base)">mono · permutations(5)[3] — carriers &amp; notation</div>
</div>

Weights: `--e-weight-normal` 400 · `medium` 500 · `semibold` 600 · `bold` 700.
Line-heights: `--e-leading-tight` 1.2 · `normal` 1.5 · `relaxed` 1.7.

## Spacing

A 4px base scale. Use these for margin, padding, and gaps rather than ad-hoc rems.

<div class="ds-space-row">
  <div><span class="ds-space" style="width:var(--e-space-1)"></span><code>1 · 0.25rem</code></div>
  <div><span class="ds-space" style="width:var(--e-space-2)"></span><code>2 · 0.5rem</code></div>
  <div><span class="ds-space" style="width:var(--e-space-3)"></span><code>3 · 0.75rem</code></div>
  <div><span class="ds-space" style="width:var(--e-space-4)"></span><code>4 · 1rem</code></div>
  <div><span class="ds-space" style="width:var(--e-space-5)"></span><code>5 · 1.5rem</code></div>
  <div><span class="ds-space" style="width:var(--e-space-6)"></span><code>6 · 2rem</code></div>
  <div><span class="ds-space" style="width:var(--e-space-7)"></span><code>7 · 3rem</code></div>
</div>

## Radii &amp; shadows

<div class="ds-live">
  <div class="ds-tile" style="border-radius:var(--e-radius-sm);background:var(--e-color-bg-soft);color:var(--e-color-text)">sm · 4px</div>
  <div class="ds-tile" style="border-radius:var(--e-radius-md);background:var(--e-color-bg-soft);color:var(--e-color-text)">md · 8px</div>
  <div class="ds-tile" style="border-radius:var(--e-radius-lg);background:var(--e-color-bg-soft);color:var(--e-color-text)">lg · 12px</div>
  <div class="ds-tile" style="border-radius:var(--e-radius-pill);background:var(--e-color-bg-soft);color:var(--e-color-text)">pill</div>
</div>
<div class="ds-live">
  <div class="ds-tile" style="background:var(--e-color-bg-elevated);color:var(--e-color-text);box-shadow:var(--e-shadow-sm)">shadow-sm</div>
  <div class="ds-tile" style="background:var(--e-color-bg-elevated);color:var(--e-color-text);box-shadow:var(--e-shadow-md)">shadow-md</div>
  <div class="ds-tile" style="background:var(--e-color-bg-elevated);color:var(--e-color-text);box-shadow:var(--e-shadow-lg)">shadow-lg</div>
</div>

Radii: `--e-radius-sm|md|lg|pill`. Shadows: `--e-shadow-sm|md|lg` (deepened automatically on dark surfaces).
Z-index runs a named scale — `--e-z-dropdown` 1000 · `sticky` 1100 · `overlay` 1200 · `modal` 1300 · `toast` 1400.

## Styling hooks — the component surface

The web components and every db-emitted SVG (`glyph_svg`) read one small public hook set — see the
[components page](/develop/packages/components/) for the roles. Resolution order is **hook → PrimeVue var → standalone
literal**, and the docs define the hooks from the semantic roles (tokens.css §3c), so the whole surface follows
the site theme by default while any host can retheme a subtree by redefining them.

`@enumeratio/components/styles.css` ships a few **standard styles** — named hook bundles applied by setting
`data-enumeratio-style="parchment | emerald | indigo | debug"` on any ancestor. `parchment` is the identity as
literals (for hosts without the token layer), `emerald`/`indigo` are the numbers-repo heritage palettes, and
`debug` is the validation style: every hook a screaming distinct color, so any surface that *doesn't* change
is a surface that missed a hook. Try them live — the panel below is the validation harness:

<ClientOnly><StyleLab /></ClientOnly>

Note the pass/fail green/red in asserts stays put under every style: functional colors are deliberately not
hooks — a restyle must never repaint success as failure.

## Usage

- **Reach for semantic tokens** (`--e-color-*`, `--e-space-*`, `--e-radius-*`), never primitives or raw hex.
- **In the explorer / PrimeVue** most theming flows through `--p-*` automatically — the primary ramp is amber
  via the Aura preset. Use `--e-*` directly only for the few bits PrimeVue doesn't cover (e.g. the `--rel-accent`
  marker). Prefer `--p-text-color` / `--p-content-border-color` for PrimeVue-adjacent chrome so it tracks Aura.
- **In docs components / prose** use the VitePress `--vp-*` vars where the default theme already styles the
  element; they resolve to the same roles.
- **Contrast:** use `-brand` / `-accent` / functional colors as fills with `-contrast` (or white) text, and the
  `-text` variants for colored type on the page. Don't color body text with a fill token.

<style>
.ds-chip { display:inline-block; width:0.95rem; height:0.95rem; border-radius:3px; vertical-align:-2px;
  margin-right:0.35rem; border:1px solid var(--e-color-border); }
.ds-marks { display:flex; gap:1.5rem; flex-wrap:wrap; margin:1rem 0; }
.ds-marks figure { margin:0; text-align:center; }
.ds-marks img { border:1px solid var(--e-color-border); border-radius:8px; padding:0.5rem; }
.ds-marks figcaption { font-size:var(--e-text-xs); color:var(--e-color-text-muted); margin-top:0.3rem; }
.ds-live { display:flex; flex-wrap:wrap; gap:0.6rem; margin:1rem 0; }
.ds-tile { flex:1 1 8rem; min-height:3.6rem; display:flex; align-items:center; justify-content:center;
  text-align:center; padding:0.6rem; border-radius:var(--e-radius-md); font-size:var(--e-text-sm);
  border:1px solid var(--e-color-border); }
.ds-type > div { margin:0.35rem 0; }
.ds-space-row { display:flex; flex-direction:column; gap:0.4rem; margin:1rem 0; }
.ds-space-row > div { display:flex; align-items:center; gap:0.6rem; }
.ds-space { display:inline-block; height:1rem; background:var(--e-color-brand); border-radius:2px; }
</style>

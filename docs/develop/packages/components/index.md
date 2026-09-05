# @enumeratio/components

Every enumeratio web component — [Lit](https://lit.dev) custom elements you can drop into any markup, in any
framework (or none). Importing the package is what registers them: `import '@enumeratio/components'` defines every
element as a side effect. Three tiers:

- **Pure figures** (`*-figure`) — data→visual leaves. No client, no db; you hand them the SVG (or geometry). Also
  reachable on their own via the `@enumeratio/components/figures` subpath, for consumers that don't want the client.
- **Client-backed** (`enumeratio-*`) — they talk to [`@enumeratio/client`](/develop/packages/client/), resolving a
  collection / element straight from the in-browser db. A Db must be provided once via the client's `provideDb()`
  (this docs site does that globally, which is why every demo here is live).
- **Testing harness** (`enumeratio-assert`, `enumeratio-assert-summary`) — wrappers that turn any demo into a
  browser unit test. This is the trick that lets these pages be *both* documentation and a test suite.

Every page below is a self-contained storybook for one element: what it's for, the attributes it takes, and live
demos — the client-backed ones wrapped in `<enumeratio-assert>`, so the demo checks itself.

## The elements

### Figures — pure, data in
A glyph is a **cast of an element into page space** (see [visual representations](/develop/contributing/visual-representations)) —
computed as an SVG string in the db (pg's `glyph_svg(<carrier>)`) and drawn verbatim by the generic renderer.

| element | draws | page |
|---|---|---|
| `<svg-figure>` | a ready-made SVG string, verbatim | [→](/develop/packages/components/svg-figure) |

### Client-backed — resolved from the db
Address a resource by `(collection, n, rank)` (or, for the expression control, by `carrier`).

| element | does | page |
|---|---|---|
| `<enumeratio-notation>` | resolves one element's rendered notation | [→](/develop/packages/components/notation) |
| `<enumeratio-figure>` | resolves an element's page-space SVG and renders it | [→](/develop/packages/components/figure) |
| `<enumeratio-expression>` | evaluates an expression in a carrier's algebra | [→](/develop/packages/components/expression) |

### Polytopes — scene space (three.js)
A collection's elements placed as the vertices of a polytope; carries the one heavier dependency, `three`.

| element | does | page |
|---|---|---|
| `<polytope-figure>` | one polytope in WebGL, emits a `select` event | [→](/develop/packages/components/polytope-figure) |
| `<polytope-overlay>` | several polytopes in one projective space | [→](/develop/packages/components/polytope-overlay) |

### Testing harness
| element | does | page |
|---|---|---|
| `<enumeratio-assert>` | wraps a component, checks its value against `expect` | [→](/develop/packages/components/assert) |
| `<enumeratio-assert-summary>` | tallies every assert on the page | [→](/develop/packages/components/assert) |

The **[expression kitchen sink](/develop/packages/components/expression-examples)** is the payoff: every worked example in
the db, live, each one an interactive full-stack unit test.

## Reporting convention

The client-backed components each emit a composed **`result`** `CustomEvent` (`{ value, error }`) whenever they
recompute, and expose a matching **`.value`** getter. That's all `<enumeratio-assert>` needs — it reads the value
generically, without knowing which component it wrapped. Host apps can lean on the same event.

## Styling hooks

Every element honors one small set of CSS custom properties, so the whole surface themes as one system (a db-emitted
SVG themes correctly too). Resolution order is **hook → PrimeVue var → standalone literal**: set a hook on any
ancestor (custom properties inherit through shadow roots) and it wins; in a PrimeVue host with no hook set, the
`--p-*` theme carries; standalone, the literal fallback holds. The docs/explorer define the hooks from the
[design tokens](/develop/contributing/design-system) (tokens.css §3c), so everything follows the site theme by default.

| hook | role | falls back through |
|---|---|---|
| `--enumeratio-accent` | primary accent — marks, fills, strokes | `--p-primary-color` → `#d97706` |
| `--enumeratio-border` | borders · gridlines · axes | `--p-content-border-color` → `currentColor` |
| `--enumeratio-muted` | muted / secondary text | `--p-text-muted-color` → `currentColor` |
| `--enumeratio-text` | body text | `--p-text-color` → `currentColor` |
| `--enumeratio-bg` | surface behind a figure (fullscreen, panels) | `--p-content-background` → `#fff` |

Functional colors (assert pass/fail green/red) are deliberately **not** hooks — a restyle must never repaint
success as failure; they ride the host theme (`--p-green-*` / `--p-red-*`) only.

**Standard styles** — `@enumeratio/components/styles.css` ships named hook bundles
(`data-enumeratio-style="parchment | emerald | indigo | debug"` on any ancestor); `debug` is the garish
validation style. Live switcher on the [design system page](/develop/contributing/design-system).

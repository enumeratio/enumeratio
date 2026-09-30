# @enumeratio/frontend

The base of notatio, the interface layer: the map from a symbol to the component that
draws it, the AST as a vdom, the control contract, the arithmetic of scrubbing and
playback, and pure SVG renderers for every plot and glyph. No UI framework of its own —
`@enumeratio/components` (the Lit custom elements) and the Vue/React wrappers here are
built on top of it. Reach for this package directly when you're writing a new renderer
or framework binding; reach for [`components`](../components/README.md) or the framework subpaths to
just use notatio in an app.

## Entry points

- `.` — the renderers (`plot.ts`, `chart.ts`, `graph.ts`, …), the control contract
  (`controls.ts`), scrubbing/playback arithmetic (`scrub.ts`, `playback.ts`), and the
  rendering-environment machinery (`environment.ts`, `reduce.ts`).
- `./symbols` — `renderingOf`: the pure map from a MathJSON head to a `Rendering` (tag +
  attributes + children). No DOM; the docs build, `<notatio-out>`, and anything else
  holding an expression read it the same way.
- `./vdom` — `structuralOf` (an expression written out verbatim as a vdom: every head a
  tag, every argument a child) and `vdomOf` (`renderingOf` with a typeset fallback);
  `toVNode` hands either to any framework's `h`.
- `./vue`, `./react` — the symbols as generated framework components (`<Plot>`,
  `<Slider>`, `<Row>`) plus `<Notatio expr="…">`, which renders an expression as its own
  vdom.
- `./generate` — generates `vue-generated.ts` / `react-generated.ts` from the element
  sources; the docs site's build calls this so the wrapper components exist for the
  theme.
- `./declare-carriers` — `declareFrontendCarriers(ce)`: this package's own carrier
  (`GlyphKind`), for a host assembling every carrier it ships.
- `./reflect`, `./conventional-latex` — reading element sources for their attributes;
  LaTeX for symbols with no dedicated renderer.

## Naming and rendering

A symbol and its component are the same thing seen from two ends: kebab-case the head
and prefix `notatio-` (`Plot3D` → `notatio-plot-3d`). A family head (`Chart`) leaves a
discriminating attribute unset and lets the component choose among the members it
draws.

```ts
import { structuralOf, tagOf, toVNode } from "@enumeratio/frontend/vdom";

tagOf("Plot3D"); // "notatio-plot-3d"
toVNode(structuralOf(["Add", "x", 1]), h); // { tag: "notatio-add", attributes: {}, children: [...] }
```

## Rendering environments

`reduce(expr, env)` closes the gap between what an expression asks for (a live slider, a
GPU plot) and what the place it lands can do: a control with nothing to drive it is
pinned or sampled into small multiples, a GPU-only plot rasterizes on a surface without
one, a `Row` in a narrow column stacks. It runs before `structuralOf`/`vdomOf`, so every
backend downstream — Vue, React, the plain elements — sees the same reduced tree. See
[Rendering Environments](https://github.com/enumeratio/enumeratio/wiki/Rendering-Environments).

## Where to go next

- [`components`](../components/README.md) — the Lit custom elements built on this package.
- [`/reference/component/`](https://enumeratio.dev/reference/component/) — every drawing symbol as a component,
  generated from these same sources.
- [Components and Symbols](https://github.com/enumeratio/enumeratio/wiki/Components-and-Symbols) — the design
  behind the symbol/component map.
- [Vdom](https://github.com/enumeratio/enumeratio/wiki/Vdom) — the AST-as-vdom design.

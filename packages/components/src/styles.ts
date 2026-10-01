// These elements render in light DOM (MathLive's static markup needs the page's
// `mathlive/static.css`), so their styles live in one document-level stylesheet
// injected on first use rather than per-shadow-root.

import { ensureCopyHandler } from "./selection.ts";

let injected = false;

const CSS = `
notatio-in, notatio-out, notatio-cell { display: block; }
notatio-tex { display: inline; }
notatio-tex[display] {
  display: block;
  text-align: center;
  margin: 1.1rem 0;
  overflow-x: auto;
  overflow-y: hidden;
}

/* Glyphs are inline, sized to the line; the SVG carries a viewBox, no width. */
notatio-figure { display: inline-block; vertical-align: middle; line-height: 0; }
notatio-figure svg { height: 2.5em; width: auto; max-width: 100%; overflow: visible; }
notatio-figure[kind="diagram"] svg { height: 3.6em; }

/* Plots are block figures sized to a max width; the viewBox drives the ratio. */
notatio-plot, notatio-plot-3d { display: block; line-height: 0; }
notatio-plot .notatio-plot-box,
notatio-plot-3d .notatio-plot-box { display: inline-block; max-width: 100%; }
notatio-plot svg { width: 340px; max-width: 100%; height: auto; overflow: hidden; }
notatio-plot-3d svg { width: 360px; max-width: 100%; height: auto; overflow: visible; }

/* Charts (BarChart, Histogram, PieChart, …) share the same sizing as Plot. */
notatio-chart { display: block; line-height: 0; }
notatio-chart .notatio-chart-box { display: inline-block; max-width: 100%; }
notatio-chart svg { width: 340px; max-width: 100%; height: auto; overflow: hidden; }

/* ContourPlot shares Plot's sizing -- a bare 2-D frame, no fixed width. */
notatio-contour-plot { display: block; line-height: 0; }
notatio-contour-plot .notatio-contour-plot-box { display: inline-block; max-width: 100%; }
notatio-contour-plot svg { width: 340px; max-width: 100%; height: auto; overflow: hidden; }

/* Field & density visualisations (VectorPlot, StreamPlot, PolarPlot, DensityPlot). */
notatio-vector-plot { display: block; line-height: 0; }
notatio-vector-plot .notatio-vector-plot-box { display: inline-block; max-width: 100%; }
notatio-vector-plot svg { width: 340px; max-width: 100%; height: auto; overflow: hidden; }

notatio-density-plot { display: block; line-height: 0; }
notatio-density-plot .notatio-density-plot-box { display: inline-block; max-width: 100%; }
notatio-density-plot svg { width: 340px; max-width: 100%; height: auto; overflow: hidden; }

notatio-polar-plot { display: block; line-height: 0; }
notatio-polar-plot .notatio-polar-plot-box { display: inline-block; max-width: 100%; }
notatio-polar-plot svg { width: 260px; max-width: 100%; height: auto; overflow: hidden; }

/* 3-D list plots & bar charts share Plot3D's sizing -- a projected figure whose
   axis labels can sit just outside the viewBox. */
notatio-list-plot-3d { display: block; line-height: 0; }
notatio-list-plot-3d .notatio-list-plot-3d-box { display: inline-block; max-width: 100%; }
notatio-list-plot-3d svg { width: 360px; max-width: 100%; height: auto; overflow: visible; }

notatio-bar-chart-3d { display: block; line-height: 0; }
notatio-bar-chart-3d .notatio-bar-chart-3d-box { display: inline-block; max-width: 100%; }
notatio-bar-chart-3d svg { width: 360px; max-width: 100%; height: auto; overflow: visible; }

/* A polytope's face poset. Every mark is a face and every face is clickable, so the marks
   need a pointer; the hover tint is the only feedback before a click lands. */
notatio-polytope { display: block; line-height: 0; }
notatio-polytope .notatio-polytope-box { display: inline-block; max-width: 100%; }
notatio-polytope svg { width: 360px; max-width: 100%; height: auto; overflow: visible; }
notatio-polytope .notatio-polytope-box { cursor: grab; touch-action: none; user-select: none; }
notatio-polytope .notatio-polytope-box:active { cursor: grabbing; }
notatio-polytope polygon[data-face]:hover { fill-opacity: 0.25; }
notatio-polytope line[data-face]:hover { stroke-width: 2.5; }
notatio-polytope circle[data-face]:hover { r: 3.5; }

/* Graph & hierarchical layouts (TreePlot, GraphPlot, LayeredGraphPlot, Dendrogram). */
notatio-graph-plot { display: block; line-height: 0; }
notatio-graph-plot .notatio-graph-plot-box { display: inline-block; max-width: 100%; }
notatio-graph-plot svg { width: 340px; max-width: 100%; height: auto; overflow: visible; }

notatio-in math-field {
  width: 100%;
  font-size: 1.1rem;
  /* --vp-* / --notatio-* custom properties keep the editor theme-aware. */
  color: var(--notatio-fg, var(--vp-c-text-1, inherit));
  background: var(--notatio-bg, var(--vp-c-bg-soft, transparent));
  border: 1px solid var(--notatio-border, var(--vp-c-divider, #d4d4d8));
  border-radius: 8px;
  padding: 0.4rem 0.6rem;
}
/* The field and its head control form one input group: no gap, one shared seam. */
.notatio-in-row { display: flex; align-items: stretch; position: relative; }
.notatio-in-row math-field {
  flex: 1;
  min-width: 0;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}
/* The head as a control: quiet until applied, then it reads as engaged. It sits on the
   field's own border -- the shared edge is drawn once, by the button. */
.notatio-head-btn,
.notatio-head-caret {
  flex: 0 0 auto;
  margin-left: -1px;
  padding: 0 0.5rem;
  border: 1px solid var(--notatio-border, var(--vp-c-divider, #d4d4d8));
  background: var(--notatio-bg, var(--vp-c-bg-soft, transparent));
  color: var(--vp-c-text-3, #888);
  font-family: var(--notatio-mono, ui-monospace, monospace);
  font-size: 0.78rem;
  line-height: 1.4;
  cursor: pointer;
  user-select: none;
  list-style: none;
}
.notatio-head-btn:hover,
.notatio-head-caret:hover { color: var(--vp-c-brand-1, #3451b2); }
.notatio-head-btn[aria-pressed="true"] {
  z-index: 1; /* the applied border wins the seam it shares with the field */
  border-color: var(--vp-c-brand-1, #3451b2);
  color: var(--vp-c-brand-1, #3451b2);
  background: var(--vp-c-brand-soft, var(--vp-c-bg-soft, #f2f2f2));
}
/* The menu caps the group; its disclosure triangle is the caret itself. */
.notatio-head-menu { position: relative; display: flex; }
.notatio-head-caret {
  display: flex;
  align-items: center;
  padding: 0 0.4rem;
  border-radius: 0 8px 8px 0;
}
.notatio-head-caret::after { content: "▾"; }
.notatio-head-caret::-webkit-details-marker { display: none; }
.notatio-head-menu[open] .notatio-head-caret { color: var(--vp-c-brand-1, #3451b2); }
.notatio-head-menu .notatio-menu-list { top: 100%; min-width: 9rem; }

/* Hide the toolbar toggles; the context menu is still available on right-click. */
notatio-in math-field::part(virtual-keyboard-toggle),
notatio-in math-field::part(menu-toggle) { display: none; }

.notatio-row { display: flex; align-items: baseline; gap: 0.5rem; margin: 0.25rem 0; }
.notatio-label {
  font-family: var(--notatio-mono, ui-monospace, monospace);
  font-size: 0.75rem;
  color: var(--vp-c-text-3, #888);
  min-width: 2.5rem;
  user-select: none;
}
.notatio-out-label { color: var(--vp-c-brand-1, #b3355a); }
.notatio-error { color: var(--vp-c-danger-1, #c0392b); font-family: var(--notatio-mono, monospace); }

.notatio-render { display: inline-block; }

.notatio-form-src {
  font-family: var(--notatio-mono, ui-monospace, monospace);
  font-size: 0.85rem;
  white-space: pre-wrap;
  word-break: break-word;
}

/* <notatio-notebook>: a variable-centric (desmos-like) session. Ordinals are
   incidental handles on the left; each cell's value/binding shows below it. */
notatio-notebook { display: block; }
/* Reactive handles are a pure display index: a CSS counter over the cells in DOM
   order, so a reorder renumbers them with no JS (they reference nothing). */
.notatio-notebook { counter-reset: nb-cell; }
.notatio-notebook .nb-cell { counter-increment: nb-cell; }
.notatio-notebook .nb-ordinal::before { content: counter(nb-cell); }
.notatio-notebook .nb-cell {
  margin: 0.15rem 0;
  padding: 0.35rem 0.5rem;
  border-left: 2px solid transparent;
  border-radius: 4px;
}
.notatio-notebook .nb-cell:hover { background: var(--vp-c-bg-soft, #f6f6f7); }
.notatio-notebook .nb-cell:hover { border-left-color: var(--vp-c-divider, #e2e2e2); }
.nb-in { display: flex; align-items: baseline; gap: 0.6rem; }
.nb-ordinal {
  flex: 0 0 auto;
  min-width: 1.4rem;
  text-align: right;
  font-family: var(--notatio-mono, ui-monospace, monospace);
  font-size: 0.72rem;
  color: var(--vp-c-text-3, #aaa);
  user-select: none;
  cursor: default;
}
.nb-in notatio-in { flex: 1 1 auto; }
/* Reactive drag-to-reorder: the ordinal is the grab handle; the drop target
   shows an inset line at its top edge (the dragged cell inserts before it). */
.nb-handle { cursor: grab; }
.nb-handle:active { cursor: grabbing; }
.nb-cell.nb-dragging { opacity: 0.4; }
.nb-cell.nb-drop-before { box-shadow: inset 0 2px 0 0 var(--vp-c-brand-1, #b3355a); }
.nb-remove {
  flex: 0 0 auto;
  padding: 0 0.35rem;
  border: 0;
  background: none;
  color: var(--vp-c-text-3, #aaa);
  font-size: 0.8rem;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.12s;
}
.notatio-notebook .nb-cell:hover .nb-remove { opacity: 1; }
.nb-remove:hover { color: var(--vp-c-danger-1, #c0392b); }
/* The output/binding line, indented under the input to sit past the ordinal. */
.nb-out {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  margin: 0.2rem 0 0 2rem;
  min-height: 1.2em;
}
.nb-bind {
  font-family: var(--notatio-mono, ui-monospace, monospace);
  font-size: 0.85rem;
  color: var(--vp-c-brand-1, #b3355a);
  user-select: none;
}
/* <notatio-code>: a small source box with a language tag. */
notatio-code { display: inline-block; vertical-align: middle; max-width: 100%; }
.notatio-code {
  position: relative;
  display: inline-block;
  max-width: 100%;
  border: 1px solid var(--notatio-border, var(--vp-c-divider, #d4d4d8));
  border-radius: 6px;
  background: var(--notatio-bg, var(--vp-c-bg-soft, #f6f6f7));
}
.notatio-code pre {
  margin: 0;
  /* Right padding reserves room for the absolutely-positioned language tag. */
  padding: 0.35rem 3.2rem 0.35rem 0.55rem;
  /* A whole shader is a few hundred lines; scroll it rather than take the page. */
  max-height: 24rem;
  overflow: auto;
  font-family: var(--notatio-mono, ui-monospace, monospace);
  font-size: 0.85rem;
  line-height: 1.4;
}
.notatio-code:not([data-lang]) pre,
.notatio-code[data-lang=""] pre { padding-right: 0.55rem; }
/* Syntax highlighting tokens (highlight.ts) -- theme-neutral, readable on the
   soft code background in both light and dark. */
.notatio-code .tok-fn { color: var(--notatio-accent, var(--vp-c-brand-1, #6b5bff)); }
.notatio-code .tok-num { color: #b5852a; }
.notatio-code .tok-str { color: #2f8a3e; }
.notatio-code .tok-op { color: var(--vp-c-text-2, #666); }
.notatio-code .tok-punct { color: var(--vp-c-text-3, #999); }
.notatio-code textarea {
  display: block;
  width: 100%;
  min-width: 16rem;
  box-sizing: border-box;
  padding: 0.35rem 0.55rem;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--notatio-fg, var(--vp-c-text-1, inherit));
  font-family: var(--notatio-mono, ui-monospace, monospace);
  font-size: 0.85rem;
  line-height: 1.4;
  resize: vertical;
}
.notatio-code textarea:focus { outline: 2px solid var(--vp-c-brand-1, #3451b2); outline-offset: -1px; }
.notatio-code-lang {
  position: absolute;
  top: 0;
  right: 0;
  padding: 0.05rem 0.4rem;
  border-bottom-left-radius: 6px;
  /* Light mode: very translucent dark wash, dark text, lighter outline. */
  background: rgba(0, 0, 0, 0.03);
  color: var(--vp-c-text-1, #333);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-top: 0;
  border-right: 0;
  font-family: var(--notatio-mono, ui-monospace, monospace);
  font-size: 0.65rem;
  text-transform: lowercase;
  user-select: none;
}
/* Dark mode: flip -- translucent light wash, light text, darker outline. */
:where(html.dark, [data-theme="dark"]) .notatio-code-lang {
  background: rgba(255, 255, 255, 0.05);
  color: var(--vp-c-text-1, #ddd);
  border-color: rgba(0, 0, 0, 0.3);
}
/* No language tag -> the pre needs no room reserved for it. */
.notatio-code.no-lang pre { padding-right: 0.55rem; }

/* TreeForm: an expression as a tree of heads, one disclosure per application. */
.notatio-tree {
  font-family: var(--notatio-mono, ui-monospace, monospace);
  font-size: 0.85rem;
  line-height: 1.5;
}
/* The tree takes the row's width so closed summaries clip instead of stretching the line. */
notatio-out[form="tree"] .notatio-render { display: block; flex: 1 1 0; min-width: 0; }
.notatio-tree-node { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0 0.35rem; min-width: 0; }
.notatio-tree-node.is-leaf { padding-left: 1.1rem; }
.notatio-tree-toggle {
  width: 1.1rem;
  padding: 0;
  border: 0;
  background: none;
  color: var(--vp-c-text-3, #999);
  font: inherit;
  text-align: left;
  cursor: pointer;
  user-select: none;
}
.notatio-tree-toggle:hover { color: var(--vp-c-brand-1, #3451b2); }
.notatio-tree-head { font-weight: 600; color: var(--notatio-accent, var(--vp-c-brand-1, #6b5bff)); }
a.notatio-tree-head { text-decoration: underline dotted; text-underline-offset: 3px; }
/* Unfold (≝) steps a head into its definition; the origin badge on the result folds it back. */
.notatio-tree-unfold,
.notatio-tree-origin {
  padding: 0 0.3rem;
  border: 1px solid var(--vp-c-divider, #d4d4d8);
  border-radius: 4px;
  background: none;
  color: var(--vp-c-text-3, #999);
  font: inherit;
  font-size: 0.75em;
  line-height: 1.4;
  cursor: pointer;
  user-select: none;
}
.notatio-tree-unfold:hover,
.notatio-tree-origin:hover { color: var(--vp-c-brand-1, #3451b2); border-color: currentColor; }
.notatio-tree-origin { color: var(--vp-c-brand-1, #6b5bff); border-style: dashed; }
/* A head on the primitive frontier, tagged with why it does not reduce. */
.notatio-tree-primitive {
  padding: 0 0.35rem;
  border-radius: 999px;
  background: rgba(217, 147, 26, 0.14);
  color: #b7791f;
  font-size: 0.7em;
}
/* The closed node's arguments, as one line of InputForm that clips rather than wraps. */
.notatio-tree-summary {
  flex: 1 1 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--vp-c-text-2, #666);
}
.notatio-tree-children {
  flex-basis: 100%;
  min-width: 0;
  max-width: 100%;
  margin-left: 0.45rem;
  padding-left: 0.65rem;
  border-left: 1px solid var(--vp-c-divider, #d4d4d8);
}
.notatio-tree-leaf.tok-num { color: #b5852a; }
.notatio-tree-leaf.tok-str { color: #2f8a3e; }
.notatio-tree-summary .tok-fn { color: var(--notatio-accent, var(--vp-c-brand-1, #6b5bff)); }
.notatio-tree-summary .tok-num { color: #b5852a; }
.notatio-tree-summary .tok-str { color: #2f8a3e; }
.notatio-tree-summary .tok-punct { color: var(--vp-c-text-3, #999); }

/* In/Out row: the label dropdown trigger and the rendered value on one line. */
.notatio-line { display: flex; align-items: baseline; gap: 0.5rem; }
/* Plain, unselectable In/Out label on the left of the row. */
.notatio-io-label {
  font-family: var(--notatio-mono, ui-monospace, monospace);
  font-size: 0.75rem;
  color: var(--vp-c-text-3, #888);
  user-select: none;
}
/* The form selector floats to the right of the value. */
.notatio-menu { position: relative; margin-left: auto; }
/* The trigger shows the current form and reads as a plain clickable label. */
.notatio-menu-btn {
  display: inline-block;
  padding: 0;
  border: 0;
  background: none;
  color: var(--vp-c-text-3, #888);
  font-family: var(--notatio-mono, ui-monospace, monospace);
  font-size: 0.72rem;
  cursor: pointer;
  user-select: none;
  list-style: none;
  text-decoration: underline dotted var(--vp-c-divider, #bbb);
  text-underline-offset: 3px;
  white-space: nowrap;
}
.notatio-menu-btn::after {
  content: "▾";
  margin-left: 0.2rem;
  font-size: 0.85em;
}
.notatio-menu-btn:hover,
.notatio-menu[open] .notatio-menu-btn {
  color: var(--vp-c-brand-1, #3451b2);
  text-decoration-color: currentColor;
}
.notatio-menu-btn::-webkit-details-marker { display: none; }
.notatio-menu-list {
  position: absolute;
  right: 0;
  z-index: 10;
  margin-top: 0.15rem;
  min-width: 10rem;
  padding: 0.25rem;
  border: 1px solid var(--vp-c-divider, #d4d4d8);
  border-radius: 8px;
  background: var(--vp-c-bg, #fff);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);
}
.notatio-menu-list button {
  display: block;
  width: 100%;
  padding: 0.25rem 0.5rem;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--vp-c-text-1, inherit);
  font-size: 0.8rem;
  text-align: left;
  cursor: pointer;
}
.notatio-menu-list button:hover { background: var(--vp-c-bg-soft, #f2f2f2); }
.notatio-menu-list button.is-current { color: var(--vp-c-brand-1, #3451b2); font-weight: 600; }
.notatio-menu-list hr { margin: 0.25rem 0; border: 0; border-top: 1px solid var(--vp-c-divider, #eee); }
/* Diagnostics sit on their own line under the row. */
.notatio-assert-fail, .notatio-assert-diag {
  display: block;
  margin: 0.3rem 0 0;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  font-family: var(--notatio-mono, monospace);
  font-size: 0.8rem;
}
.notatio-assert-fail {
  background: var(--notatio-fail-bg, rgba(192, 57, 43, 0.12));
  color: var(--vp-c-danger-1, #c0392b);
}
.notatio-assert-diag {
  background: var(--notatio-diag-bg, rgba(217, 147, 26, 0.14));
  color: var(--notatio-diag, #b7791f);
}

/* Manipulate-style parameter controls under a plot (self-contained block). */
.notatio-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1rem;
  margin: 0.35rem 0 0;
  max-width: 340px;
  line-height: 1.4;
}
.notatio-control { display: flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; }
.notatio-control-name {
  font-family: var(--notatio-mono, ui-monospace, monospace);
  font-style: italic;
  color: var(--notatio-fg, var(--vp-c-text-2, #666));
  min-width: 1.2em;
}
.notatio-control input[type="range"] { flex: 1; min-width: 6rem; accent-color: var(--notatio-accent, var(--vp-c-brand-1, #d97706)); }
.notatio-play {
  flex: 0 0 auto;
  width: 1.4em;
  height: 1.4em;
  padding: 0;
  border: 1px solid var(--notatio-border, var(--vp-c-divider, #d4d4d8));
  border-radius: 50%;
  background: var(--notatio-bg, var(--vp-c-bg-soft, transparent));
  color: var(--notatio-accent, var(--vp-c-brand-1, #d97706));
  font-size: 0.6rem;
  line-height: 1;
  cursor: pointer;
}
.notatio-play:hover { border-color: var(--notatio-accent, var(--vp-c-brand-1, #d97706)); }
/* 3-D toolbar: a small spin (auto-rotate) toggle under the figure. */
.notatio-toolbar { margin: 0.3rem 0 0; }
/* An icon button: a glyph in a square, not a word in a lozenge. The label lives in
   aria-label, so the control stays legible to a screen reader without the text
   fighting the padding for space. */
.notatio-spin {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.6rem;
  height: 1.6rem;
  padding: 0;
  border: 1px solid var(--notatio-border, var(--vp-c-divider, #d4d4d8));
  border-radius: 6px;
  background: var(--notatio-bg, var(--vp-c-bg-soft, transparent));
  color: var(--vp-c-text-2, #666);
  font-size: 0.85rem;
  line-height: 1;
  cursor: pointer;
  user-select: none;
}
.notatio-spin:hover { border-color: var(--notatio-accent, var(--vp-c-brand-1, #d97706)); }
.notatio-spin.is-on {
  color: var(--notatio-accent, var(--vp-c-brand-1, #d97706));
  border-color: var(--notatio-accent, var(--vp-c-brand-1, #d97706));
}
.notatio-control select {
  font-family: var(--notatio-mono, ui-monospace, monospace);
  font-size: 0.8rem;
  background: var(--notatio-bg, var(--vp-c-bg-soft, transparent));
  color: var(--notatio-fg, var(--vp-c-text-1, inherit));
  border: 1px solid var(--notatio-border, var(--vp-c-divider, #d4d4d8));
  border-radius: 4px;
}
.notatio-control-val {
  font-family: var(--notatio-mono, ui-monospace, monospace);
  color: var(--vp-c-text-3, #888);
  min-width: 2.5em;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.notatio-control-fps {
  margin-left: auto;
  font-family: var(--notatio-mono, ui-monospace, monospace);
  font-size: 0.75rem;
  color: var(--vp-c-brand-1, #3451b2);
  font-variant-numeric: tabular-nums;
}

.notatio-complex-plot-bare {
  border: none;
  background: none;
}
.notatio-complex-plot-bare .notatio-complex-plot-stage {
  border-radius: 8px;
  overflow: hidden;
}
.notatio-complex-plot-bare .notatio-complex-plot-foot {
  border-top: none;
  justify-content: flex-end;
  padding: 0.25rem 0 0;
}

/* The custom element itself, not just the div inside it. An unknown element is inline
   by default, and as a flex item it would then be sized by its contents -- which, with
   the inline-size containment below, are sized by *it*. That circle resolves to zero. */
/* A curve in space. The host element carries no size of its own, so without this the
   plot box stays inline and the figure collapses to whatever the SVG's intrinsic size
   happens to be -- about a fifth of the room it has. */
notatio-curve-3d {
  display: block;
  width: 100%;
}
.notatio-curve-3d {
  margin: 0.75rem 0;
  text-align: center;
}
.notatio-curve-3d .notatio-plot-box {
  display: block;
  cursor: grab;
  touch-action: none;
  user-select: none;
}
.notatio-curve-3d .notatio-plot-box:active {
  cursor: grabbing;
}
.notatio-curve-3d svg {
  width: 100%;
  height: auto;
  max-width: 30rem;
}
.notatio-curve-3d figcaption {
  font-size: 0.8rem;
  color: var(--vp-c-text-3, #999);
  padding-top: 0.2rem;
}

/* The torus's fundamental square. */
notatio-torus-square { display: block; line-height: 0; }
notatio-torus-square .notatio-torus-square-box { display: inline-block; max-width: 100%; }
notatio-torus-square svg { width: 360px; max-width: 100%; height: auto; overflow: visible; }

/* The shared-clock control: a play button, a scrubber and a readout on one line. */
notatio-clock {
  display: inline-block;
  line-height: normal;
}
.notatio-clock-box {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
}
.notatio-clock-play {
  min-width: 2.1em;
  padding: 0.15em 0.5em;
  border: 1px solid var(--vp-c-divider, #ddd);
  border-radius: 5px;
  background: var(--vp-c-bg-soft, #f6f6f6);
  color: inherit;
  font: inherit;
  line-height: 1.4;
  cursor: pointer;
}
.notatio-clock-scrub {
  width: 9rem;
  accent-color: var(--notatio-accent, #b8860b);
}
.notatio-clock-readout {
  color: var(--vp-c-text-3, #999);
  font-variant-numeric: tabular-nums;
  min-width: 3em;
}

notatio-worksheet {
  display: block;
  width: 100%;
  /* The worksheet, not the viewport, decides whether there is room for two columns:
     it is often laid out inside something much narrower than the window, and keying
     a media query off the viewport collapsed the screen column to nothing. */
  container-type: inline-size;
}

notatio-worksheet {
  display: block;
  margin: 1.25rem 0;
}
.ws-body {
  display: grid;
  gap: 1rem;
  align-items: start;
  grid-template-columns: minmax(0, 1fr);
}
@container (min-width: 46rem) {
  .notatio-worksheet[data-screen="side"] .ws-body,
  .notatio-worksheet[data-screen="auto"] .ws-body {
    grid-template-columns: minmax(16rem, 20rem) minmax(0, 1fr);
  }
}
.notatio-worksheet[data-screen="side"] .ws-body {
  grid-template-columns: minmax(16rem, 20rem) minmax(0, 1fr);
}
.notatio-worksheet[data-screen="below"] .ws-body {
  grid-template-columns: minmax(0, 1fr);
}

.ws-toolbar {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0 0 0.5rem;
}
.ws-toolbar button {
  border: 1px solid var(--vp-c-divider, #ddd);
  background: var(--vp-c-bg, #fff);
  color: var(--vp-c-text-2, #666);
  font-size: 0.75rem;
  line-height: 1.4;
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
  cursor: pointer;
}
.ws-toolbar button:hover {
  color: var(--vp-c-brand-1, #3451b2);
}
.ws-toolbar-spacer {
  flex: 1;
}

.ws-cells {
  display: grid;
  gap: 0.3rem;
  align-content: start;
}
.ws-cell {
  border: 1px solid var(--vp-c-divider, #ddd);
  border-radius: 8px;
  padding: 0.3rem 0.45rem;
  background: var(--vp-c-bg-soft, #f6f6f7);
  /* A cell may hold something very wide -- a data URI is thousands of characters --
     and it must not drag the worksheet's width out with it. */
  min-width: 0;
  overflow: hidden;
}
.ws-dragging {
  opacity: 0.5;
}
.ws-drop-before {
  border-top-color: var(--vp-c-brand-1, #3451b2);
}
.ws-in {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}
.ws-in notatio-in {
  flex: 1;
  min-width: 0;
  overflow-x: auto;
}

/* The gutter is a fixed-size box so its contents can change without the row moving,
   and doubles as the drag handle -- the empty part of it is still grabbable. */
.ws-gutter {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 2.6rem;
  gap: 0.15rem;
  align-self: stretch;
  min-height: 1.6rem;
  cursor: grab;
}
.ws-gutter:active {
  cursor: grabbing;
}
.ws-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  padding: 0;
  border: none;
  background: none;
  border-radius: 4px;
  font-size: 0.8rem;
  line-height: 1;
}
.ws-toggle,
.ws-play {
  cursor: pointer;
  color: var(--vp-c-brand-1, #3451b2);
}
.ws-toggle:hover,
.ws-play:hover {
  background: var(--vp-c-default-soft, rgba(100, 100, 100, 0.12));
}
.ws-off {
  color: var(--vp-c-text-3, #999);
}
.ws-playing {
  color: var(--vp-c-brand-1, #3451b2);
}
.ws-static {
  color: var(--vp-c-text-3, #bbb);
  cursor: inherit;
}

/* The ordinal a cell has by position. Fixed width so the mark beside it never shifts. */
.ws-ordinal {
  min-width: 1.1em;
  font-family: var(--notatio-mono, ui-monospace, monospace);
  font-size: 0.65rem;
  color: var(--vp-c-text-3, #bbb);
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.ws-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.ws-part {
  font-family: var(--notatio-mono, ui-monospace, monospace);
  font-size: 0.7rem;
  color: var(--vp-c-text-3, #999);
  min-width: 1.4em;
}
.ws-knob {
  padding: 0.15rem 0 0 2.85rem;
}
.ws-knob .ws-slider {
  padding-left: 0;
}
/* The endpoints, small and quiet: they are there to be argued with, not read. */
.ws-bounds {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding-top: 0.1rem;
}
.ws-bound {
  width: 3.4rem;
  padding: 0 0.2rem;
  font-family: var(--notatio-mono, ui-monospace, monospace);
  font-size: 0.65rem;
  color: var(--vp-c-text-3, #999);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
}
.ws-bound:hover,
.ws-bound:focus {
  border-color: var(--vp-c-divider, #ddd);
  color: var(--vp-c-text-2, #666);
}
.ws-bound-sep,
.ws-bound-auto {
  font-size: 0.62rem;
  color: var(--vp-c-text-3, #bbb);
}
.ws-bound-auto {
  border: none;
  background: none;
  cursor: pointer;
  padding: 0 0.2rem;
}
.ws-bound-auto:hover {
  color: var(--vp-c-brand-1, #3451b2);
}

.ws-slider {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.15rem 0 0 1.85rem;
}
.ws-slider input[type="range"] {
  flex: 1;
  accent-color: var(--vp-c-brand-1, #3451b2);
}
.ws-slider-val {
  font-family: var(--notatio-mono, ui-monospace, monospace);
  font-size: 0.75rem;
  color: var(--vp-c-brand-1, #3451b2);
  font-variant-numeric: tabular-nums;
  min-width: 3em;
  text-align: right;
}

/* Results align right, so a column of them reads down the edge. */
.ws-out {
  display: flex;
  align-items: baseline;
  justify-content: flex-end;
  overflow-x: auto;
  gap: 0.4rem;
  padding: 0.15rem 0 0 1.85rem;
  font-size: 0.9rem;
}
.ws-elided {
  color: var(--vp-c-text-3, #999);
  font-size: 0.8rem;
  font-style: italic;
}
.ws-bind {
  color: var(--vp-c-text-3, #888);
  font-family: var(--notatio-mono, ui-monospace, monospace);
  font-size: 0.8rem;
}
.ws-diag {
  padding: 0.15rem 0 0 1.85rem;
  font-size: 0.8rem;
}

/* One screen, not a pane each: layers occupy the same box and stack. The ground is the
   page's, not a dark field -- a domain colouring paints its own, and a curve drawn over
   a black screen is a curve nobody can see. */
/* The stage wraps the screen so the fold control can sit on its outer border: the
   bottom edge when the screen is below the cells, the right edge when beside them. */
.ws-stage {
  position: relative;
  min-width: 0;
}
/* A grip along the screen's lower edge. Kept clear of the fold tab in the middle. */
.ws-grip {
  position: absolute;
  left: 0;
  right: 0;
  bottom: -3px;
  height: 7px;
  cursor: ns-resize;
  touch-action: none;
  z-index: 4;
}
.ws-grip:hover {
  background: linear-gradient(
    to bottom,
    transparent,
    var(--vp-c-divider, #ddd) 45%,
    var(--vp-c-divider, #ddd) 55%,
    transparent
  );
}

.ws-fold {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--vp-c-divider, #ddd);
  background: var(--vp-c-bg, #fff);
  color: var(--vp-c-text-3, #999);
  cursor: pointer;
  padding: 0;
  font-size: 0.65rem;
  line-height: 1;
  z-index: 5;
}
.ws-fold:hover {
  color: var(--vp-c-brand-1, #3451b2);
}
/* Below the cells: a tab centred on the bottom edge. */
.ws-stage[data-side="false"] .ws-fold {
  left: 50%;
  bottom: -1px;
  transform: translateX(-50%);
  width: 2.4rem;
  height: 0.95rem;
  border-radius: 0 0 6px 6px;
  border-top: none;
}
/* Beside the cells: the same tab on the right edge. */
.ws-stage[data-side="true"] .ws-fold {
  top: 50%;
  right: -1px;
  transform: translateY(-50%);
  width: 0.95rem;
  height: 2.4rem;
  border-radius: 0 6px 6px 0;
  border-left: none;
}
/* Folded away, the control is all that is left, so give it somewhere to sit. */
.ws-stage:has(.ws-screen[hidden]) {
  min-height: 0.95rem;
}
.ws-stage[data-side="true"]:has(.ws-screen[hidden]) {
  min-height: 2.4rem;
}

.ws-screen {
  position: relative;
  min-width: 0;
  border: 1px solid var(--vp-c-divider, #ddd);
  border-radius: 10px;
  overflow: hidden;
  background: var(--vp-c-bg, #fff);
}
.ws-layer {
  position: absolute;
  inset: 0;
}
.ws-layer > * {
  width: 100%;
  height: 100%;
}
.ws-layer .notatio-complex-plot,
.ws-layer .notatio-complex-plot-stage {
  margin: 0;
  height: 100%;
}
/* A layer is part of one picture, not a figure of its own: its own chrome would be
   repeated furniture over the top of the stack. */
.ws-layer .notatio-toolbar {
  display: none;
}
/* A layer stacked OVER another must not swallow the pointer events meant for it: a vector
   field drawn on top of a density plot is decoration, and the plot underneath owns the
   gesture. Only the layers above the first, though -- making every layer inert took the drag
   away from figures that are a lone layer, which is most of them. */
.ws-layer:not(:first-child) .notatio-plot-box,
.ws-layer:not(:first-child) svg {
  pointer-events: none;
}

.notatio-complex-plot {
  margin: 0;
}

.notatio-complex-plot {
  margin: 1.25rem 0;
  border: 1px solid var(--vp-c-divider, #ddd);
  border-radius: 10px;
  overflow: hidden;
  background: var(--vp-c-bg-soft, #f6f6f7);
}
.notatio-complex-plot-stage {
  position: relative;
  background: #05080a;
}
.notatio-complex-plot-stage canvas {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
  cursor: grab;
}
.notatio-complex-plot-stage canvas:active {
  cursor: grabbing;
}
.notatio-complex-plot-status {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  margin: 0;
  padding: 2rem;
  text-align: center;
  color: #cbd5e1;
  font-size: 0.9rem;
}
.notatio-complex-plot-foot {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 0.9rem;
  font-size: 0.75rem;
  color: var(--vp-c-text-3, #888);
  border-top: 1px solid var(--vp-c-divider, #ddd);
}
.notatio-complex-plot-foot span:first-child {
  flex: 1;
  min-width: 0;
}
.notatio-complex-plot-foot button {
  border: 1px solid var(--vp-c-divider, #ddd);
  background: var(--vp-c-bg, #fff);
  color: var(--vp-c-text-2, #666);
  font-size: 0.75rem;
  padding: 0.25rem 0.6rem;
  border-radius: 7px;
  cursor: pointer;
}
.notatio-complex-plot-fps {
  font-family: var(--notatio-mono, ui-monospace, monospace);
  color: var(--vp-c-brand-1, #3451b2);
  font-variant-numeric: tabular-nums;
}

/* --- Tangle: inline reactive prose ------------------------------------------------
   The controls sit INSIDE a sentence, so everything here is inline and must not
   disturb the line: no padding that changes the leading, no border that reserves
   width, and the hover arrows are positioned out of flow so nothing reflows when
   they appear. */
/* A tangle wraps prose -- paragraphs, figures, whole sections -- so it is a block.
   A conditional is a PHRASE inside a sentence and must contribute no box at all;
   display:contents is what keeps it in the line it was written in. */
notatio-tangle { display: block; }
notatio-when { display: contents; }
notatio-when[hidden] { display: none; }
notatio-dynamic { display: inline; }
notatio-dynamic[display] { display: block; text-align: center; margin: 1.1rem 0; }
notatio-knob, notatio-toggler { display: inline; }

.notatio-knob-grip,
.notatio-toggler-grip {
  position: relative;
  display: inline-block;
  border: 0;
  padding: 0;
  font: inherit;
  color: var(--vp-c-brand-1, #3451b2);
  background: none;
  border-bottom: 1px dashed currentColor;
  /* A drag that selects the sentence instead of moving the value is the one failure
     mode readers never recover from. */
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  touch-action: none;
  /* Digits of equal width, so a value being dragged does not jitter the sentence. */
  font-variant-numeric: tabular-nums;
}
.notatio-knob-grip { cursor: ew-resize; }
notatio-knob[axis="y"] .notatio-knob-grip,
notatio-knob[axis="y"].notatio-knob-grip { cursor: ns-resize; }
/* The gear shows in the rule under the value: heavier in coarse, hairline in fine. */
.notatio-knob-grip[data-gear="coarse"][data-dragging] { border-bottom-width: 3px; margin-bottom: -2px; }
.notatio-knob-grip[data-gear="fine"][data-dragging] { border-bottom-style: dotted; }

/* A knob wrapping its own content: the content IS the grip, so none of the text
   affordances apply — a dashed rule under a glyph reads as part of the drawing. It
   gets a ring instead, and only on hover, so the figure is unmarked at rest. */
/* Class-scoped so it ties with the text-grip rules above and wins by order. */
.notatio-knob-grip[data-slotted] {
  display: inline-block;
  border-bottom: 0 none;
  border-radius: 6px;
  padding: 2px;
  vertical-align: middle;
  /* Reserve the ring at rest so hovering does not nudge the line. */
  outline: 2px solid transparent;
  outline-offset: 0;
}
notatio-knob[data-slotted] { display: inline-block; }
.notatio-knob-grip[data-slotted]:hover,
.notatio-knob-grip[data-slotted][data-dragging] {
  background: color-mix(in srgb, var(--vp-c-brand-1, #3451b2) 8%, transparent);
  outline-color: color-mix(in srgb, var(--vp-c-brand-1, #3451b2) 45%, transparent);
}
/* Two axes, so the cursor has to promise both. */
.notatio-knob-grip[data-complex] { cursor: move; }
/* A toggler has no axis to drag along, so it is a pointer and not a resize. */
.notatio-toggler-grip { cursor: pointer; border-bottom-style: dotted; }

.notatio-knob-grip:focus-visible,
.notatio-toggler-grip:focus-visible {
  outline: 2px solid var(--vp-c-brand-1, #3451b2);
  outline-offset: 2px;
  border-radius: 2px;
}

.notatio-knob-grip:hover,
.notatio-knob-grip[data-dragging],
.notatio-toggler-grip:hover {
  border-bottom-style: solid;
  background: color-mix(in srgb, var(--vp-c-brand-1, #3451b2) 10%, transparent);
}

/* The drag affordance: the axis arrows, hung on the grip's OWN edges rather than
   flanking it. Outside the value they sat in the gaps between words, where a
   neighbouring word clipped them and a narrow gap hid them; on the edges, below the
   dashed rule (or above and below it, for a vertical axis), the space belongs to the
   grip. Out of flow either way, so the line never reflows -- and they hang off
   pseudo-elements, since the value's markup is MathLive's and not ours to annotate. */
.notatio-knob-grip::before,
.notatio-knob-grip::after {
  position: absolute;
  top: 100%;
  opacity: 0;
  transition: opacity 0.1s;
  font-size: 0.7em;
  line-height: 1;
  pointer-events: none;
}
.notatio-knob-grip::before { content: "\\25C2"; left: 0; }
.notatio-knob-grip::after { content: "\\25B8"; right: 0; }

/* A vertical knob points where it is dragged: above the value and below it. */
notatio-knob[axis="y"] .notatio-knob-grip::before,
notatio-knob[axis="y"].notatio-knob-grip::before {
  content: "\\25B4";
  top: auto;
  bottom: 100%;
  left: 50%;
  transform: translate(-50%, 55%);
}
notatio-knob[axis="y"] .notatio-knob-grip::after,
notatio-knob[axis="y"].notatio-knob-grip::after {
  content: "\\25BE";
  right: auto;
  left: 50%;
  transform: translate(-50%, -55%);
}

/* Two axes, so all four arrows, split between the two bottom corners. */
.notatio-knob-grip[data-complex]::before { content: "\\25C2\\25B4"; }
.notatio-knob-grip[data-complex]::after { content: "\\25BE\\25B8"; }

.notatio-knob-grip:hover::before,
.notatio-knob-grip:hover::after,
.notatio-knob-grip[data-dragging]::before,
.notatio-knob-grip[data-dragging]::after {
  opacity: 0.75;
}

/* While a knob is being dragged the pointer leaves the element, so the whole document
   has to stop selecting -- the grip's own user-select alone is not enough. */
body:has(.notatio-knob-grip[data-dragging]) {
  user-select: none;
  cursor: ew-resize;
}
body:has(notatio-knob[axis="y"] .notatio-knob-grip[data-dragging]),
body:has(notatio-knob[axis="y"].notatio-knob-grip[data-dragging]) { cursor: ns-resize; }
body:has(.notatio-knob-grip[data-complex][data-dragging]) { cursor: move; }

/* The gear ladder beside a dragged knob: the three increments stacked coarse over
   fine, the live one filled. Out of flow, past the hover arrow, and not a target. */
.notatio-knob-ladder {
  position: absolute;
  left: 100%;
  top: 50%;
  transform: translateY(-50%);
  margin-left: 1.1em;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 3px;
  border-radius: 5px;
  background: var(--vp-c-bg-elv, var(--vp-c-bg, #fff));
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
  pointer-events: none;
  font-size: 0.7em;
  line-height: 1.3;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  z-index: 2;
}
notatio-knob[axis="y"] .notatio-knob-ladder {
  left: 50%;
  top: 100%;
  transform: translateX(-50%);
  margin: 0.4em 0 0;
  flex-direction: row-reverse;
}
.notatio-knob-ladder > span {
  padding: 0 0.4em;
  border-radius: 3px;
  text-align: center;
  color: var(--vp-c-text-2, #666);
  background: var(--vp-c-bg-soft, #f6f6f7);
}
.notatio-knob-ladder > span[data-live] {
  color: var(--vp-c-bg, #fff);
  background: var(--vp-c-brand-1, #3451b2);
  border-color: var(--vp-c-brand-1, #3451b2);
}

/* A prose control panel: a paragraph like the ones around it, set off only by
   its knobs. */
.notatio-manip-prose { margin: 0 0 0.8em; }

/* The play/pause button beside a knob or toggler that asked for one: small, faint
   until hovered, and never part of the drag. */
.notatio-knob-play {
  display: inline-block;
  border: 0;
  padding: 0 0.15em;
  margin-left: 0.15em;
  font: inherit;
  font-size: 0.7em;
  line-height: 1;
  vertical-align: 0.15em;
  color: var(--vp-c-brand-1, #3451b2);
  background: none;
  cursor: pointer;
  opacity: 0.55;
  user-select: none;
  -webkit-user-select: none;
}
.notatio-knob-play:hover,
.notatio-knob-play[aria-pressed="true"] { opacity: 1; }
.notatio-knob-play:focus-visible {
  outline: 2px solid var(--vp-c-brand-1, #3451b2);
  outline-offset: 2px;
  border-radius: 2px;
}
/* A value in motion is marked the way a dragged one is. */
.notatio-knob-grip[data-playing],
.notatio-toggler-grip[data-playing] { border-bottom-style: solid; }

/* The field a knob turns into on Enter or a double tap: the same glyphs, editable. */
.notatio-knob-field {
  font: inherit;
  color: inherit;
  background: none;
  border: 0;
  padding: 0;
  margin: 0;
  outline: none;
  font-variant-numeric: tabular-nums;
  text-align: center;
}
.notatio-knob-grip[data-editing] { cursor: text; border-bottom-style: solid; }

/* The options menu of a toggler or a choices knob. On the body, in the top layer when
   the browser has one, so nothing about the sentence changes when it opens. */
.notatio-choice-menu {
  position: fixed;
  inset: auto;
  margin: 0;
  padding: 4px;
  min-width: 6em;
  max-height: 60vh;
  overflow-y: auto;
  border: 1px solid var(--vp-c-divider, #e2e2e3);
  border-radius: 6px;
  background: var(--vp-c-bg-elv, var(--vp-c-bg, #fff));
  color: var(--vp-c-text-1, inherit);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.12);
  font-size: 0.95em;
  z-index: 100;
}
.notatio-choice-menu:not([popover]) { display: block; }

/* The speed-and-cycle panel a held play button opens: two rows of radio buttons. */
.notatio-playback-menu {
  position: fixed;
  inset: auto;
  margin: 0;
  padding: 6px 8px;
  border: 1px solid var(--vp-c-divider, #e2e2e3);
  border-radius: 6px;
  background: var(--vp-c-bg-elv, var(--vp-c-bg, #fff));
  color: var(--vp-c-text-1, inherit);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.12);
  font-size: 0.8em;
  z-index: 100;
}
.notatio-playback-menu:not([popover]) { display: block; }
.notatio-playback-row {
  display: flex;
  align-items: center;
  gap: 3px;
}
.notatio-playback-row + .notatio-playback-row { margin-top: 4px; }
.notatio-playback-label {
  width: 3.2em;
  color: var(--vp-c-text-2, #666);
  font-variant: small-caps;
}
.notatio-playback-choice {
  font: inherit;
  font-variant-numeric: tabular-nums;
  padding: 0.1em 0.5em;
  border: 1px solid transparent;
  border-radius: 4px;
  background: none;
  color: inherit;
  cursor: pointer;
}
.notatio-playback-choice:hover { background: color-mix(in srgb, var(--vp-c-brand-1, #3451b2) 10%, transparent); }
.notatio-playback-choice[aria-checked="true"] {
  color: var(--vp-c-brand-1, #3451b2);
  border-color: var(--vp-c-brand-1, #3451b2);
  font-weight: 600;
}
.notatio-playback-choice:focus-visible {
  outline: 2px solid var(--vp-c-brand-1, #3451b2);
  outline-offset: 1px;
}
.notatio-choice-option {
  padding: 0.2em 0.7em;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
}
.notatio-choice-option:hover,
.notatio-choice-option:focus-visible {
  outline: none;
  background: color-mix(in srgb, var(--vp-c-brand-1, #3451b2) 12%, transparent);
}
.notatio-choice-option[aria-selected="true"] {
  color: var(--vp-c-brand-1, #3451b2);
  font-weight: 600;
}
`;

export function ensureStyles(): void {
  ensureCopyHandler();
  if (injected || typeof document === "undefined") return;
  injected = true;
  const style = document.createElement("style");
  style.id = "notatio-elements";
  style.textContent = CSS;
  document.head.append(style);
}

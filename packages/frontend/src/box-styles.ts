// The layout of the box renderer's elements (`box-render.ts`): one stylesheet for the host that
// loads elements (`@enumeratio/components`) and for a page that is shown before any element loads
// (a build's prerendered Out). The rules key on the tags and on `data-head`.

export const BOX_LAYOUT_CSS = `
/* --- layout boxes: Row, Column, Grid, Panel, Labeled ------------------------------------
   Each box is its own tag from the box renderer (box-render.ts, row-box); data-head is the
   head the author wrote. A Labeled is a one-row or two-row grid; the renderer puts the
   label's cell where it goes, so no ordering is needed here. */
row-box { display: contents; }
grid-box { display: inline-grid; gap: 0.4em 0.8em; align-items: center; vertical-align: top; }
/* A math run is one form-box leaf, inline like the formula it holds; a grid's cell is the leaf. */
graphics-box, graphics-complex-box { display: block; }
[data-head="Row"] { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 0.6em; vertical-align: middle; }
[data-head="Column"] { display: inline-flex; flex-direction: column; align-items: flex-start; gap: 0.5em; vertical-align: top; }
[data-head="Column"], [data-head="Labeled"] { grid-template-columns: none; }
grid-box[data-frame] { border: 1px solid var(--vp-c-divider, #e2e2e3); }
grid-box[data-dividers] {
  gap: 1px;
  background: var(--vp-c-divider, #e2e2e3);
  border: 1px solid var(--vp-c-divider, #e2e2e3);
}
grid-box[data-dividers] > * { background: var(--vp-c-bg, #fff); padding: 0.2em 0.4em; }
panel-box {
  display: inline-block;
  padding: 0.6em 0.9em;
  border: 1px solid var(--vp-c-divider, #e2e2e3);
  border-radius: 8px;
  background: var(--vp-c-bg-soft, #f6f6f7);
  vertical-align: top;
}
frame-box { display: inline-block; padding: 0.15em 0.3em; border: 1px solid currentColor; vertical-align: middle; }
pane-box { display: inline-block; overflow: hidden; vertical-align: top; }
pane-box[data-scrollbars] { overflow: auto; }
[data-head="Labeled"] { display: inline-flex; align-items: center; gap: 0.4em; vertical-align: middle; }
[data-head="Labeled"][data-rows="2"] { flex-direction: column; align-items: flex-start; gap: 0.15em; }
/* A plot with a caption: the plot takes the width, the caption reads as a paragraph under it. */
[data-head="Labeled"]:has(> graphics-box) { display: flex; gap: 0.5rem; text-align: start; }
[data-head="Labeled"] > graphics-box { align-self: stretch; }
[data-head="Labeled"]:has(> graphics-box) > notatio-string-template { display: block; line-height: 1.7; }
.style-box-label { font-size: 0.85em; color: var(--vp-c-text-2, #666); }
`;

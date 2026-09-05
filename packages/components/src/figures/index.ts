// Framework-agnostic figure custom elements (Lit). Importing this module REGISTERS every element as a side effect —
// import it once (e.g. in the docs theme) and then use the semantic tags in any markup, in any framework:
//   <svg-figure svg="<svg…/>">           — the generic renderer for a ready-made SVG string (notably pg's glyph_svg).
//   <polytope-figure> / <polytope-overlay> — the WebGL scene-space figures.
// Names carry a semantic TYPE suffix (-figure) rather than an `enum-`/`enumeratio-` vendor prefix; the
// enumeratio- prefix is reserved for the client-backed, enumeratio-resource components in ../ (e.g. <enumeratio-notation>).
import './fullscreen-button'
import './svg-figure'
import './polytope-figure'
import './polytope-overlay'

export { FullscreenButton } from './fullscreen-button'
export { SvgFigure } from './svg-figure'
export { PolytopeFigure } from './polytope-figure'
export { PolytopeOverlay } from './polytope-overlay'

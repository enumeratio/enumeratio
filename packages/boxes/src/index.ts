// The box tree, `MakeBoxes` and the notation registry: base, what every symbol package's
// notation extends. The serialisers are presentation, at `@enumeratio/boxes/render`.

export * from "./box.ts";
export { BOXES_TYPE, declareBoxes } from "./declare.ts";
export { BoxFormError, fromMathJson, toMathJson } from "./json.ts";
export { APPLY_FUNCTION, INVISIBLE_TIMES, makeBoxes } from "./make.ts";
export {
  fence,
  indexed,
  isList,
  named,
  type Notation,
  type NotationRule,
  notationOf,
  registerNotation,
  scalars,
  subscripted,
  type Writer,
} from "./notation.ts";
// Transitional: components' notatio-out.ts, frontend's kernel-host.ts and the site's
// session-worker-entry.ts still read these here. Presentation only; the hierarchy test keeps symbol packages off them.
export { BOXES_LATEX, toAscii, toLatex } from "./render/index.ts";

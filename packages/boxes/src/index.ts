// The box tree, `MakeBoxes` and the notation registry: base, what every symbol package's
// notation extends. The serialisers are presentation, at `@enumeratio/boxes/render`.

export * from "./box.ts";
export * from "./layout.ts";
export { BOXES_TYPE, declareBoxes } from "./declare.ts";
export { BoxFormError, fromMathJson, toMathJson } from "./json.ts";
export { APPLY_FUNCTION, INVISIBLE_TIMES, type MakeOptions, makeBoxes } from "./make.ts";
export { LAYOUT_HEADS, LAYOUT_NOTATION, LAYOUT_OPTIONS } from "./notation-layout.ts";
export {
  combineNotation,
  fence,
  indexed,
  isList,
  named,
  type Notation,
  type NotationRule,
  notationOf,
  type PackageNotation,
  registerNotation,
  scalars,
  subscripted,
  type Writer,
} from "./notation.ts";
export { compileNotation } from "./notation-data.ts";

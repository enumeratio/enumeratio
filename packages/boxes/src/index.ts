// The box tree, `MakeBoxes` and the notation registry: base, what every symbol package's
// notation extends. The serialisers are presentation, at `@enumeratio/boxes/render`.

export * from "./box.ts";
export { BOXES_TYPE, declareBoxes } from "./declare.ts";
export { BoxFormError, fromMathJson, toMathJson } from "./json.ts";
export { APPLY_FUNCTION, INVISIBLE_TIMES, makeBoxes } from "./make.ts";
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

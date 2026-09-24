// Public surface. Importing this module registers the built-in formats (side
// effect of ./formats.ts), then re-exports the registry + Import/Export API.
import "./formats.ts";

export { normalizeInputForm, toInputForm } from "./inputform.ts";
export {
  isOptionList,
  optionName,
  optionsOf,
  ruleOf,
  type Split,
  withOptions,
} from "@enumeratio/boxed";
export { type MathMLOptions, toMathML } from "./mathml.ts";
export {
  collectWildcards,
  type NotatioOptions,
  type NotatioResult,
  parseNotatio,
  serializeNotatio,
} from "./notatio.ts";
export type { Format, FormatOptions, ImageValue } from "./registry.ts";
export {
  allFormats,
  exportFormats,
  exportTo,
  fileFormat,
  formatForExtension,
  getFormat,
  importFormats,
  importFrom,
  isImageFormat,
  isImageValue,
  mimeTypeToFormatList,
  registerFormat,
  sniffFormat,
} from "./registry.ts";

export {
  dataUri,
  declareGraphics,
  GRAPHICS_HEADS,
  imageUri,
  type Rasterizer,
  setRasterizer,
  svgDataUri,
} from "./graphics.ts";

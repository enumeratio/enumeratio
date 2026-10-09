// The base package -- the symbol map, the renderers, the arithmetic -- re-exported, so
// a consumer that wants the components has the whole of notatio from one import.
export * from "@enumeratio/frontend";

// Every box primitive is a tag; the ones without behavior are empty elements.
import { defineBoxElements } from "./box-elements.ts";
if (typeof document !== "undefined") defineBoxElements();
export { defineBoxElements, INTERACTIVE_BOX_TAGS, PLAIN_BOX_TAGS } from "./box-elements.ts";

// The page is a scope: controls and readouts with no `<dynamic-module-box>` around them
// bind through it. Installed once, client side.
import { pageScope } from "./scope.ts";
if (typeof document !== "undefined") pageScope();
export { pageScope, Scope } from "./scope.ts";

// Importing any element module registers its custom element as a side effect.
import "./notatio-in.ts";
import "./notatio-out.ts";
import "./notatio-cell.ts";
import "./notatio-clock.ts";
import "./notatio-torus-square.ts";
import "./notatio-notebook.ts";
import "./notatio-worksheet.ts";
import "./notatio-plot.ts";
import "./notatio-plot-3d.ts";
import "./notatio-curve-3d.ts";
import "./notatio-contour-plot.ts";
import "./notatio-density-plot.ts";
import "./notatio-vector-plot.ts";
import "./notatio-polar-plot.ts";
import "./notatio-list-plot-3d.ts";
import "./notatio-bar-chart-3d.ts";
import "./notatio-chart.ts";
import "./notatio-graph-plot.ts";
import "./notatio-complex-plot.ts";
import "./notatio-complex-plot-3d.ts";
import "./notatio-show.ts";
import "./notatio-stepper.ts";
import "./notatio-string-template.ts";
import "./notatio-gradient.ts";
import "./notatio-palette.ts";
import "./notatio-manipulate.ts";
import "./dynamic-module-box.ts";
import "./slider-box.ts";
import "./animator-box.ts";
import "./slider-2d-box.ts";
import "./setter-box.ts";
import "./notatio-radio-button-bar.ts";
import "./notatio-toggler-bar.ts";
import "./popup-menu-box.ts";
import "./notatio-list-picker.ts";
import "./checkbox-box.ts";
import "./notatio-interval-slider.ts";
import "./notatio-color-slider.ts";
import "./notatio-locator.ts";
import "./input-field-box.ts";
import "./notatio-code.ts";
import "./notatio-terminal.ts";
import "./notatio-collection-table.ts";
import "./table-view-box.ts";
import "./notatio-test-result-object.ts";

import type { NotatioCell } from "./notatio-cell.ts";
import type { NotatioCode } from "./notatio-code.ts";
import type { NotatioCollectionTable } from "./notatio-collection-table.ts";
import type { NotatioChart } from "./notatio-chart.ts";
import type { NotatioGraphPlot } from "./notatio-graph-plot.ts";
import type { NotatioIn } from "./notatio-in.ts";
import type { NotatioOut } from "./notatio-out.ts";
import type { NotatioNotebook } from "./notatio-notebook.ts";
import type { NotatioPlot } from "./notatio-plot.ts";
import type { NotatioManipulate } from "./notatio-manipulate.ts";
import type { NotatioDynamicModule } from "./dynamic-module-box.ts";
import type { NotatioKnob } from "./notatio-knob.ts";
import type { NotatioSlider } from "./slider-box.ts";
import type { NotatioAnimator } from "./animator-box.ts";
import type { NotatioSlider2D } from "./slider-2d-box.ts";
import type { NotatioSetterBar } from "./setter-box.ts";
import type { NotatioRadioButtonBar } from "./notatio-radio-button-bar.ts";
import type { NotatioTogglerBar } from "./notatio-toggler-bar.ts";
import type { NotatioPopupMenu } from "./popup-menu-box.ts";
import type { NotatioListPicker } from "./notatio-list-picker.ts";
import type { NotatioCheckbox } from "./checkbox-box.ts";
import type { NotatioIntervalSlider } from "./notatio-interval-slider.ts";
import type { NotatioColorSlider } from "./notatio-color-slider.ts";
import type { NotatioLocator } from "./notatio-locator.ts";
import type { NotatioInputField } from "./input-field-box.ts";
import type { NotatioToggler } from "./toggler-box.ts";
import type { NotatioDynamic } from "./dynamic-box.ts";
import type { NotatioWhen } from "./notatio-when.ts";
import type { NotatioPlot3D } from "./notatio-plot-3d.ts";
import type { NotatioComplexPlot3D } from "./notatio-complex-plot-3d.ts";
import type { NotatioShow } from "./notatio-show.ts";
import type { NotatioStepper } from "./notatio-stepper.ts";
import type { NotatioStringTemplate } from "./notatio-string-template.ts";
import type { NotatioGradient } from "./notatio-gradient.ts";
import type { NotatioPalette } from "./notatio-palette.ts";
import type { NotatioContourPlot } from "./notatio-contour-plot.ts";
import type { NotatioDensityPlot } from "./notatio-density-plot.ts";
import type { NotatioPolarPlot } from "./notatio-polar-plot.ts";
import type { NotatioVectorPlot } from "./notatio-vector-plot.ts";
import type { NotatioBarChart3D } from "./notatio-bar-chart-3d.ts";
import type { NotatioListPlot3D } from "./notatio-list-plot-3d.ts";
import type { NotatioTerminal } from "./notatio-terminal.ts";
import type { NotatioTestResultObject } from "./notatio-test-result-object.ts";

export { NotatioIn } from "./notatio-in.ts";
export { NotatioOut } from "./notatio-out.ts";
export { NotatioCell } from "./notatio-cell.ts";
export { NotatioClock } from "./notatio-clock.ts";
export { NotatioTorusSquare } from "./notatio-torus-square.ts";
export { NotatioCollectionTable } from "./notatio-collection-table.ts";
export { NotatioNotebook, referencesOrdinal } from "./notatio-notebook.ts";
export { NotatioWorksheet } from "./notatio-worksheet.ts";
export { NotatioCode } from "./notatio-code.ts";
export { NotatioPlot } from "./notatio-plot.ts";
export { NotatioPlot3D } from "./notatio-plot-3d.ts";
export { NotatioCurve3D } from "./notatio-curve-3d.ts";
export { NotatioContourPlot } from "./notatio-contour-plot.ts";
export { NotatioDensityPlot } from "./notatio-density-plot.ts";
export { NotatioVectorPlot, splitField } from "./notatio-vector-plot.ts";
export { NotatioPolarPlot } from "./notatio-polar-plot.ts";
export { NotatioComplexPlot } from "./notatio-complex-plot.ts";
export { NotatioComplexPlot3D } from "./notatio-complex-plot-3d.ts";
export { NotatioShow } from "./notatio-show.ts";
export { NotatioStepper } from "./notatio-stepper.ts";
export { NotatioStringTemplate } from "./notatio-string-template.ts";
export { NotatioGradient, type GradientSetting } from "./notatio-gradient.ts";
export { NotatioPalette, type PaletteSetting } from "./notatio-palette.ts";
export { figureFrame, type FramePlacement } from "./figure-frame.ts";
export { NotatioListPlot3D } from "./notatio-list-plot-3d.ts";
export { NotatioBarChart3D } from "./notatio-bar-chart-3d.ts";
export { NotatioChart } from "./notatio-chart.ts";
export { NotatioGraphPlot, type GraphType } from "./notatio-graph-plot.ts";
export { NotatioManipulate } from "./notatio-manipulate.ts";
export { NotatioDynamicModule } from "./dynamic-module-box.ts";
export { NotatioKnob } from "./notatio-knob.ts";
export { NotatioToggler } from "./toggler-box.ts";
export { NotatioSlider } from "./slider-box.ts";
export { NotatioAnimator } from "./animator-box.ts";
export { NotatioSlider2D } from "./slider-2d-box.ts";
export { ChoiceControl } from "./choice-control.ts";
export { NotatioSetterBar } from "./setter-box.ts";
export { NotatioRadioButtonBar } from "./notatio-radio-button-bar.ts";
export { NotatioTogglerBar } from "./notatio-toggler-bar.ts";
export { NotatioPopupMenu } from "./popup-menu-box.ts";
export { NotatioListPicker } from "./notatio-list-picker.ts";
export { NotatioCheckbox } from "./checkbox-box.ts";
export { NotatioIntervalSlider } from "./notatio-interval-slider.ts";
export { hexOf, NotatioColorSlider, rgbOf } from "./notatio-color-slider.ts";
export { NotatioLocator } from "./notatio-locator.ts";
export { NotatioInputField } from "./input-field-box.ts";
export { NotatioDynamic } from "./dynamic-box.ts";
export { NotatioWhen } from "./notatio-when.ts";
export { applyTemplates, captureTemplates, type Template } from "./bindings.ts";
export { NotatioTerminal } from "./notatio-terminal.ts";
export { NotatioTestResultObject } from "./notatio-test-result-object.ts";

// The MathLive/compute-engine integration, so hosts depend on this package alone.
export {
  configureEngine,
  configureLatex,
  configureMacros,
  ensureMathliveAssets,
  loadEngine,
  loadMarkup,
} from "./mathlive.ts";
export type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";

declare global {
  interface HTMLElementTagNameMap {
    "notatio-in": NotatioIn;
    "notatio-out": NotatioOut;
    "notatio-cell": NotatioCell;
    "notatio-collection-table": NotatioCollectionTable;
    "notatio-notebook": NotatioNotebook;
    "notatio-code": NotatioCode;
    "notatio-plot": NotatioPlot;
    "notatio-plot-3d": NotatioPlot3D;
    "notatio-complex-plot-3d": NotatioComplexPlot3D;
    "notatio-show": NotatioShow;
    "notatio-stepper": NotatioStepper;
    "notatio-string-template": NotatioStringTemplate;
    "notatio-gradient": NotatioGradient;
    "notatio-palette": NotatioPalette;
    "notatio-contour-plot": NotatioContourPlot;
    "notatio-density-plot": NotatioDensityPlot;
    "notatio-vector-plot": NotatioVectorPlot;
    "notatio-polar-plot": NotatioPolarPlot;
    "notatio-list-plot-3d": NotatioListPlot3D;
    "notatio-bar-chart-3d": NotatioBarChart3D;
    "notatio-chart": NotatioChart;
    "notatio-graph-plot": NotatioGraphPlot;
    "notatio-manipulate": NotatioManipulate;
    "dynamic-module-box": NotatioDynamicModule;
    "notatio-knob": NotatioKnob;
    "toggler-box": NotatioToggler;
    "slider-box": NotatioSlider;
    "animator-box": NotatioAnimator;
    "slider-2d-box": NotatioSlider2D;
    "setter-box": NotatioSetterBar;
    "notatio-radio-button-bar": NotatioRadioButtonBar;
    "notatio-toggler-bar": NotatioTogglerBar;
    "popup-menu-box": NotatioPopupMenu;
    "notatio-list-picker": NotatioListPicker;
    "checkbox-box": NotatioCheckbox;
    "notatio-interval-slider": NotatioIntervalSlider;
    "notatio-color-slider": NotatioColorSlider;
    "notatio-locator": NotatioLocator;
    "input-field-box": NotatioInputField;
    "dynamic-box": NotatioDynamic;
    "notatio-when": NotatioWhen;
    "notatio-terminal": NotatioTerminal;
    "notatio-test-result-object": NotatioTestResultObject;
  }
}

// Every other head the engine knows gets a generic element at its tag, now that the
// hand-written ones are defined and can keep theirs.
import { defineOnDemand } from "./generic.ts";
export {
  defineGeneric,
  defineGenerics,
  defineOnDemand,
  defineUsed,
  expressionOf,
  isExpressive,
  NotatioGeneric,
} from "./generic.ts";
if (typeof customElements !== "undefined" && typeof document !== "undefined") defineOnDemand();

// A built component written structurally -- its arguments as children, its options as
// Wolfram-named attributes -- is lowered into its own attributes as it arrives.
import { watchStructures } from "./structure.ts";
export { adoptStructure, adoptStructures, watchStructures } from "./structure.ts";
watchStructures();

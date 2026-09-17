// The base package -- the symbol map, the renderers, the arithmetic -- re-exported, so
// a consumer that wants the components has the whole of notatio from one import.
export * from "@enumeratio/notatio";

// The page is a scope: controls and readouts with no `<notatio-tangle>` around them
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
import "./notatio-figure.ts";
import "./notatio-plot.ts";
import "./notatio-plot-3d.ts";
import "./notatio-polytope.ts";
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
import "./notatio-manipulate.ts";
import "./notatio-tangle.ts";
import "./notatio-slider.ts";
import "./notatio-vertical-slider.ts";
import "./notatio-animator.ts";
import "./notatio-slider-2d.ts";
import "./notatio-setter-bar.ts";
import "./notatio-radio-button-bar.ts";
import "./notatio-toggler-bar.ts";
import "./notatio-popup-menu.ts";
import "./notatio-list-picker.ts";
import "./notatio-checkbox.ts";
import "./notatio-interval-slider.ts";
import "./notatio-color-slider.ts";
import "./notatio-locator.ts";
import "./notatio-input-field.ts";
import "./notatio-row.ts";
import "./notatio-column.ts";
import "./notatio-grid.ts";
import "./notatio-panel.ts";
import "./notatio-labeled.ts";
import "./notatio-code.ts";
import "./notatio-terminal.ts";
import "./notatio-collection-table.ts";

import type { NotatioCell } from "./notatio-cell.ts";
import type { NotatioCode } from "./notatio-code.ts";
import type { NotatioCollectionTable } from "./notatio-collection-table.ts";
import type { NotatioChart } from "./notatio-chart.ts";
import type { NotatioFigure } from "./notatio-figure.ts";
import type { NotatioGraphPlot } from "./notatio-graph-plot.ts";
import type { NotatioIn } from "./notatio-in.ts";
import type { NotatioOut } from "./notatio-out.ts";
import type { NotatioNotebook } from "./notatio-notebook.ts";
import type { NotatioPlot } from "./notatio-plot.ts";
import type { NotatioManipulate } from "./notatio-manipulate.ts";
import type { NotatioTangle } from "./notatio-tangle.ts";
import type { NotatioKnob } from "./notatio-knob.ts";
import type { NotatioSlider } from "./notatio-slider.ts";
import type { NotatioVerticalSlider } from "./notatio-vertical-slider.ts";
import type { NotatioAnimator } from "./notatio-animator.ts";
import type { NotatioSlider2D } from "./notatio-slider-2d.ts";
import type { NotatioSetterBar } from "./notatio-setter-bar.ts";
import type { NotatioRadioButtonBar } from "./notatio-radio-button-bar.ts";
import type { NotatioTogglerBar } from "./notatio-toggler-bar.ts";
import type { NotatioPopupMenu } from "./notatio-popup-menu.ts";
import type { NotatioListPicker } from "./notatio-list-picker.ts";
import type { NotatioCheckbox } from "./notatio-checkbox.ts";
import type { NotatioIntervalSlider } from "./notatio-interval-slider.ts";
import type { NotatioColorSlider } from "./notatio-color-slider.ts";
import type { NotatioLocator } from "./notatio-locator.ts";
import type { NotatioInputField } from "./notatio-input-field.ts";
import type { NotatioRow } from "./notatio-row.ts";
import type { NotatioColumn } from "./notatio-column.ts";
import type { NotatioGrid } from "./notatio-grid.ts";
import type { NotatioPanel } from "./notatio-panel.ts";
import type { NotatioLabeled } from "./notatio-labeled.ts";
import type { NotatioToggler } from "./notatio-toggler.ts";
import type { NotatioDynamic } from "./notatio-dynamic.ts";
import type { NotatioWhen } from "./notatio-when.ts";
import type { NotatioPlot3D } from "./notatio-plot-3d.ts";
import type { NotatioComplexPlot3D } from "./notatio-complex-plot-3d.ts";
import type { NotatioContourPlot } from "./notatio-contour-plot.ts";
import type { NotatioDensityPlot } from "./notatio-density-plot.ts";
import type { NotatioPolarPlot } from "./notatio-polar-plot.ts";
import type { NotatioVectorPlot } from "./notatio-vector-plot.ts";
import type { NotatioBarChart3D } from "./notatio-bar-chart-3d.ts";
import type { NotatioListPlot3D } from "./notatio-list-plot-3d.ts";
import type { NotatioTerminal } from "./notatio-terminal.ts";

export { NotatioIn } from "./notatio-in.ts";
export { NotatioOut } from "./notatio-out.ts";
export { NotatioCell } from "./notatio-cell.ts";
export { NotatioClock } from "./notatio-clock.ts";
export { NotatioTorusSquare } from "./notatio-torus-square.ts";
export { NotatioCollectionTable } from "./notatio-collection-table.ts";
export { NotatioNotebook, referencesOrdinal } from "./notatio-notebook.ts";
export { NotatioWorksheet } from "./notatio-worksheet.ts";
export { NotatioCode } from "./notatio-code.ts";
export { NotatioFigure } from "./notatio-figure.ts";
export { NotatioPlot } from "./notatio-plot.ts";
export { NotatioPlot3D } from "./notatio-plot-3d.ts";
export { NotatioPolytope } from "./notatio-polytope.ts";
export { NotatioCurve3D } from "./notatio-curve-3d.ts";
export { NotatioContourPlot } from "./notatio-contour-plot.ts";
export { NotatioDensityPlot } from "./notatio-density-plot.ts";
export { NotatioVectorPlot, splitField } from "./notatio-vector-plot.ts";
export { NotatioPolarPlot } from "./notatio-polar-plot.ts";
export { NotatioComplexPlot } from "./notatio-complex-plot.ts";
export { NotatioComplexPlot3D } from "./notatio-complex-plot-3d.ts";
export { NotatioListPlot3D } from "./notatio-list-plot-3d.ts";
export { NotatioBarChart3D } from "./notatio-bar-chart-3d.ts";
export { NotatioChart } from "./notatio-chart.ts";
export { NotatioGraphPlot, type GraphType } from "./notatio-graph-plot.ts";
export { NotatioManipulate } from "./notatio-manipulate.ts";
export { NotatioTangle } from "./notatio-tangle.ts";
export { NotatioKnob } from "./notatio-knob.ts";
export { NotatioToggler } from "./notatio-toggler.ts";
export { NotatioSlider } from "./notatio-slider.ts";
export { NotatioVerticalSlider } from "./notatio-vertical-slider.ts";
export { NotatioAnimator } from "./notatio-animator.ts";
export { NotatioSlider2D } from "./notatio-slider-2d.ts";
export { ChoiceControl } from "./choice-control.ts";
export { NotatioSetterBar } from "./notatio-setter-bar.ts";
export { NotatioRadioButtonBar } from "./notatio-radio-button-bar.ts";
export { NotatioTogglerBar } from "./notatio-toggler-bar.ts";
export { NotatioPopupMenu } from "./notatio-popup-menu.ts";
export { NotatioListPicker } from "./notatio-list-picker.ts";
export { NotatioCheckbox } from "./notatio-checkbox.ts";
export { NotatioIntervalSlider } from "./notatio-interval-slider.ts";
export { hexOf, NotatioColorSlider, rgbOf } from "./notatio-color-slider.ts";
export { NotatioLocator } from "./notatio-locator.ts";
export { NotatioInputField } from "./notatio-input-field.ts";
export { NotatioRow } from "./notatio-row.ts";
export { NotatioColumn } from "./notatio-column.ts";
export { NotatioGrid } from "./notatio-grid.ts";
export { NotatioPanel } from "./notatio-panel.ts";
export { NotatioLabeled } from "./notatio-labeled.ts";
export { NotatioDynamic } from "./notatio-dynamic.ts";
export { NotatioWhen } from "./notatio-when.ts";
export { applyTemplates, captureTemplates, type Template } from "./bindings.ts";
export { NotatioTerminal } from "./notatio-terminal.ts";

// The MathLive/compute-engine integration, so hosts depend on this package alone.
export { configureEngine, ensureMathliveAssets, loadEngine, loadMarkup } from "./mathlive.ts";
export type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";

declare global {
  interface HTMLElementTagNameMap {
    "notatio-in": NotatioIn;
    "notatio-out": NotatioOut;
    "notatio-cell": NotatioCell;
    "notatio-collection-table": NotatioCollectionTable;
    "notatio-notebook": NotatioNotebook;
    "notatio-code": NotatioCode;
    "notatio-figure": NotatioFigure;
    "notatio-plot": NotatioPlot;
    "notatio-plot-3d": NotatioPlot3D;
    "notatio-complex-plot-3d": NotatioComplexPlot3D;
    "notatio-contour-plot": NotatioContourPlot;
    "notatio-density-plot": NotatioDensityPlot;
    "notatio-vector-plot": NotatioVectorPlot;
    "notatio-polar-plot": NotatioPolarPlot;
    "notatio-list-plot-3d": NotatioListPlot3D;
    "notatio-bar-chart-3d": NotatioBarChart3D;
    "notatio-chart": NotatioChart;
    "notatio-graph-plot": NotatioGraphPlot;
    "notatio-manipulate": NotatioManipulate;
    "notatio-tangle": NotatioTangle;
    "notatio-knob": NotatioKnob;
    "notatio-toggler": NotatioToggler;
    "notatio-slider": NotatioSlider;
    "notatio-vertical-slider": NotatioVerticalSlider;
    "notatio-animator": NotatioAnimator;
    "notatio-slider-2d": NotatioSlider2D;
    "notatio-setter-bar": NotatioSetterBar;
    "notatio-radio-button-bar": NotatioRadioButtonBar;
    "notatio-toggler-bar": NotatioTogglerBar;
    "notatio-popup-menu": NotatioPopupMenu;
    "notatio-list-picker": NotatioListPicker;
    "notatio-checkbox": NotatioCheckbox;
    "notatio-interval-slider": NotatioIntervalSlider;
    "notatio-color-slider": NotatioColorSlider;
    "notatio-locator": NotatioLocator;
    "notatio-input-field": NotatioInputField;
    "notatio-row": NotatioRow;
    "notatio-column": NotatioColumn;
    "notatio-grid": NotatioGrid;
    "notatio-panel": NotatioPanel;
    "notatio-labeled": NotatioLabeled;
    "notatio-dynamic": NotatioDynamic;
    "notatio-when": NotatioWhen;
    "notatio-terminal": NotatioTerminal;
  }
}

// Every other head the engine knows gets a generic element at its tag, now that the
// hand-written ones are defined and can keep theirs.
import { defineGenerics } from "./generic.ts";
export {
  defineGeneric,
  defineGenerics,
  expressionOf,
  isExpressive,
  NotatioGeneric,
} from "./generic.ts";
if (typeof customElements !== "undefined") defineGenerics();

// A built component written structurally -- its arguments as children, its options as
// Wolfram-named attributes -- is lowered into its own attributes as it arrives.
import { watchStructures } from "./structure.ts";
export { adoptStructure, adoptStructures, watchStructures } from "./structure.ts";
watchStructures();

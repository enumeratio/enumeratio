// Importing any element module registers its custom element as a side effect.
import "./notatio-in.ts";
import "./notatio-out.ts";
import "./notatio-cell.ts";
import "./notatio-clock.ts";
import "./notatio-torus-square.ts";
import "./notatio-notebook.ts";
import "./notatio-worksheet.ts";
import "./notatio-tex.ts";
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
import type { NotatioToggler } from "./notatio-toggler.ts";
import type { NotatioDynamic } from "./notatio-dynamic.ts";
import type { NotatioWhen } from "./notatio-when.ts";
import type { NotatioPlot3D } from "./notatio-plot-3d.ts";
import type { NotatioContourPlot } from "./notatio-contour-plot.ts";
import type { NotatioDensityPlot } from "./notatio-density-plot.ts";
import type { NotatioPolarPlot } from "./notatio-polar-plot.ts";
import type { NotatioVectorPlot } from "./notatio-vector-plot.ts";
import type { NotatioBarChart3D } from "./notatio-bar-chart-3d.ts";
import type { NotatioListPlot3D } from "./notatio-list-plot-3d.ts";
import type { NotatioTerminal } from "./notatio-terminal.ts";
import type { NotatioTex } from "./notatio-tex.ts";

export { formOfHead, splitHead, stripHead, WRAPPER_HEADS, wrapHead } from "./heads.ts";
export { editorLatexOf, type InForm, toEditorLatex } from "./source.ts";
export { NotatioIn } from "./notatio-in.ts";
export { NotatioOut } from "./notatio-out.ts";
export { NotatioCell } from "./notatio-cell.ts";
export { Clock, pageClock, type Tick } from "./clock.ts";
export { NotatioClock } from "./notatio-clock.ts";
export { NotatioTorusSquare } from "./notatio-torus-square.ts";
export { atPhase, type Strand, strands, torusSquareSvg } from "./torussquare.ts";
export { NotatioCollectionTable } from "./notatio-collection-table.ts";
export { NotatioNotebook, referencesOrdinal } from "./notatio-notebook.ts";
export { NotatioWorksheet } from "./notatio-worksheet.ts";
export { NotatioTex } from "./notatio-tex.ts";
export { NotatioCode } from "./notatio-code.ts";
export { NotatioFigure } from "./notatio-figure.ts";
export { NotatioPlot } from "./notatio-plot.ts";
export { NotatioPlot3D } from "./notatio-plot-3d.ts";
export { NotatioPolytope } from "./notatio-polytope.ts";
export { Orbit, ORBIT_HINT, type OrbitHost, type OrbitView } from "./orbit.ts";
export { NotatioCurve3D } from "./notatio-curve-3d.ts";
export { NotatioContourPlot } from "./notatio-contour-plot.ts";
export { NotatioDensityPlot } from "./notatio-density-plot.ts";
export { NotatioVectorPlot, splitField } from "./notatio-vector-plot.ts";
export { NotatioPolarPlot } from "./notatio-polar-plot.ts";
export { NotatioComplexPlot } from "./notatio-complex-plot.ts";
export { NotatioListPlot3D } from "./notatio-list-plot-3d.ts";
export { NotatioBarChart3D } from "./notatio-bar-chart-3d.ts";
export {
  axisBoxSvg,
  axisLabel,
  camera,
  type Camera,
  type CameraOptions,
  farCorner,
  frameSvg,
  type ScreenPoint,
  unitScale,
  viewDirection,
} from "./project3d.ts";
export {
  gridFromPoints,
  heightShade,
  type List3dOptions,
  type Mesh3dOptions,
  mesh3dSvg,
  type Scatter3dOptions,
  scatter3dSvg,
} from "./listplot3d.ts";
export { type BarChart3dOptions, barChart3dSvg, barShade } from "./barchart3d.ts";
export { type DensityOptions, densityColor, densitySvg, normalize } from "./densityplot.ts";
export {
  arrowPath,
  type Field2d,
  sampleField,
  streamline,
  type StreamlineOptions,
  type VectorPlotOptions,
  type VectorSample,
  vectorPlotSvg,
} from "./vectorplot.ts";
export {
  type PolarPlotOptions,
  type PolarPoint,
  polarPlotSvg,
  polarToCartesian,
  samplePolar,
} from "./polarplot.ts";
export {
  autoLevels,
  type ContourOptions,
  type ContourPoint,
  type ContourSegment,
  contourSvg,
  marchingSquares,
} from "./contour.ts";
export { NotatioChart, type ChartType } from "./notatio-chart.ts";
export {
  arrayPlotSvg,
  barChartSvg,
  boxWhiskerChartSvg,
  discretePlotSvg,
  fiveNumberSummary,
  histogramSvg,
  pieChartSvg,
  sturgesBins,
} from "./chart.ts";
export { NotatioGraphPlot, type GraphType } from "./notatio-graph-plot.ts";
export {
  dendrogramSvg,
  type GraphData,
  graphPlotSvg,
  layeredGraphPlotSvg,
  treePlotSvg,
  type TreeNode,
} from "./graph.ts";
export { NotatioManipulate } from "./notatio-manipulate.ts";
export { NotatioTangle } from "./notatio-tangle.ts";
export { NotatioKnob } from "./notatio-knob.ts";
export {
  CONTROL_EVENT,
  CONTROL_TAGS,
  type ControlChange,
  type ControlElement,
  controlSelector,
  defineControl,
  emitControl,
} from "./controls.ts";
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
export { NotatioDynamic } from "./notatio-dynamic.ts";
export { NotatioWhen } from "./notatio-when.ts";
export {
  boundEntry,
  type Choice,
  choiceBinding,
  complexLatex,
  cycleIndex,
  DEFAULT_PIXELS_PER_STEP,
  isIntegerKnob,
  looksLikeMath,
  numberLatex,
  parseChoices,
  parseComplex,
  parseEntries,
  type ScrubRange,
  scrubIndex,
  scrubValue,
} from "./tangle.ts";
export { applyTemplates, captureTemplates, type Template } from "./bindings.ts";
export { NotatioTerminal } from "./notatio-terminal.ts";
export {
  compositionSvg,
  dyckSvg,
  ferrersSvg,
  type GlyphKind,
  permutationSvg,
  diagramSvg,
  renderGlyph,
  subsetSvg,
} from "./glyphs.ts";
export { linePlotSvg, type PlotPoint } from "./plot.ts";
export { curve3dSvg, type Point3, type Surface3dOptions, surfaceSvg } from "./plot3d.ts";

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
    "notatio-tex": NotatioTex;
    "notatio-code": NotatioCode;
    "notatio-figure": NotatioFigure;
    "notatio-plot": NotatioPlot;
    "notatio-plot-3d": NotatioPlot3D;
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
    "notatio-dynamic": NotatioDynamic;
    "notatio-when": NotatioWhen;
    "notatio-terminal": NotatioTerminal;
  }
}
export { polytope3dSvg, type Polytope3dOptions } from "./polytope3d.ts";

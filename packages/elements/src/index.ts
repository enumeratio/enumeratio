// Importing any element module registers its custom element as a side effect.
import "./notatio-input.ts";
import "./notatio-output.ts";
import "./notatio-cell.ts";
import "./notatio-clock.ts";
import "./notatio-torus-square.ts";
import "./notatio-notebook.ts";
import "./notatio-worksheet.ts";
import "./notatio-tex.ts";
import "./notatio-figure.ts";
import "./notatio-plot.ts";
import "./notatio-plot3d.ts";
import "./notatio-polytope.ts";
import "./notatio-curve3d.ts";
import "./notatio-contourplot.ts";
import "./notatio-densityplot.ts";
import "./notatio-vectorplot.ts";
import "./notatio-polarplot.ts";
import "./notatio-listplot3d.ts";
import "./notatio-barchart3d.ts";
import "./notatio-chart.ts";
import "./notatio-graphplot.ts";
import "./notatio-complex-plot.ts";
import "./notatio-manipulate.ts";
import "./notatio-tangle.ts";
import "./notatio-code.ts";
import "./notatio-terminal.ts";
import "./notatio-collection-table.ts";

import type { NotatioCell } from "./notatio-cell.ts";
import type { NotatioCode } from "./notatio-code.ts";
import type { NotatioCollectionTable } from "./notatio-collection-table.ts";
import type { NotatioChart } from "./notatio-chart.ts";
import type { NotatioFigure } from "./notatio-figure.ts";
import type { NotatioGraphPlot } from "./notatio-graphplot.ts";
import type { NotatioInput } from "./notatio-input.ts";
import type { NotatioOutput } from "./notatio-output.ts";
import type { NotatioNotebook } from "./notatio-notebook.ts";
import type { NotatioPlot } from "./notatio-plot.ts";
import type { NotatioManipulate } from "./notatio-manipulate.ts";
import type { NotatioTangle } from "./notatio-tangle.ts";
import type { NotatioKnob } from "./notatio-knob.ts";
import type { NotatioToggler } from "./notatio-toggler.ts";
import type { NotatioDynamic } from "./notatio-dynamic.ts";
import type { NotatioWhen } from "./notatio-when.ts";
import type { NotatioPlot3d } from "./notatio-plot3d.ts";
import type { NotatioContourPlot } from "./notatio-contourplot.ts";
import type { NotatioDensityPlot } from "./notatio-densityplot.ts";
import type { NotatioPolarPlot } from "./notatio-polarplot.ts";
import type { NotatioVectorPlot } from "./notatio-vectorplot.ts";
import type { NotatioBarChart3d } from "./notatio-barchart3d.ts";
import type { NotatioListPlot3d } from "./notatio-listplot3d.ts";
import type { NotatioTerminal } from "./notatio-terminal.ts";
import type { NotatioTex } from "./notatio-tex.ts";

export { formOfHead, splitHead, stripHead, WRAPPER_HEADS, wrapHead } from "./heads.ts";
export { editorLatexOf, type InForm, toEditorLatex } from "./source.ts";
export { NotatioInput } from "./notatio-input.ts";
export { NotatioOutput } from "./notatio-output.ts";
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
export { NotatioPlot3d } from "./notatio-plot3d.ts";
export { NotatioPolytope } from "./notatio-polytope.ts";
export { Orbit, ORBIT_HINT, type OrbitHost, type OrbitView } from "./orbit.ts";
export { NotatioCurve3d } from "./notatio-curve3d.ts";
export { NotatioContourPlot } from "./notatio-contourplot.ts";
export { NotatioDensityPlot } from "./notatio-densityplot.ts";
export { NotatioVectorPlot, splitField } from "./notatio-vectorplot.ts";
export { NotatioPolarPlot } from "./notatio-polarplot.ts";
export { NotatioComplexPlot } from "./notatio-complex-plot.ts";
export { NotatioListPlot3d } from "./notatio-listplot3d.ts";
export { NotatioBarChart3d } from "./notatio-barchart3d.ts";
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
export { NotatioGraphPlot, type GraphType } from "./notatio-graphplot.ts";
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
export { KNOB_EVENT, type KnobChange, NotatioKnob } from "./notatio-knob.ts";
export { NotatioToggler } from "./notatio-toggler.ts";
export { NotatioDynamic } from "./notatio-dynamic.ts";
export { NotatioWhen } from "./notatio-when.ts";
export {
  boundEntry,
  complexLatex,
  cycleIndex,
  DEFAULT_PIXELS_PER_STEP,
  isIntegerKnob,
  looksLikeMath,
  numberLatex,
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
    "notatio-input": NotatioInput;
    "notatio-output": NotatioOutput;
    "notatio-cell": NotatioCell;
    "notatio-collection-table": NotatioCollectionTable;
    "notatio-notebook": NotatioNotebook;
    "notatio-tex": NotatioTex;
    "notatio-code": NotatioCode;
    "notatio-figure": NotatioFigure;
    "notatio-plot": NotatioPlot;
    "notatio-plot3d": NotatioPlot3d;
    "notatio-contourplot": NotatioContourPlot;
    "notatio-densityplot": NotatioDensityPlot;
    "notatio-vectorplot": NotatioVectorPlot;
    "notatio-polarplot": NotatioPolarPlot;
    "notatio-listplot3d": NotatioListPlot3d;
    "notatio-barchart3d": NotatioBarChart3d;
    "notatio-chart": NotatioChart;
    "notatio-graphplot": NotatioGraphPlot;
    "notatio-manipulate": NotatioManipulate;
    "notatio-tangle": NotatioTangle;
    "notatio-knob": NotatioKnob;
    "notatio-toggler": NotatioToggler;
    "notatio-dynamic": NotatioDynamic;
    "notatio-when": NotatioWhen;
    "notatio-terminal": NotatioTerminal;
  }
}
export { polytope3dSvg, type Polytope3dOptions } from "./polytope3d.ts";

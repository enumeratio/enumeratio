import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";

type NativeEvaluate = NonNullable<BoxedExpression["operatorDefinition"]>["evaluate"];
type EvaluateHandlerOptions = Parameters<NonNullable<NativeEvaluate>>[1];

// Graphics as *values*: an `Image` head, and a `Rasterize` that makes one.
//
// Rasterizing already existed as a library call (`@enumeratio/raster`, used to put
// pictures in the terminal), but a raster was never something an expression could be.
// That left anything wanting to show a picture reaching for a bespoke element instead
// of a value -- so a worksheet's screen had to special-case "a portrait" rather than
// simply compositing whatever its cells evaluated to.
//
// `Image` carries a URI rather than pixels. That keeps it serializable, keeps it the
// same value in Node and in a browser, and means the thing a page draws is the thing
// the expression holds. Wolfram's `Image` holds raw pixel data and can do arithmetic on
// it; this is the shape of that idea, not yet the substance of it.

/** Turns an SVG document into encoded raster bytes. Node supplies one; see `setRasterizer`. */
export type Rasterizer = (svg: string, options?: { width?: number }) => Uint8Array;

let rasterizer: Rasterizer | undefined;

/**
 * Install the rasterizer. Node does this on import of `@enumeratio/formats/node`, which
 * is where the native renderer lives; without one, `Rasterize` stays symbolic rather
 * than pretending. A browser has no synchronous path to pixels -- decoding an image is
 * asynchronous -- so it simply does not install one.
 */
export function setRasterizer(fn: Rasterizer | undefined): void {
  rasterizer = fn;
}

/** Base64 for bytes, in either environment. */
function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** A `data:` URI for `bytes` of the given media type. */
export const dataUri = (bytes: Uint8Array, mimeType: string): string =>
  `data:${mimeType};base64,${toBase64(bytes)}`;

/** An SVG document as a `data:` URI — no decoding, so it works anywhere. */
export const svgDataUri = (svg: string): string =>
  `data:image/svg+xml;base64,${toBase64(new TextEncoder().encode(svg))}`;

/** The URI an `Image` expression carries, or undefined if it is not one. */
export function imageUri(expr: BoxedExpression | undefined): string | undefined {
  const json = expr?.json as unknown;
  if (!Array.isArray(json) || json[0] !== "Image") return undefined;
  const first = json[1];
  if (typeof first === "string") return stripQuotes(first);
  if (typeof first === "object" && first !== null && "str" in first) {
    const str = (first as { str?: unknown }).str;
    if (typeof str === "string") return str;
  }
  return undefined;
}

/** MathJSON keeps a string literal in quotes; a URI should not carry them. */
const stripQuotes = (s: string): string =>
  s.length >= 2 && s.startsWith("'") && s.endsWith("'") ? s.slice(1, -1) : s;

/** The SVG source a value carries, if it carries one. */
function svgOf(expr: BoxedExpression): string | undefined {
  const json = expr.json as unknown;
  if (typeof json === "string") {
    const text = stripQuotes(json);
    return text.trimStart().startsWith("<svg") ? text : undefined;
  }
  if (typeof json === "object" && json !== null && "str" in json) {
    const str = (json as { str?: unknown }).str;
    if (typeof str === "string" && str.trimStart().startsWith("<svg")) return str;
  }
  return undefined;
}

/**
 * Declare the graphics heads:
 * - `Image(uri)` — a picture as a value. It is already what it is, so it evaluates to
 *   itself; what it is *for* is being drawn by whatever is showing the expression.
 * - `Rasterize(graphic)` — an SVG document rendered to pixels, as an `Image`.
 */
/**
 * The heads that draw. Each names a picture rather than a value -- Wolfram's `Plot`,
 * `Histogram`, `Manipulate` print as pictures, not formulas -- and each has a component
 * of the same name (kebab-cased, `notatio-` in front) that is its rendering; the
 * argument-to-attribute map lives with the components (`@enumeratio/components/symbols`).
 * Here they are declared so the engine can *hold* one: `Plot(Sin(x), (x, 0, 10))` is an
 * expression a REPL prints, a cell evaluates to, a worksheet composites. Evaluation
 * leaves them alone, and a `Manipulate` body keeps its free parameters because a free
 * symbol evaluates to itself.
 */
export const GRAPHICS_HEADS: readonly string[] = [
  "Plot",
  "Plot3D",
  "ContourPlot",
  "DensityPlot",
  "PolarPlot",
  "VectorPlot",
  "StreamPlot",
  "ComplexPlot",
  "ListPlot",
  "ListLinePlot",
  "ListPlot3D",
  "BarChart",
  "BarChart3D",
  "Histogram",
  "PieChart",
  "BoxWhiskerChart",
  "ArrayPlot",
  "DiscretePlot",
  "Chart",
  "GraphPlot",
  "TreeGraph",
  "LayeredGraphPlot",
  "Dendrogram",
  "CollectionTable",
  "Manipulate",
  // The controls (Wolfram's Control family) and the layout that arranges them: an
  // expression over these draws as an interface, with the controls' variables bound
  // through the page (design/components-and-symbols.md).
  "Slider",
  "VerticalSlider",
  "Animator",
  "Knob",
  "Slider2D",
  "IntervalSlider",
  "SetterBar",
  "RadioButtonBar",
  "TogglerBar",
  "Toggler",
  "PopupMenu",
  "ListPicker",
  "Checkbox",
  "ColorSlider",
  "Locator",
  "InputField",
  "Dynamic",
  "Row",
  "Column",
  "Grid",
  "Panel",
  "Labeled",
];

export function declareGraphics(ce: ComputeEngine): void {
  // Inert: no `evaluate`, so the expression stays what it says, while its arguments
  // are canonicalised as usual -- an iterator typed as `(x, 0, 10)` in LaTeX arrives as a
  // `Tuple`, not a `Delimiter`, and a free parameter stays a free symbol. A head the
  // engine already knows (its own `Histogram`) is handled below rather than redeclared.
  for (const head of GRAPHICS_HEADS) {
    if (ce.lookupDefinition(head)) continue;
    ce.declare(head, { signature: "(any*) -> any" });
  }

  // The engine's own `Histogram(data, bins)` computes the bins and rejects a lone
  // argument at the signature. Wolfram's one-argument `Histogram[data]` is the picture;
  // widen the slot so it holds, and hand two arguments straight back to the native
  // handler. The signature otherwise mirrors the engine's, so nothing else changes.
  const histogram = ce.lookupDefinition("Histogram");
  const native: NativeEvaluate =
    histogram !== undefined && "operator" in histogram ? histogram.operator.evaluate : undefined;
  if (native !== undefined) {
    ce.declare("Histogram", {
      signature: "(collection<any>, (list<number> | number)?) -> any",
      evaluate: (ops: readonly BoxedExpression[], options: EvaluateHandlerOptions) =>
        ops.length === 1 ? undefined : native(ops, options),
    });
  }

  ce.declare("Image", {
    signature: "(string, number?, number?) -> expression",
    // A literal: evaluating it further would only take it apart.
    evaluate: (ops) => ce.box(["Image", ...ops.map((o) => o.json)] as never),
  });

  ce.declare("Rasterize", {
    signature: "(any, number?) -> expression",
    evaluate: (ops) => {
      const source = ops[0];
      if (!source) return undefined;
      // Already a picture: nothing to do.
      if (imageUri(source) !== undefined) return source;
      const svg = svgOf(source);
      if (svg === undefined) return undefined;
      if (!rasterizer) {
        // No pixels available here, but the document is still a picture a page can
        // draw, so hand back an Image rather than nothing.
        return ce.box(["Image", { str: svgDataUri(svg) }] as never);
      }
      const width = ops[1]?.re;
      const png = rasterizer(svg, Number.isFinite(width) ? { width } : undefined);
      return ce.box(["Image", { str: dataUri(png, "image/png") }] as never);
    },
  });
}

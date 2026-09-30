# @enumeratio/formats

A Wolfram-style format registry — `Import`/`Export` over MathJSON, Wolfram Language, TeX,
AsciiMath, MathML, code targets (Python/JS/GLSL/WGSL), and images. Reach for this when
you have a boxed expression and need it as text in some notation, or text in some
notation and need it back as an expression.

## Entry points

- `.` — the registry (`registerFormat`, `getFormat`, `exportTo`, `importFrom`,
  `fileFormat`, `sniffFormat`, `mimeTypeToFormatList`) and the built-in formats,
  registered as a side effect of import.
- `./node` — adds the PNG codec (needs the native rasterizer, [`raster`](../raster/README.md)) and
  file I/O (`writeFormat`/`readFormat`); also registers the browser-safe formats, so a
  Node consumer imports just this.
- `./expression` — `parseExpression`/`serializeExpression`: Epsil in and out, the syntax
  every `notatio-*` attribute and editable cell is written in. No statements or effects
  (assignment, declarations, pragmas) — `parseExpression` reports those rather than
  evaluating them.
- `./inputform` — `toInputForm`: an expression printed as Epsil you could retype, with a
  normalization pass over compute-engine's raw and canonical serializations (written in
  [`engine`](../engine/README.md), re-exported here).
- `./tex` — `portableTeX`: compute-engine's LaTeX rewritten for a document (amsmath/amssymb
  macros in place of MathLive-only commands like `\imaginaryI`).
- `./mathml`, `./asciimath` — MathMLForm and AsciiMath, built on [`boxes`](../boxes/README.md)'s
  presentation tree.

## Usage

```ts
import { exportTo, fileFormat, getFormat, importFrom } from "@enumeratio/formats";

exportTo(box(["Binomial", 10, 3]), "WL"); // "Binomial[10, 3]"
exportTo(box(["Add", ["Power", "x", 2], 1]), "JavaScript"); // contains "x"
importFrom("Binomial[10, 3]", "WL"); // ["Binomial", 10, 3]

getFormat("numpy")?.name; // "Python"
fileFormat("out/plot.png")?.name; // "PNG"
```

A format name resolves case-insensitively and by alias (`numpy` → `Python`,
`WolframLanguage` → `WL`). Text formats consume a boxed compute-engine expression; image
formats consume an SVG string — the registry stays value-agnostic about which.

## Graphics as values

`Image` and `Rasterize` (`declareGraphics`) let an expression hold a picture rather than
a bespoke element special-casing it: `Image` carries a URI, so it serializes and behaves
the same in Node and a browser. `setRasterizer` installs the pixel-producing backend;
[`raster`](../raster/README.md) supplies Node's.

## Where to go next

- [`/reference/formats/`](https://enumeratio.dev/reference/formats/) — every form and syntax, with worked
  examples (InputForm, LaTeX, MathJSON, AsciiMath).
- [`boxes`](../boxes/README.md) — the presentation tree these serializers and MathML/AsciiMath
  parsers are built on.
- [Boxes](https://github.com/enumeratio/enumeratio/wiki/Boxes) — the design behind boxes and the
  formats built on them.

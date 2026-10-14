---
name: RasterBox
domain: Boxes
signature: RasterBox(options)
summary: "A pixel grid in a drawing's coordinates: one color per cell in `Colors`, spread over `DataRange`."
signatures:
  - call: RasterBox(options)
    description: "A pixel grid in a drawing's coordinates: one color per cell in `Colors`, spread over `DataRange`."
    library: enumeratio-boxes
    type: (expression*) -> boxes
seeAlso:
  - GraphicsBox
  - PolygonBox
names:
  wolframIdentity: true
---

- A Wolfram `Raster` in a `Graphics`; `DensityPlot`, `ListDensityPlot`, a filled `ContourPlot` and `ComplexPlot` lower to one inside a `GraphicsBox`.
- `Colors` are rows of colors, the first row at the least y of `DataRange` (`((xmin, xmax), (ymin, ymax))`), each row left to right. A cell that is not a color is left clear. Colors are resolved before the box is built, so a drawer needs no gradient table.
- A raster with a `Producer` holds no cells: the environment fills it from the expression its `GraphicsBox` holds (`ComplexPlot`'s WebGPU shader on the web, a CPU evaluation elsewhere).
- Prints as `-Graphics-` in text, as Wolfram does.
- Wolfram writes the cells and the corners positionally (`RasterBox[data, ((xmin, ymin), (xmax, ymax)), (zmin, zmax)]`) and colors them with a `ColorFunction`; here they ride as options.

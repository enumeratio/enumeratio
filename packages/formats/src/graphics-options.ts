// Engine-free, so a page that only draws can read it without loading compute-engine.

/**
 * The options a graphics head declares. An argument `Name -> v` is an option of its head exactly
 * when `Name` is listed for that head; any other rule is an argument, so a layer's
 * `ColorRules -> [IsPrime -> Teal]` keeps `IsPrime -> Teal` as a rule. The markup reader reads a
 * child element named for one of these as that option (`<Show><PlotLabel>…</PlotLabel></Show>`).
 * Wolfram's names where Wolfram has the option; `ColorMixing`, `Selection` and `GestureHandling`
 * are ours.
 */
export const GRAPHICS_OPTIONS: Readonly<Record<string, readonly string[]>> = {
  Show: [
    "AspectRatio",
    "Axes",
    "AxesStyle",
    "Ticks",
    "GridLines",
    "GridLinesStyle",
    "PlotLabel",
    "Selection",
    "GestureHandling",
    "ImageSize",
    // Read only by a camera frame (`PolytopeFaces`).
    "ViewPoint",
    "ViewVertical",
    "ViewAngle",
    "ViewCenter",
    "SphericalRegion",
    "ProjectionMatrix",
    "Magnification",
  ],
  LatticeTiles: ["ColorRules", "ColorMixing", "BoundaryStyle", "Embedding"],
  ArrayPlot: ["ColorRules", "ColorMixing", "BoundaryStyle"],
  StrandDiagram: ["ColorRules", "ColorMixing", "BoundaryStyle"],
  CellDiagram: ["ColorRules", "ColorMixing", "BoundaryStyle"],
  TreeDiagram: ["ColorRules", "ColorMixing", "BoundaryStyle"],
  PathDiagram: ["ColorRules", "ColorMixing", "BoundaryStyle"],
  PolytopeFaces: ["ColorRules", "ColorMixing", "BoundaryStyle", "MeshCellLabel", "PlotLabel"],
  Locator: ["LocatorAutoCreate", "Appearance"],
};

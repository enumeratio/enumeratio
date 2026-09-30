# @enumeratio/raster

Rasterize a themeable SVG string to PNG — Wolfram's `Rasterize`, for Node. No DOM: it
renders statically via `resvg`, so it works in a CLI or a server the same as it would in
a browser.

## Usage

```ts
import { rasterize, rasterizeToDataUri } from "@enumeratio/raster";

const png = rasterize(svg, { width: 400 }); // Uint8Array, PNG magic bytes 0x89 0x50 0x4E 0x47
const uri = rasterizeToDataUri(svg, { scale: 2 }); // "data:image/png;base64,…"
```

`resvg` doesn't resolve CSS custom properties, so `flattenCss` runs first and collapses
the themeable `var(--x, fallback)` / `currentColor` the renderers in
[`frontend`](../frontend/README.md) emit down to concrete colours — innermost fallback first, then
whatever's left (a `var()` with no fallback, or `currentColor`) to a single substitute
colour (`FlattenOptions.color`, default a dark grey).

## Where it's used

`@enumeratio/cli` writes plots to the terminal (iTerm2/kitty inline images) through this;
[`formats`](../formats/README.md)'s `./node` entry installs it as the format registry's PNG
rasterizer via `setRasterizer`, so `Export(plot, "PNG")` and the `Image`/`Rasterize`
heads have a real backend in Node.

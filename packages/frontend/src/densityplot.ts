// Pure density-plot geometry: a sampled grid in, a heatmap SVG out. Shares
// contour.ts's `grid[j][i]` row-major convention (z at the i-th x, j-th y
// sample) so the two can be driven from the same sampling code. Colours come
// from a sequential ramp between two theme custom properties, so the plot
// reads correctly in light and dark.

const ACCENT = "var(--notatio-accent, var(--vp-c-brand-1, #d97706))";
const AXIS = "var(--notatio-border, var(--vp-c-divider, currentColor))";
const FG = "var(--notatio-fg, currentColor)";
const RAMP_LO = "var(--notatio-series-2, #2f7ed8)";

const n2 = (x: number): string => String(Math.round(x * 100) / 100);

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function label(x: number): string {
  if (!Number.isFinite(x)) return "";
  if (x === 0) return "0";
  const abs = Math.abs(x);
  return abs >= 1000 || abs < 0.01 ? x.toExponential(1) : String(Math.round(x * 100) / 100);
}

type Grid = readonly (readonly number[])[];

/**
 * Position of `v` in `[min, max]`, clamped to `[0, 1]`. A degenerate range
 * maps everything to the middle of the ramp rather than to an endpoint.
 */
export function normalize(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return Number.NaN;
  if (!(max > min)) return 0.5;
  return Math.max(0, Math.min(1, (v - min) / (max - min)));
}

/** The sequential ramp: cool at t = 0, accent at t = 1. */
export function densityColor(t: number): string {
  return `color-mix(in srgb, ${ACCENT} ${n2(Math.max(0, Math.min(1, t)) * 100)}%, ${RAMP_LO})`;
}

export interface DensityOptions {
  width?: number;
  height?: number;
  /** Draw the axis frame with range labels (default true). */
  axes?: boolean;
  /** Draw a vertical colour bar with min/max labels (default false). */
  legend?: boolean;
  /** Explicit colour-scale bounds; otherwise the sampled min/max. */
  zRange?: readonly [number, number];
  xLabel?: string;
  yLabel?: string;
  title?: string;
}

const frame = (w: number, h: number, body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="density plot">${body}</svg>`;

function titleSvg(w: number, title: string | undefined): string {
  return title
    ? `<text x="${n2(w / 2)}" y="14" text-anchor="middle" font-size="12" font-family="ui-sans-serif, system-ui, sans-serif" fill="${FG}">${esc(title)}</text>`
    : "";
}

/**
 * Render `grid` (sampled at `xs` × `ys`) as a heatmap: one cell per sample,
 * shaded by the sequential ramp (Wolfram's `DensityPlot` / `ListDensityPlot`).
 * Cells are centred on their sample and overlap by a hairline so no seams show
 * between them. A non-finite sample leaves its cell unpainted.
 */
export function densitySvg(
  grid: Grid,
  xs: readonly number[],
  ys: readonly number[],
  opts: DensityOptions = {},
): string {
  const W = opts.width ?? 340;
  const H = opts.height ?? 200;
  const mL = 38;
  const mR = opts.legend ? 44 : 10;
  const mT = opts.title ? 26 : 12;
  const mB = 22;

  const ny = grid.length;
  const nx = ny > 0 ? grid[0].length : 0;
  if (nx < 1 || ny < 1 || xs.length < nx || ys.length < ny) return frame(W, H, titleSvg(W, opts.title));

  const flat = grid.flat().filter(Number.isFinite);
  if (flat.length === 0) return frame(W, H, titleSvg(W, opts.title));
  const zmin = opts.zRange ? opts.zRange[0] : Math.min(...flat);
  const zmax = opts.zRange ? opts.zRange[1] : Math.max(...flat);

  const plotW = W - mL - mR;
  const plotH = H - mT - mB;
  const cw = plotW / nx;
  const ch = plotH / ny;

  // Cells are laid out by sample index; the row order only flips if `ys`
  // itself descends (screen y grows downward, data y grows upward).
  const yUp = ny < 2 || ys[ny - 1] >= ys[0];
  const xUp = nx < 2 || xs[nx - 1] >= xs[0];

  let cells = "";
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const t = normalize(grid[j][i], zmin, zmax);
      if (!Number.isFinite(t)) continue;
      const x = mL + (xUp ? i : nx - 1 - i) * cw;
      const y = mT + (yUp ? ny - 1 - j : j) * ch;
      cells += `<rect x="${n2(x)}" y="${n2(y)}" width="${n2(cw + 0.4)}" height="${n2(ch + 0.4)}" fill="${densityColor(t)}"/>`;
    }
  }

  const xlo = Math.min(...xs.slice(0, nx));
  const xhi = Math.max(...xs.slice(0, nx));
  const ylo = Math.min(...ys.slice(0, ny));
  const yhi = Math.max(...ys.slice(0, ny));

  let chrome = "";
  if (opts.axes !== false) {
    chrome += `<rect x="${n2(mL)}" y="${n2(mT)}" width="${n2(plotW)}" height="${n2(plotH)}" fill="none" stroke="${AXIS}" stroke-width="1" opacity="0.5"/>`;
    const text = (x: number, y: number, anchor: string, s: string): string =>
      `<text x="${n2(x)}" y="${n2(y)}" text-anchor="${anchor}" font-size="10" font-family="ui-monospace, monospace" fill="${FG}" opacity="0.6">${s}</text>`;
    chrome +=
      text(mL, H - 6, "start", label(xlo)) +
      text(mL + plotW, H - 6, "end", label(xhi)) +
      text(mL - 4, mT + 6, "end", label(yhi)) +
      text(mL - 4, H - mB, "end", label(ylo));
    if (opts.xLabel)
      chrome += `<text x="${n2(mL + plotW)}" y="${n2(mT + 10)}" text-anchor="end" font-size="10" font-style="italic" font-family="ui-monospace, monospace" fill="${FG}" opacity="0.75">${esc(opts.xLabel)}</text>`;
    if (opts.yLabel)
      chrome += `<text x="${n2(mL + 4)}" y="${n2(mT + 10)}" text-anchor="start" font-size="10" font-style="italic" font-family="ui-monospace, monospace" fill="${FG}" opacity="0.75">${esc(opts.yLabel)}</text>`;
  }

  // A discrete colour bar (16 bands) -- gradients need a defs id and add
  // nothing here, where the ramp is already quantised by the cell grid.
  if (opts.legend) {
    const bx = mL + plotW + 8;
    const bw = 10;
    const bands = 16;
    const bh = plotH / bands;
    for (let k = 0; k < bands; k++) {
      const t = (bands - 1 - k) / (bands - 1);
      chrome += `<rect x="${n2(bx)}" y="${n2(mT + k * bh)}" width="${bw}" height="${n2(bh + 0.4)}" fill="${densityColor(t)}"/>`;
    }
    chrome += `<rect x="${n2(bx)}" y="${n2(mT)}" width="${bw}" height="${n2(plotH)}" fill="none" stroke="${AXIS}" stroke-width="1" opacity="0.5"/>`;
    const t = (x: number, y: number, s: string): string =>
      `<text x="${n2(x)}" y="${n2(y)}" text-anchor="start" font-size="9" font-family="ui-monospace, monospace" fill="${FG}" opacity="0.6">${s}</text>`;
    chrome += t(bx + bw + 2, mT + 7, label(zmax)) + t(bx + bw + 2, mT + plotH, label(zmin));
  }

  return frame(W, H, cells + chrome + titleSvg(W, opts.title));
}

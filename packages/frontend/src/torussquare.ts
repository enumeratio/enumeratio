// The torus as a square with its opposite edges glued, and a torus knot as a straight line on
// it.
//
// A torus is two circles multiplied together, and the whole of T(p, q) is visible in that: the
// knot is the path that goes p times round one circle while it goes q times round the other. On
// the square that path is a STRAIGHT LINE of slope q/p, and everything about the knot — that
// T(p,q) and T(q,p) are the same knot, that a winding number of 1 unknots it, that gcd > 1 is
// not a knot but a link — is a fact about that line.
//
// So the figure draws three things that share one parameter: the square with the line on it,
// and the two circles themselves, each with the same travelling point shown as an angle. Watch
// the point and the two windings come apart — one dial turns p times while the other turns q.

const n2 = (v: number): string => (Math.round(v * 100) / 100).toString();
const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const INK = "var(--notatio-fg, currentColor)";
const FAINT = "var(--vp-c-divider, #ddd)";
const ACCENT = "var(--notatio-accent, #b8860b)";
/** The two circle factors keep the same two colours everywhere in the figure: the square's
 *  axes, the dials, and the edge arrows. The colours ARE the argument. */
const HOLE = "hsl(205 70% 45%)";
const TUBE = "hsl(340 65% 50%)";

/** A segment of the line, in square coordinates — both ends within `[0, 1]`. */
export interface Strand {
  readonly from: readonly [number, number];
  readonly to: readonly [number, number];
}

/**
 * The line of slope q/p on the glued square, cut into the segments that fit inside it.
 *
 * The cuts are exactly where a coordinate reaches a whole number — `t = k/p` or `t = k/q` — so
 * they are computed rather than found by watching for a jump. Between two consecutive cuts the
 * path is straight and stays inside the square, and subtracting the whole turn taken at the
 * segment's MIDPOINT is what brings it back into `[0, 1]` without ever having to test which
 * edge was crossed.
 */
export function strands(p: number, q: number): Strand[] {
  if (!Number.isInteger(p) || !Number.isInteger(q) || p < 1 || q < 1) return [];
  const cuts = new Set<number>([0, 1]);
  for (let k = 1; k < p; k++) cuts.add(k / p);
  for (let k = 1; k < q; k++) cuts.add(k / q);
  const ordered = [...cuts].sort((a, b) => a - b);
  const out: Strand[] = [];
  for (let i = 0; i + 1 < ordered.length; i++) {
    const a = ordered[i]!;
    const b = ordered[i + 1]!;
    const middle = (a + b) / 2;
    const turnsU = Math.floor(p * middle);
    const turnsV = Math.floor(q * middle);
    out.push({
      from: [p * a - turnsU, q * a - turnsV],
      to: [p * b - turnsU, q * b - turnsV],
    });
  }
  return out;
}

/** Where the travelling point is on the square at a given phase. */
export const atPhase = (p: number, q: number, phase: number): [number, number] => {
  const t = ((phase % 1) + 1) % 1;
  return [p * t - Math.floor(p * t), q * t - Math.floor(q * t)];
};

export interface TorusSquareOptions {
  readonly width?: number;
  readonly height?: number;
  /** Where the travelling point sits, in `[0, 1)`. Omit for a figure with no point on it. */
  readonly phase?: number;
  /** Draw the two circle factors beside the square (default true). */
  readonly dials?: boolean;
  readonly title?: string;
}

/** One circle factor, with the travelling point shown as an angle on it. */
function dial(
  cx: number,
  cy: number,
  r: number,
  turns: number,
  phase: number | undefined,
  colour: string,
  caption: string,
): string {
  const parts = [
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${colour}" stroke-width="1.5" stroke-opacity="0.55"/>`,
  ];
  if (phase !== undefined) {
    // `turns` full revolutions over one cycle — this is where the winding number becomes
    // something you can watch rather than something you are told.
    const angle = 2 * Math.PI * turns * phase - Math.PI / 2;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    parts.push(
      `<line x1="${cx}" y1="${cy}" x2="${n2(x)}" y2="${n2(y)}" stroke="${colour}" stroke-width="1.2" stroke-opacity="0.5"/>`,
      `<circle cx="${n2(x)}" cy="${n2(y)}" r="4" fill="${colour}"/>`,
    );
  }
  parts.push(
    `<text x="${cx}" y="${cy + r + 14}" text-anchor="middle" font-size="9" fill="${colour}">${esc(caption)}</text>`,
  );
  return parts.join("");
}

/** The square picture for T(p, q). */
export function torusSquareSvg(p: number, q: number, options: TorusSquareOptions = {}): string {
  const W = options.width ?? 360;
  const H = options.height ?? 260;
  const showDials = options.dials !== false;
  const side = Math.min(H - 74, showDials ? W - 150 : W - 60);
  const left = showDials ? 34 : (W - side) / 2;
  const top = 34;
  // Square coordinates run bottom-to-top, as a reader expects of an axis, so the page's
  // downward y is flipped here rather than in every caller.
  const sx = (u: number): number => left + u * side;
  const sy = (v: number): number => top + (1 - v) * side;

  const parts: string[] = [
    `<rect x="${left}" y="${top}" width="${side}" height="${side}" fill="none" stroke="${FAINT}" stroke-width="1"/>`,
  ];

  // The gluing, as arrowheads on the edges: a single chevron on the pair that is identified one
  // way and a double one on the other, which is how this square is drawn everywhere.
  const chevron = (x: number, y: number, rotate: number, colour: string, twice: boolean): string =>
    `<g transform="translate(${n2(x)} ${n2(y)}) rotate(${rotate})" stroke="${colour}" stroke-width="1.6" fill="none" stroke-linecap="round">` +
    `<path d="M-4 -4L0 0L-4 4"/>${twice ? `<path d="M-9 -4L-5 0L-9 4"/>` : ""}</g>`;
  const mid = left + side / 2;
  const middleY = top + side / 2;
  parts.push(
    chevron(mid, top, 0, HOLE, false),
    chevron(mid, top + side, 0, HOLE, false),
    chevron(left, middleY, 90, TUBE, true),
    chevron(left + side, middleY, 90, TUBE, true),
  );

  for (const strand of strands(p, q))
    parts.push(
      `<line x1="${n2(sx(strand.from[0]))}" y1="${n2(sy(strand.from[1]))}" x2="${n2(
        sx(strand.to[0]),
      )}" y2="${n2(sy(strand.to[1]))}" stroke="${INK}" stroke-width="1.8" stroke-opacity="0.75" stroke-linecap="round"/>`,
    );

  if (options.phase !== undefined) {
    const [u, v] = atPhase(p, q, options.phase);
    // Guide lines down to the axes: they are what ties the point on the square to the two
    // angles beside it.
    parts.push(
      `<line x1="${n2(sx(u))}" y1="${n2(sy(v))}" x2="${n2(sx(u))}" y2="${n2(sy(0))}" stroke="${HOLE}" stroke-width="1" stroke-dasharray="2 2" stroke-opacity="0.7"/>`,
      `<line x1="${n2(sx(u))}" y1="${n2(sy(v))}" x2="${n2(sx(0))}" y2="${n2(sy(v))}" stroke="${TUBE}" stroke-width="1" stroke-dasharray="2 2" stroke-opacity="0.7"/>`,
      `<circle cx="${n2(sx(u))}" cy="${n2(sy(v))}" r="5.5" fill="var(--notatio-bg, #fff)"/>`,
      `<circle class="notatio-square-marker" cx="${n2(sx(u))}" cy="${n2(sy(v))}" r="4" fill="${ACCENT}"/>`,
    );
  }

  parts.push(
    `<text x="${mid}" y="${top + side + 20}" text-anchor="middle" font-size="9" fill="${HOLE}">round the hole ×${p}</text>`,
    `<text x="${left - 8}" y="${middleY}" text-anchor="middle" font-size="9" fill="${TUBE}" transform="rotate(-90 ${left - 8} ${middleY})">round the tube ×${q}</text>`,
  );

  if (showDials) {
    const cx = W - 56;
    parts.push(
      dial(cx, top + 34, 28, p, options.phase, HOLE, `×${p}`),
      dial(cx, top + 120, 28, q, options.phase, TUBE, `×${q}`),
    );
  }

  const title = options.title ?? `T(${p}, ${q}) on the glued square`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">` +
    `<text x="${W / 2}" y="16" text-anchor="middle" font-size="12" fill="${INK}">${esc(title)}</text>` +
    `${parts.join("")}</svg>`
  );
}

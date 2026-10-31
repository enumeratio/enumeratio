// Page-space SVG glyphs for combinatorial collection elements: a permutation
// draws as its matrix, a partition as a Ferrers diagram, a composition as a
// divided bar, a subset as a row of cells, a Dyck path as a mountain range.
// A value is a flat integer list, or nested (tableau rows, set-composition blocks,
// tree children) for the kinds that need it.
// Each is a pure `(element) -> svg string` function -- the geometry can then be
// injected anywhere. Colours are CSS custom properties (--notatio-accent /
// -border / -fg), so a glyph inherits the surrounding surface's theme.

const ACCENT = "var(--notatio-accent, var(--vp-c-brand-1, #d97706))";
const ACCENT_FILL = `color-mix(in srgb, ${ACCENT} 16%, transparent)`;
const BORDER = "var(--notatio-border, var(--vp-c-divider, currentColor))";
const FG = "var(--notatio-fg, currentColor)";

/** Trim a coordinate to at most 2 decimals, printing whole numbers bare. */
const n2 = (x: number): string => String(Math.round(x * 100) / 100);

const svg = (viewBox: string, label: string, body: string): string => {
  // A dimension can be NaN mid-substitution (e.g. a Manipulate wildcard `_n` not
  // yet filled, so `Number("_n")` is NaN). Emit an empty but valid box rather than
  // a broken viewBox the browser rejects; the real value re-renders a moment later.
  if (viewBox.split(/\s+/).some((v) => !Number.isFinite(Number(v)))) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" role="img" aria-label="${label}"></svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-label="${label}">${body}</svg>`;
};

/**
 * Permutation matrix: an n×n grid with one filled dot per row `i` at column
 * `image[i]` (1-based one-line notation, e.g. `[3,1,2]`).
 */
export function permutationSvg(image: number[], unit = 22): string {
  const n = Math.max(1, image.length);
  const side = n2(n * unit + 2);
  let grid = "";
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      grid += `<rect x="${n2(c * unit)}" y="${n2(r * unit)}" width="${unit}" height="${unit}" fill="none" stroke="${BORDER}" stroke-width="1" opacity="0.4"/>`;
  let dots = "";
  image.forEach((col, i) => {
    const cx = n2((col - 0.5) * unit);
    const cy = n2((i + 0.5) * unit);
    dots += `<circle cx="${cx}" cy="${cy}" r="${n2(unit * 0.32)}" fill="${ACCENT}"/>`;
  });
  return svg(`-1 -1 ${side} ${side}`, "permutation matrix", grid + dots);
}

/**
 * Signed permutation matrix: the permutation grid of `|image[i]|`, a filled dot
 * where the entry is positive and a ring with a bar through it where it is
 * negative (one-line notation, e.g. `[2,-1,3]`).
 */
export function signedPermutationSvg(image: number[], unit = 22): string {
  const n = Math.max(1, image.length);
  const side = n2(n * unit + 2);
  let grid = "";
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      grid += `<rect x="${n2(c * unit)}" y="${n2(r * unit)}" width="${unit}" height="${unit}" fill="none" stroke="${BORDER}" stroke-width="1" opacity="0.4"/>`;
  let dots = "";
  image.forEach((value, i) => {
    const cx = (Math.abs(value) - 0.5) * unit;
    const cy = (i + 0.5) * unit;
    const r = unit * 0.32;
    dots +=
      value < 0
        ? `<circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(r)}" fill="none" stroke="${ACCENT}" stroke-width="2"/>` +
          `<line x1="${n2(cx - r * 0.6)}" y1="${n2(cy)}" x2="${n2(cx + r * 0.6)}" y2="${n2(cy)}" stroke="${ACCENT}" stroke-width="2" stroke-linecap="round"/>`
        : `<circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(r)}" fill="${ACCENT}"/>`;
  });
  return svg(`-1 -1 ${side} ${side}`, "signed permutation matrix", grid + dots);
}

/**
 * Ferrers (Young) diagram: left-aligned rows of unit boxes, row `i` holding
 * `parts[i]` boxes (parts stored non-increasing, e.g. `[3,1]`).
 */
export function ferrersSvg(parts: number[], unit = 18): string {
  const rows = Math.max(1, parts.length);
  const cols = Math.max(1, parts[0] ?? 0);
  const w = n2(cols * unit + 2);
  const h = n2(rows * unit + 2);
  let body = "";
  parts.forEach((part, i) => {
    for (let j = 0; j < part; j++)
      body += `<rect x="${n2(j * unit)}" y="${n2(i * unit)}" width="${unit}" height="${unit}" rx="1.5" fill="${ACCENT_FILL}" stroke="${ACCENT}" stroke-width="1"/>`;
  });
  return svg(`-1 -1 ${w} ${h}`, "Ferrers diagram", body);
}

/**
 * Young tableau: a Ferrers shape whose cells carry entries, English convention.
 * Given the rows (`[[1,2],[3]]`) it draws that filling. Given just the partition
 * `parts` (`[2,1]`), the cells are numbered `1…n` in reading order (row by row)
 * -- the "superstandard" filling, always a valid standard Young tableau.
 */
export function tableauSvg(shape: number[] | number[][], unit = 20): string {
  let entry = 1;
  const rowsOf: number[][] = (shape as unknown[]).every(Array.isArray)
    ? (shape as number[][])
    : (shape as number[]).map((part) => Array.from({ length: part }, () => entry++));
  const rows = Math.max(1, rowsOf.length);
  const cols = Math.max(1, ...rowsOf.map((r) => r.length));
  const w = n2(cols * unit + 2);
  const h = n2(rows * unit + 2);
  const wide = rowsOf.some((r) => r.some((v) => String(v).length > 2));
  let body = "";
  rowsOf.forEach((row, i) => {
    row.forEach((value, j) => {
      const x = j * unit;
      const y = i * unit;
      body +=
        `<rect x="${n2(x)}" y="${n2(y)}" width="${unit}" height="${unit}" rx="1.5" fill="${ACCENT_FILL}" stroke="${ACCENT}" stroke-width="1"/>` +
        `<text x="${n2(x + unit / 2)}" y="${n2(y + unit / 2)}" text-anchor="middle" dominant-baseline="central" font-size="${n2(unit * (wide ? 0.38 : 0.5))}" font-family="ui-monospace, monospace" fill="${FG}">${value}</text>`;
    });
  });
  return svg(`-1 -1 ${w} ${h}`, "Young tableau", body);
}

/**
 * Composition bar: a divided strip, one labelled segment per part, each
 * segment's width proportional to the part's value -- so a composition of `n`
 * reads as a bar of total width ∝ n however its parts are cut (e.g. `[2,1]`).
 */
export function compositionSvg(parts: number[], unit = 18, height = 22): string {
  const total = Math.max(
    1,
    parts.reduce((s, p) => s + p, 0),
  );
  const w = n2(total * unit + 2);
  const h = n2(height + 2);
  let x = 0;
  let body = "";
  for (const part of parts) {
    const segW = part * unit;
    const mid = n2(x + segW / 2);
    body +=
      `<rect x="${n2(x)}" y="0" width="${n2(segW)}" height="${n2(height)}" rx="1.5" fill="${ACCENT_FILL}" stroke="${ACCENT}" stroke-width="1"/>` +
      `<text x="${mid}" y="${n2(height / 2)}" text-anchor="middle" dominant-baseline="central" font-size="${n2(height * 0.5)}" fill="${FG}">${part}</text>`;
    x += segW;
  }
  return svg(`-1 -1 ${w} ${h}`, "composition bar", body);
}

/**
 * Subset cells: a row of `n` cells, the cells in `members` (1-based) filled and
 * labelled, the rest empty -- the membership mask of a subset of {1,…,n}.
 * `n` defaults to the largest member.
 */
export function subsetSvg(members: number[], n = Math.max(1, ...members), unit = 22): string {
  const cells = Math.max(1, n);
  const w = n2(cells * unit + 2);
  const h = n2(unit + 2);
  const inSet = new Set(members);
  let body = "";
  for (let k = 1; k <= cells; k++) {
    const x = (k - 1) * unit;
    const member = inSet.has(k);
    body +=
      `<rect x="${n2(x)}" y="0" width="${unit}" height="${unit}" rx="1.5" fill="${member ? ACCENT_FILL : "none"}" stroke="${member ? ACCENT : BORDER}" stroke-width="1" ${member ? "" : 'opacity="0.5"'}/>` +
      `<text x="${n2(x + unit / 2)}" y="${n2(unit / 2)}" text-anchor="middle" dominant-baseline="central" font-size="${n2(unit * 0.45)}" fill="${FG}" opacity="${member ? "1" : "0.4"}">${k}</text>`;
  }
  return svg(`-1 -1 ${w} ${h}`, "subset cells", body);
}

/**
 * Dyck path: a mountain range from up/down steps (`1` = up NE, `0` = down SE),
 * e.g. `[1,0,1,1,0,0]`. The staircase never dips below the baseline.
 */
export function dyckSvg(steps: number[], unit = 16): string {
  const pts: Array<[number, number]> = [[0, 0]];
  let y = 0;
  let maxH = 0;
  steps.forEach((s, i) => {
    y += s ? 1 : -1;
    maxH = Math.max(maxH, y);
    pts.push([i + 1, y]);
  });
  const cols = Math.max(1, steps.length);
  const height = Math.max(1, maxH);
  const w = n2(cols * unit + 2);
  const h = n2(height * unit + 2);
  // SVG y grows downward, so flip: baseline sits at the bottom, peaks rise.
  const coords = pts.map(([px, py]) => `${n2(px * unit)},${n2((height - py) * unit)}`).join(" ");
  const baseline = `<line x1="0" y1="${n2(height * unit)}" x2="${n2(cols * unit)}" y2="${n2(height * unit)}" stroke="${BORDER}" stroke-width="1" opacity="0.4"/>`;
  const path = `<polyline points="${coords}" fill="none" stroke="${ACCENT}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  return svg(`-1 -1 ${w} ${h}`, "Dyck path", baseline + path);
}

/**
 * Rooted tree from a preorder child-count word: `counts[i]` is how many
 * children the i-th node in preorder has. A binary tree's shape word `1100100`
 * (1 = internal, 0 = leaf) maps to counts `[2,2,0,0,2,0,0]`; a plane tree's
 * degree sequence is already this word. Layout is the tidy rule: leaves take
 * sequential x left-to-right, each internal node sits at the mean x of its
 * children, y = depth. Returns `{ parent, depth, x }` per preorder node.
 */
export function treeLayout(counts: readonly number[]): {
  parent: number[];
  depth: number[];
  x: number[];
} {
  const n = counts.length;
  const parent = Array.from({ length: n }, () => -1);
  const depth = Array.from({ length: n }, () => 0);
  // Preorder: a node's children follow it directly, before any sibling's
  // subtree, so a stack of ancestors still owed children decodes the word.
  const stack: Array<{ id: number; remaining: number }> = [];
  for (let i = 0; i < n; i++) {
    const top = stack[stack.length - 1];
    if (top) {
      parent[i] = top.id;
      depth[i] = depth[top.id] + 1;
      if (--top.remaining === 0) stack.pop();
    }
    if (counts[i] > 0) stack.push({ id: i, remaining: counts[i] });
  }
  const x = Array.from({ length: n }, () => 0);
  const kids: number[][] = Array.from({ length: n }, () => []);
  let leaf = 0;
  for (let i = 0; i < n; i++) {
    if (parent[i] >= 0) kids[parent[i]].push(i);
    if (counts[i] === 0) x[i] = leaf++;
  }
  // Children have larger preorder indices, so a backward pass sees them placed.
  for (let i = n - 1; i >= 0; i--)
    if (kids[i].length > 0) x[i] = kids[i].reduce((s, k) => s + x[k], 0) / kids[i].length;
  return { parent, depth, x };
}

/**
 * Rooted-tree glyph: nodes as circles, parent→child edges as lines, drawn from
 * the preorder child-count word (see `treeLayout`). `binary` reads the word as
 * a binary shape word instead (1 = internal node with two children, 0 = leaf).
 */
export function treeSvg(word: number[], opts: { binary?: boolean } = {}, unit = 20, r = 5): string {
  const counts = opts.binary ? word.map((b) => (b ? 2 : 0)) : word;
  const { parent, depth, x } = treeLayout(counts);
  const n = counts.length;
  if (n === 0) return svg("-1 -1 2 2", "tree", "");
  const leaves = Math.max(1, counts.filter((c) => c === 0).length);
  const maxDepth = Math.max(0, ...depth);
  const cx = (i: number): string => n2((x[i] + 0.5) * unit);
  const cy = (i: number): string => n2(depth[i] * unit + r);
  let edges = "";
  let nodes = "";
  for (let i = 0; i < n; i++) {
    if (parent[i] >= 0)
      edges += `<line x1="${cx(parent[i])}" y1="${cy(parent[i])}" x2="${cx(i)}" y2="${cy(i)}" stroke="${BORDER}" stroke-width="1.5"/>`;
    nodes += `<circle cx="${cx(i)}" cy="${cy(i)}" r="${r}" fill="${ACCENT_FILL}" stroke="${ACCENT}" stroke-width="1"/>`;
  }
  const w = n2(leaves * unit + 2);
  const h = n2(maxDepth * unit + 2 * r + 2);
  return svg(`-1 -1 ${w} ${h}`, "tree", edges + nodes);
}

/**
 * Rounded pills, one per block of elements, left to right. `arrows` puts a small
 * triangle in each gap, so the order of the blocks reads as part of the picture.
 */
function pillsSvg(blocks: readonly (readonly number[])[], label: string, arrows: boolean, unit = 22): string {
  const gap = arrows ? 14 : 8;
  if (blocks.length === 0) return svg("-1 -1 24 24", label, "");
  const h = n2(unit + 2);
  let x = 0;
  let body = "";
  blocks.forEach((els, b) => {
    const pillW = els.length * unit;
    body += `<rect x="${n2(x)}" y="0" width="${n2(pillW)}" height="${n2(unit)}" rx="${n2(unit / 2)}" fill="${ACCENT_FILL}" stroke="${ACCENT}" stroke-width="1"/>`;
    els.forEach((el, k) => {
      body += `<text x="${n2(x + (k + 0.5) * unit)}" y="${n2(unit / 2)}" text-anchor="middle" dominant-baseline="central" font-size="${n2(unit * 0.45)}" font-family="ui-monospace, monospace" fill="${FG}">${el}</text>`;
    });
    x += pillW;
    if (arrows && b < blocks.length - 1)
      body += `<polygon points="${n2(x + 4)},${n2(unit / 2 - 4)} ${n2(x + 4)},${n2(unit / 2 + 4)} ${n2(x + gap - 4)},${n2(unit / 2)}" fill="${BORDER}"/>`;
    x += gap;
  });
  return svg(`-1 -1 ${n2(x - gap + 2)} ${h}`, label, body);
}

/**
 * Set partition from a restricted-growth string: `rgs[i]` is the block id of
 * element `i+1`, with `rgs[0] = 0` and `rgs[i] <= 1 + max(rgs[0..i-1])` (the
 * canonical encoding). Each block draws as a rounded pill of its elements, in
 * first-appearance order -- e.g. `[0,0,1,0,2]` is `{1,2,4} {3} {5}`.
 */
export function setPartitionSvg(rgs: number[], unit = 22): string {
  const order: number[] = [];
  const blocks = new Map<number, number[]>();
  rgs.forEach((b, i) => {
    if (!blocks.has(b)) {
      blocks.set(b, []);
      order.push(b);
    }
    blocks.get(b)?.push(i + 1);
  });
  return pillsSvg(
    order.map((b) => blocks.get(b) ?? []),
    "set partition",
    false,
    unit,
  );
}

/**
 * Set composition: the blocks of an ordered set partition, in order, as pills
 * with an arrow between consecutive ones -- e.g. `[[3],[1,2]]` is `{3} → {1,2}`.
 */
export function setCompositionSvg(blocks: number[][], unit = 22): string {
  return pillsSvg(blocks, "set composition", true, unit);
}

/** A nested tree value: a list is a node holding its children, anything else a leaf. */
export type NestedTree = number | readonly NestedTree[];

/**
 * Tree from nested lists -- a binary or k-ary tree (a leaf `0`, a node the list of its
 * children) or an ordered tree (a leaf `[]`) -- drawn as `treeSvg` draws the same tree's
 * preorder child-count word.
 */
export function nestedTreeSvg(tree: NestedTree, unit = 20, r = 5): string {
  const counts: number[] = [];
  const walk = (t: NestedTree): void => {
    if (Array.isArray(t)) {
      counts.push(t.length);
      t.forEach(walk);
    } else counts.push(0);
  };
  walk(tree);
  return treeSvg(counts, {}, unit, r);
}

/**
 * Diagram-algebra diagram: two rows of `n` dots — the top row 1…n and the bottom row
 * 1′…n′ — with each block of the partition joined up. `rgs[i]` is the block id of
 * point `i`, the first `n` entries reading along the top row and the rest along the
 * bottom. Arcs within a row bow into the box, so a cup and a cap are distinguishable;
 * strands between rows run straight down. This is the picture the product acts on:
 * stacking two of these and reading off what stays connected.
 */
export function diagramSvg(rgs: number[], unit = 26): string {
  const n = Math.max(1, Math.floor(rgs.length / 2));
  const height = unit * 1.7;
  const at = (index: number): { x: number; y: number } => ({
    x: (index % n) * unit + unit / 2,
    y: index < n ? 0 : height,
  });

  const blocks = new Map<number, number[]>();
  rgs.slice(0, 2 * n).forEach((id, index) => {
    blocks.set(id, [...(blocks.get(id) ?? []), index]);
  });

  // The conventional frame: the diagram lives in a box, and every arc bows inward.
  let body = `<rect x="${n2(-unit / 2 + 1)}" y="${n2(-unit * 0.18)}" width="${n2(n * unit - 2)}" height="${n2(height + unit * 0.36)}" rx="3" fill="none" stroke="${BORDER}" stroke-width="1" opacity="0.45"/>`;
  for (const points of blocks.values()) {
    // Draw the block as a chain: top row left to right, then bottom row left to right.
    const ordered = [...points].toSorted((a, b) => Math.floor(a / n) - Math.floor(b / n) || a - b);
    for (let k = 1; k < ordered.length; k++) {
      const from = at(ordered[k - 1]!);
      const to = at(ordered[k]!);
      if (from.y === to.y) {
        // Same row: an arc bowing into the middle of the box.
        const bow = from.y === 0 ? height * 0.42 : -height * 0.42;
        body += `<path d="M${n2(from.x)} ${n2(from.y)} Q${n2((from.x + to.x) / 2)} ${n2(from.y + bow)} ${n2(to.x)} ${n2(to.y)}" fill="none" stroke="${ACCENT}" stroke-width="1.6"/>`;
      } else {
        // Between rows: a gentle S, so crossings read clearly.
        const mid = height / 2;
        body += `<path d="M${n2(from.x)} ${n2(from.y)} C${n2(from.x)} ${n2(mid)} ${n2(to.x)} ${n2(mid)} ${n2(to.x)} ${n2(to.y)}" fill="none" stroke="${ACCENT}" stroke-width="1.6"/>`;
      }
    }
  }
  for (let index = 0; index < 2 * n; index++) {
    const { x, y } = at(index);
    body += `<circle cx="${n2(x)}" cy="${n2(y)}" r="${n2(unit * 0.13)}" fill="${FG}"/>`;
  }
  // Arcs bow INWARD, so the drawing occupies the box and a little margin — no more.
  const pad = unit * 0.26;
  return svg(`${n2(-unit / 2)} ${n2(-pad)} ${n2(n * unit)} ${n2(height + 2 * pad)}`, "diagram", body);
}

/**
 * Lattice path: a monotone staircase of unit steps from the bottom-left corner,
 * on the grid it spans -- east (`0`), north (`1`), or diagonal north-east (`2`,
 * the Delannoy step), e.g. `[0,1,1,0]` walks E, N, N, E across a 2×2 grid.
 * Counts `C(a+b, a)` for `a` easts and `b` norths when there are no diagonals.
 */
export function latticePathSvg(steps: number[], unit = 20): string {
  const a = steps.filter((s) => s === 0 || s === 2).length; // east + diagonal -> width
  const b = steps.filter((s) => s !== 0).length; // north + diagonal -> height
  const cols = Math.max(1, a);
  const rows = Math.max(1, b);
  const w = n2(cols * unit + 2);
  const h = n2(rows * unit + 2);
  // SVG y grows downward; a north step should rise, so flip via (rows - y).
  const px = (gx: number): number => gx * unit;
  const py = (gy: number): number => (rows - gy) * unit;
  let grid = "";
  for (let i = 0; i <= cols; i++)
    grid += `<line x1="${n2(px(i))}" y1="0" x2="${n2(px(i))}" y2="${n2(rows * unit)}" stroke="${BORDER}" stroke-width="0.5" opacity="0.3"/>`;
  for (let j = 0; j <= rows; j++)
    grid += `<line x1="0" y1="${n2(py(j))}" x2="${n2(cols * unit)}" y2="${n2(py(j))}" stroke="${BORDER}" stroke-width="0.5" opacity="0.3"/>`;
  const pts: Array<[number, number]> = [[0, 0]];
  let gx = 0;
  let gy = 0;
  for (const s of steps) {
    if (s === 0 || s === 2) gx++;
    if (s !== 0) gy++;
    pts.push([gx, gy]);
  }
  const coords = pts.map(([x, y]) => `${n2(px(x))},${n2(py(y))}`).join(" ");
  const path = `<polyline points="${coords}" fill="none" stroke="${ACCENT}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  return svg(`-1 -1 ${w} ${h}`, "lattice path", grid + path);
}

/**
 * A walk from the origin: each token of `steps` moves `move(token)` = (dx, dy),
 * drawn as a polyline over a baseline at height 0. The picture is as tall as the
 * path's range, so a path that dips below the axis (a Łukasiewicz path's last
 * step lands on -1) still fits.
 */
function walkSvg(
  steps: number[],
  label: string,
  move: (token: number) => { dx: number; dy: number },
  unit = 16,
): string {
  const pts: Array<[number, number]> = [[0, 0]];
  let x = 0;
  let y = 0;
  for (const s of steps) {
    const { dx, dy } = move(s);
    x += dx;
    y += dy;
    pts.push([x, y]);
  }
  const top = Math.max(0, ...pts.map((p) => p[1]));
  const bottom = Math.min(0, ...pts.map((p) => p[1]));
  const width = Math.max(1, x);
  const height = Math.max(1, top - bottom);
  const w = n2(width * unit + 2);
  const h = n2(height * unit + 2);
  const coords = pts.map(([px, py]) => `${n2(px * unit)},${n2((top - py) * unit)}`).join(" ");
  const baseline = `<line x1="0" y1="${n2(top * unit)}" x2="${n2(width * unit)}" y2="${n2(top * unit)}" stroke="${BORDER}" stroke-width="1" opacity="0.4"/>`;
  const path = `<polyline points="${coords}" fill="none" stroke="${ACCENT}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  return svg(`-1 -1 ${w} ${h}`, label, baseline + path);
}

/** Motzkin path: up (`1`), level (`0`) and down (`-1`) steps that never dip below the axis. */
export function motzkinSvg(steps: number[], unit = 16): string {
  return walkSvg(steps, "Motzkin path", (s) => ({ dx: 1, dy: s }), unit);
}

/** Schröder path: up (`1`), down (`-1`), and a level step two wide (`2`). */
export function schroederSvg(steps: number[], unit = 16): string {
  return walkSvg(steps, "Schröder path", (s) => ({ dx: s === 2 ? 2 : 1, dy: s === 2 ? 0 : s }), unit);
}

/** Łukasiewicz path: each entry is the rise of one step (children less one, `>= -1`). */
export function lukasiewiczSvg(steps: number[], unit = 16): string {
  return walkSvg(steps, "Łukasiewicz path", (s) => ({ dx: 1, dy: s }), unit);
}

export type GlyphKind =
  | "permutation"
  | "partition"
  | "tableau"
  | "composition"
  | "subset"
  | "dyck"
  | "tree"
  | "binary-tree"
  | "set-partition"
  | "lattice"
  | "diagram"
  | "motzkin"
  | "schroeder"
  | "lukasiewicz"
  | "nested-tree"
  | "signed-permutation"
  | "set-composition";

/** Every kind `renderGlyph` draws; what a row source or a carrier record may name. */
export const GLYPH_KINDS: ReadonlySet<string> = new Set<GlyphKind>([
  "permutation",
  "partition",
  "tableau",
  "composition",
  "subset",
  "dyck",
  "tree",
  "binary-tree",
  "set-partition",
  "lattice",
  "diagram",
  "motzkin",
  "schroeder",
  "lukasiewicz",
  "nested-tree",
  "signed-permutation",
  "set-composition",
]);

/** What a glyph draws: a flat integer list, or the nested lists a tableau, set composition or tree is. */
export type GlyphValue = number[] | number[][] | NestedTree;

/** Dispatch a glyph `kind` to its renderer over its `value` (the shape each kind reads is on its function). */
export function renderGlyph(kind: GlyphKind, value: GlyphValue, opts?: { n?: number }): string {
  const ints = value as number[];
  switch (kind) {
    case "permutation":
      return permutationSvg(ints);
    case "partition":
      return ferrersSvg(ints);
    case "tableau":
      return tableauSvg(value as number[] | number[][]);
    case "composition":
      return compositionSvg(ints);
    case "subset":
      return subsetSvg(ints, opts?.n);
    case "dyck":
      return dyckSvg(ints);
    case "tree":
      return treeSvg(ints);
    case "binary-tree":
      return treeSvg(ints, { binary: true });
    case "set-partition":
      return setPartitionSvg(ints);
    case "lattice":
      return latticePathSvg(ints);
    case "diagram":
      return diagramSvg(ints);
    case "motzkin":
      return motzkinSvg(ints);
    case "schroeder":
      return schroederSvg(ints);
    case "lukasiewicz":
      return lukasiewiczSvg(ints);
    case "nested-tree":
      return nestedTreeSvg(value as NestedTree);
    case "signed-permutation":
      return signedPermutationSvg(ints);
    case "set-composition":
      return setCompositionSvg(value as number[][]);
    default:
      throw new Error("unreachable: GlyphKind is exhaustive above");
  }
}

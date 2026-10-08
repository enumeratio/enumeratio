// The strand frame: a layer for `Show` whose addresses are (slot, level) and whose elements are the
// ends of strands. Level 0 is the in side, the last level the out side; the sign (-1, 0, +1) is
// derived. A strand is not an address but a block, a set of addresses, drawn as a curve between
// its cells. A permutation (two levels, every block through), a set partition (one level) and the
// diagram algebras' diagrams (two rows of n) are all this frame; so is `Compose(a, b)`, a stack
// of levels whose glued middle row is where closed loops live. A braid word is the same frame with
// a level per generator: its strands are blocks running from the in row to the out row, and the
// generator σᵢ^±1 at level k crosses the strands at slots i and i+1 on their way to level k + 1.
//
// Properties a layer publishes for rules: IsIn, IsOut, IsThrough (= IsPropagating), IsCap, IsCup,
// IsSingleton, IsLoop, IsCrossing (the block crosses another), and for a braid IsOver and IsUnder
// (the cell's strand passes over or under at its level's generator).
// Values: Slot, Level, Sign, Block, Size, Image, Crossings (other blocks crossed), and for a braid
// Exponent (±1 at a generator's two cells).
// Relations to the selection: SameBlock (= SameStrand), Crosses (a strand that crosses the
// selected one), Adjacent, Image, Above, Below.

import type { Vec2 } from "./lattice.ts";
import type { Address, FramePoint, GraphicsPrimitive, TileLayer } from "./tiles-canvas.ts";
import { unwrapped } from "./frame-json.ts";
import { fitView } from "./tiles-canvas.ts";

type Json = unknown;

const headOf = (json: Json): string | undefined =>
  Array.isArray(json) && typeof json[0] === "string" ? json[0] : undefined;
const argsOf = (json: Json): Json[] => (Array.isArray(json) ? json.slice(1) : []);

/** An integer, written as a number or `Negate(n)`. */
function intOf(json: Json): number | undefined {
  if (headOf(json) === "Negate") {
    const v = intOf(argsOf(json)[0]);
    return v === undefined ? undefined : -v;
  }
  const n =
    typeof json === "number" ? json : typeof json === "string" && json.trim() !== "" ? Number(json) : Number.NaN;
  return Number.isInteger(n) ? n : undefined;
}

const intsOf = (json: Json): number[] | undefined => {
  if (headOf(json) !== "List") return undefined;
  const xs = argsOf(json).map(intOf);
  return xs.every((x) => x !== undefined) ? (xs as number[]) : undefined;
};

/** A strand's stretch: the cells it joins, and the lower level of the rows it lies between. */
interface Piece {
  readonly cells: readonly Address[];
  readonly low: number;
  /** A braid strand passing under another at its crossing: drawn with a gap. */
  readonly under?: boolean;
}

/** What a strand diagram is: a grid of slots by levels, and the pieces of strand over it. */
export interface StrandModel {
  readonly slots: number;
  readonly levels: number;
  readonly pieces: readonly Piece[];
  /** A braid's word (letters ±i for σᵢ^±1): level k is generator k, the last level the out side. */
  readonly word?: readonly number[];
}

/** Top row first, left to right: the order a block reads in. */
const byReading = (a: Address, b: Address): number => b[1] - a[1] || a[0] - b[0];

const piece = (cells: readonly Address[], low: number): Piece => ({ cells: cells.toSorted(byReading), low });

/** Every cell of the grid in some piece; those the blocks leave out stand alone. */
function complete(slots: number, levels: number, pieces: Piece[]): StrandModel | string {
  const seen = new Set<string>();
  for (const p of pieces)
    for (const [s, l] of p.cells) {
      if (s < 1 || s > slots || l < 0 || l >= levels) return `FramePoint ${s} is outside the diagram.`;
      if (seen.has(`${s},${l}`)) return `FramePoint ${l === 0 && levels > 1 ? -s : s} is in two blocks.`;
      seen.add(`${s},${l}`);
    }
  const all = [...pieces];
  for (let l = 0; l < levels; l++)
    for (let s = 1; s <= slots; s++) if (!seen.has(`${s},${l}`)) all.push(piece([[s, l]], Math.max(0, l - 1)));
  return { slots, levels, pieces: all };
}

/** `Permutation([3, 1, 2])`: two levels, each slot's strand running through to its image. */
function permutationModel(image: readonly number[]): StrandModel | string {
  const n = image.length;
  if (n === 0 || [...image].toSorted((a, b) => a - b).some((v, k) => v !== k + 1))
    return "Permutation needs a rearrangement of 1 … n.";
  return complete(
    n,
    2,
    image.map((to, k) =>
      piece(
        [
          [k + 1, 0],
          [to, 1],
        ],
        0,
      ),
    ),
  );
}

/** `SetPartition([[1, 2], [3]])`: one level, a block a hyperedge over its slots. */
function setPartitionModel(blocks: readonly (readonly number[])[]): StrandModel | string {
  const n = Math.max(0, ...blocks.flat());
  if (blocks.flat().some((v) => v < 1)) return "SetPartition numbers its points from 1.";
  return complete(
    n,
    1,
    blocks.map((b) =>
      piece(
        b.map((s) => [s, 0] as const),
        0,
      ),
    ),
  );
}

/** `Diagram([[1, 2], [-1, -2]])`: two levels of n, positive labels on the out side, negative on the in side. */
function diagramModel(blocks: readonly (readonly number[])[]): StrandModel | string {
  const labels = blocks.flat();
  if (labels.some((v) => v === 0)) return "A diagram's points are ±1 … ±n.";
  const n = Math.max(0, ...labels.map(Math.abs));
  return complete(
    n,
    2,
    blocks.map((b) =>
      piece(
        b.map((v) => [Math.abs(v), v > 0 ? 1 : 0] as const),
        0,
      ),
    ),
  );
}

/** The most pieces a braid draws: strands times generators. */
const MAX_BRAID_PIECES = 2000;

/** `Braid(3, [1, -2])`: a level per generator, each strand running up to the next level, two of them swapping. */
function braidModel(strands: number, word: readonly number[]): StrandModel | string {
  if (!Number.isInteger(strands) || strands < 1 || strands > 64) return "Braid needs 1 … 64 strands.";
  if (!word.every((g) => g !== 0 && Math.abs(g) < strands))
    return `A braid on ${strands} strands has letters ±1 … ±${strands - 1}.`;
  const bands = Math.max(1, word.length);
  if (strands * bands > MAX_BRAID_PIECES) return "That braid is too long to draw.";
  const pieces: Piece[] = [];
  for (let k = 0; k < bands; k++) {
    const g = word[k];
    const i = Math.abs(g ?? 0);
    for (let s = 1; s <= strands; s++) {
      const to = g !== undefined && s === i ? i + 1 : g !== undefined && s === i + 1 ? i : s;
      // σᵢ passes the strand from slot i over the one from i + 1; σᵢ⁻¹ the other way.
      const under = to !== s && (s === i) === g! < 0;
      pieces.push({
        ...piece(
          [
            [s, k],
            [to, k + 1],
          ],
          k,
        ),
        ...(under ? { under } : {}),
      });
    }
  }
  return { slots: strands, levels: bands + 1, pieces, word };
}

/** `a` stacked above `b`, a's bottom row glued to b's top: the picture a product is defined by. */
export function compose(a: StrandModel, b: StrandModel): StrandModel | string {
  if (a.levels < 2 || b.levels < 2) return "Compose needs diagrams with an in side and an out side.";
  if (a.slots !== b.slots) return "Compose needs diagrams on the same number of strands.";
  const lift = b.levels - 1;
  const raised = a.pieces.map((p) => ({
    ...p,
    cells: p.cells.map(([s, l]) => [s, l + lift] as const),
    low: p.low + lift,
  }));
  return { slots: a.slots, levels: a.levels + lift, pieces: [...b.pieces, ...raised] };
}

/** The model an expression names: `Permutation`, `SetPartition`, `Diagram`, or a `Compose` of them. */
export function strandModelOf(node: Json): StrandModel | string {
  const json = unwrapped(node);
  const head = headOf(json);
  const [arg] = argsOf(json);
  if (head === "Permutation") {
    const image = intsOf(arg);
    return image ? permutationModel(image) : "Permutation needs a list: Permutation([3, 1, 2]).";
  }
  if (head === "Braid") {
    const strands = intOf(arg);
    const word = argsOf(json)[1] === undefined ? [] : intsOf(argsOf(json)[1]);
    return strands !== undefined && word
      ? braidModel(strands, word)
      : "Braid needs a strand count and a word: Braid(3, [1, -2]).";
  }
  const blocks = argsOf(arg).map(intsOf);
  const listed = headOf(arg) === "List" && blocks.every((b) => b !== undefined);
  if (head === "SetPartition")
    return listed ? setPartitionModel(blocks as number[][]) : "SetPartition needs blocks: SetPartition([[1, 2], [3]]).";
  if (head === "Diagram")
    return listed ? diagramModel(blocks as number[][]) : "Diagram needs blocks of signed labels: Diagram([[1, -1]]).";
  if (head === "Compose") {
    const parts = argsOf(json).map(strandModelOf);
    const bad = parts.find((p) => typeof p === "string");
    if (bad !== undefined) return bad as string;
    if (parts.length < 2) return "Compose needs two diagrams or more.";
    let acc = parts[0] as StrandModel;
    for (const next of parts.slice(1)) {
      const c = compose(acc, next as StrandModel);
      if (typeof c === "string") return c;
      acc = c;
    }
    return acc;
  }
  return "StrandDiagram needs Permutation(…), SetPartition(…), Diagram(…), Braid(…) or Compose(…).";
}

const SUBSCRIPTS = "₀₁₂₃₄₅₆₇₈₉";

/** A word's letter as the generator it names: 2 is σ₂, -2 is σ₂⁻¹. */
const letterText = (g: number): string =>
  `σ${String(Math.abs(g))
    .split("")
    .map((d) => SUBSCRIPTS[Number(d)])
    .join("")}${g < 0 ? "⁻¹" : ""}`;

// ── The layer ────────────────────────────────────────────────────────────────────────────

/** Vertical distance between levels, in slot spacings. */
const GAP = 1.6;
/** How far the arcs within a row bow into the frame, as a fraction of a level gap. */
const BOW = 0.42;
const DISK = 0.11;
/** A braid's cells are larger, so the color of a crossing shows inside the strand's own stroke. */
const BRAID_DISK = 0.2;
const STEPS = 16;
/** Half the share of an under-strand's length left blank at its crossing. */
const UNDER_GAP = 0.12;

/** A strand layer as `Show` reads it: the tile contract, and its own title, grid and descriptions. */
export interface StrandLayer extends TileLayer {
  readonly title: string;
  readonly grid: readonly [Vec2, Vec2];
  readonly model: StrandModel;
  gridLabel(axis: 0 | 1, k: number): string;
  summary(): readonly (readonly [string, string])[];
  describe(i: number, j: number): { title: string; rows: readonly (readonly [string, string])[] };
}

/** The curve between two cells, sampled: an S between rows, an arc bowing into the rows' frame within one. */
function between(a: Address, b: Address, low: number, rowOnly: boolean): FramePoint[] {
  const [p, q] = [[a[0], a[1] * GAP] as const, [b[0], b[1] * GAP] as const];
  const out: FramePoint[] = [];
  if (a[1] !== b[1]) {
    const mid = (p[1] + q[1]) / 2;
    for (let k = 0; k <= STEPS; k++) {
      const t = k / STEPS;
      const u = 1 - t;
      const w = [u ** 3, 3 * u * u * t, 3 * u * t * t, t ** 3] as const;
      out.push([(w[0] + w[1]) * p[0] + (w[2] + w[3]) * q[0], w[0] * p[1] + (w[1] + w[2]) * mid + w[3] * q[1]]);
    }
    return out;
  }
  const dx = Math.abs(b[0] - a[0]);
  // Neighbors in a lone row run straight: a chain of them reads as a pill.
  if (rowOnly && dx === 1) return [p, q];
  const dir = rowOnly || a[1] === low ? 1 : -1;
  const bow = rowOnly ? 0.6 * dx : BOW * GAP;
  const c: FramePoint = [(p[0] + q[0]) / 2, p[1] + dir * bow];
  for (let k = 0; k <= STEPS; k++) {
    const t = k / STEPS;
    const u = 1 - t;
    out.push([u * u * p[0] + 2 * u * t * c[0] + t * t * q[0], u * u * p[1] + 2 * u * t * c[1] + t * t * q[1]]);
  }
  return out;
}

/** Whether two sets of positions around a strip's cycle interleave: a₁ < b < a₂ with another b outside. */
function interleaved(a: readonly number[], b: readonly number[]): boolean {
  for (let i = 0; i < a.length; i++)
    for (let j = i + 1; j < a.length; j++) {
      const [lo, hi] = [Math.min(a[i]!, a[j]!), Math.max(a[i]!, a[j]!)];
      if (b.some((x) => x > lo && x < hi) && b.some((x) => x < lo || x > hi)) return true;
    }
  return false;
}

/** A strand diagram as a layer for `Show`; the model's pieces become links, its cells marks. */
export function strandLayer(model: StrandModel): StrandLayer {
  const { slots, levels, pieces } = model;
  const top = levels - 1;
  const index = (s: number, l: number): number => l * slots + s - 1;
  const inside = (s: number, l: number): boolean => s >= 1 && s <= slots && l >= 0 && l < levels;

  // Blocks: the pieces' cells, merged where pieces share a cell (the glued row of a composition).
  const parent = Array.from({ length: slots * levels }, (_, k) => k);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x]!)));
  for (const p of pieces)
    for (const [s, l] of p.cells.slice(1)) parent[find(index(s, l))] = find(index(p.cells[0]![0], p.cells[0]![1]));
  // Ids in first-appearance order, top row first: a diagram's restricted-growth string.
  const ids = new Map<number, number>();
  for (let l = top; l >= 0; l--)
    for (let s = 1; s <= slots; s++) if (!ids.has(find(index(s, l)))) ids.set(find(index(s, l)), ids.size);
  const members = new Map<number, Address[]>();
  for (let l = top; l >= 0; l--)
    for (let s = 1; s <= slots; s++) {
      const id = ids.get(find(index(s, l)))!;
      members.set(id, [...(members.get(id) ?? []), [s, l]]);
    }
  const blockOf = (s: number, l: number): number => ids.get(find(index(s, l)))!;

  // Crossings: pieces of one strip cross when their ends interleave around the strip's cycle; a
  // block crosses the blocks whose pieces cross its own.
  const cycle = (p: Piece, [s, l]: Address): number => (levels === 1 || l === p.low + 1 ? s : 2 * slots + 1 - s);
  const keys = pieces.map((p) => p.cells.map((c) => cycle(p, c)));
  const strips = new Map<number, number[]>();
  pieces.forEach((p, k) => strips.set(p.low, [...(strips.get(p.low) ?? []), k]));
  const crossed = new Map<number, Set<number>>();
  for (const strip of strips.values())
    for (const [n, a] of strip.entries())
      for (const b of strip.slice(n + 1)) {
        const [x, y] = [blockOf(...pieces[a]!.cells[0]!), blockOf(...pieces[b]!.cells[0]!)];
        if (x === y || !interleaved(keys[a]!, keys[b]!)) continue;
        crossed.set(x, (crossed.get(x) ?? new Set()).add(y));
        crossed.set(y, (crossed.get(y) ?? new Set()).add(x));
      }
  const crossings = (s: number, l: number): number => crossed.get(blockOf(s, l))?.size ?? 0;
  const crosses = (s: number, l: number, t: number, m: number): boolean =>
    crossed.get(blockOf(s, l))?.has(blockOf(t, m)) ?? false;

  // A braid's generator at a level, as the letter of the word, when the cell is one of its two strands.
  const { word } = model;
  const letterAt = (s: number, l: number): number | undefined => {
    const g = word?.[l];
    return g !== undefined && (s === Math.abs(g) || s === Math.abs(g) + 1) ? g : undefined;
  };
  // σᵢ passes the strand from slot i over; σᵢ⁻¹ the strand from slot i + 1.
  const overAt = (s: number, l: number, g: number): boolean => (s === Math.abs(g)) === g > 0;

  // What a block is, by the sides it touches.
  const shape = (s: number, l: number) => {
    const cells = members.get(blockOf(s, l))!;
    const at = (level: number): number => cells.filter((c) => c[1] === level).length;
    const [ins, outs] = levels > 1 ? [at(0), at(top)] : [0, 0];
    return {
      cells,
      through: ins > 0 && outs > 0,
      cap: ins >= 2 && outs === 0,
      cup: outs >= 2 && ins === 0,
      loop: levels > 2 && ins === 0 && outs === 0 && cells.every((c) => c[1] > 0 && c[1] < top),
      singleton: cells.length === 1,
      ins,
      outs,
    };
  };

  const kindOf = (s: number, l: number): string => {
    const b = shape(s, l);
    return b.through
      ? "through"
      : b.cap
        ? "cap"
        : b.cup
          ? "cup"
          : b.loop
            ? "loop"
            : b.singleton
              ? "singleton"
              : "block";
  };

  /** The slot at the far side of a through strand, from an end cell. */
  const imageOf = (s: number, l: number): number | undefined => {
    const b = shape(s, l);
    if (!b.through || (l !== 0 && l !== top)) return undefined;
    return b.cells.find((c) => c[1] === (l === 0 ? top : 0))?.[0];
  };

  const label = ([s, l]: Address): string => (levels === 1 || l === top ? `${s}` : l === 0 ? `-${s}` : `${s}@${l}`);

  const links = pieces.map((p) => p.cells).filter((c) => c.length > 1);
  const pieceOf = new Map(pieces.map((p) => [p.cells, p] as const));

  const normal = (name: string): string => name.replace(/^Is(?=[A-Z])/, "").toLowerCase();

  return {
    title: `${word ? "Braid" : "Strand diagram"} on ${slots} ${slots === 1 ? "strand" : "strands"}`,
    model,
    view: "fixed",
    basis: [
      [1, 0],
      [0, 1],
    ],
    maxIndex: Math.max(slots, levels),
    bounds: { i: [1, slots], j: [0, top] },
    grid: [
      [1, 0],
      [0, 1],
    ],
    gridLabel: (_axis, k) => String(k),
    place: (s, l) => [s, l * GAP],
    mark: (): GraphicsPrimitive => ({ head: "Disk", radius: word ? BRAID_DISK : DISK }),
    links: () => links,
    linkMark: (link): GraphicsPrimitive => {
      const piece = pieceOf.get(link as readonly Address[]);
      const curve: FramePoint[] = [];
      for (let k = 1; k < link.length; k++)
        curve.push(...between(link[k - 1]!, link[k]!, piece?.low ?? 0, levels === 1).slice(k > 1 ? 1 : 0));
      // The strand passing under leaves a gap around the crossing, at the middle of its S.
      if (!piece?.under) return { head: "Line", points: curve };
      const gap = curve.map((_, k) => Math.abs(k / (curve.length - 1) - 0.5) < UNDER_GAP);
      const kept = curve.filter((_, k) => !gap[k]);
      return { head: "Line", points: kept, breaks: [gap.indexOf(true)] };
    },
    known: () => true,
    prepare: () => {},
    has: (s, l, name) => {
      if (!inside(s, l)) return undefined;
      const b = shape(s, l);
      switch (normal(name)) {
        case "in":
          return levels > 1 && l === 0;
        case "out":
          return levels > 1 && l === top;
        case "through":
        case "propagating":
          return b.through;
        case "cap":
          return b.cap;
        case "cup":
          return b.cup;
        case "loop":
          return b.loop;
        case "singleton":
          return b.singleton;
        case "crossing":
          return crossings(s, l) > 0;
        case "over":
        case "under": {
          if (!word) return undefined;
          const g = letterAt(s, l);
          return g !== undefined && overAt(s, l, g) === (normal(name) === "over");
        }
        case "unknown":
          return false;
      }
      return undefined;
    },
    value: (s, l, name) => {
      if (!inside(s, l)) return undefined;
      switch (normal(name)) {
        case "slot":
          return s;
        case "level":
          return l;
        case "sign":
          return levels === 1 ? 0 : l === 0 ? -1 : l === top ? 1 : 0;
        case "block":
          return blockOf(s, l);
        case "size":
          return shape(s, l).cells.length;
        case "image":
          return imageOf(s, l);
        case "crossings":
          return crossings(s, l);
        case "exponent": {
          const g = letterAt(s, l);
          return g === undefined ? undefined : Math.sign(g);
        }
      }
      return undefined;
    },
    relatedTo: (relation, [t, m], s, l) => {
      if (!inside(s, l) || !inside(t, m)) return false;
      switch (relation) {
        case "SameBlock":
        case "SameStrand":
          return blockOf(s, l) === blockOf(t, m);
        case "Crosses":
          return crosses(s, l, t, m);
        case "Adjacent":
          return l === m && Math.abs(s - t) === 1;
        // The far end of the selected strand.
        case "Image":
          return (
            blockOf(s, l) === blockOf(t, m) && shape(t, m).through && ((m === 0 && l === top) || (m === top && l === 0))
          );
        case "Above":
          return l > m;
        case "Below":
          return l < m;
      }
      return false;
    },
    summary: () =>
      word
        ? [
            ["strands", String(slots)],
            ["crossings", String(word.length)],
          ]
        : [
            ["strands", String(slots)],
            ["levels", String(levels)],
            ["blocks", String(members.size)],
          ],
    describe: (s, l) => {
      const rows: [string, string][] = [
        ["size", String(shape(s, l).cells.length)],
        ["kind", kindOf(s, l)],
      ];
      const image = imageOf(s, l);
      if (image !== undefined) rows.push(["image", String(image)]);
      rows.push(["crossings", String(crossings(s, l))]);
      if (!word) return { title: `{${shape(s, l).cells.map(label).join(", ")}}`, rows };
      const g = letterAt(s, l);
      if (g !== undefined) rows.push(["generator", `${letterText(g)}, ${overAt(s, l, g) ? "over" : "under"}`]);
      return { title: word.length === 0 ? "identity" : word.map(letterText).join(" "), rows };
    },
  };
}

// ── `Figure`, lowered ────────────────────────────────────────────────────────────────────

/** The glyph kinds that are strand frames. */
export const STRAND_KINDS: readonly string[] = ["permutation", "set-partition", "diagram"];

/** Pixels per slot spacing in a lowered figure. */
const FIGURE_UNIT = 24;

/** The default look: strands in the accent color, a selected block in white, its cells in gray. */
export const STRAND_DEFAULT_COLOR_RULES: Json = [
  "List",
  ["Rule", ["SameBlock", "Selected"], "White"],
  ["Rule", "True", "Gray"],
];
export const STRAND_DEFAULT_BOUNDARY_STYLE: Json = [
  "List",
  ["Rule", ["SameBlock", "Selected"], ["Directive", "White", ["AbsoluteThickness", 3]]],
  ["Rule", "True", ["Directive", "#d97706", ["AbsoluteThickness", 1.8]]],
];

const blocksOf = (rgs: readonly number[]): number[][] => {
  const blocks = new Map<number, number[]>();
  rgs.forEach((id, k) => blocks.set(id, [...(blocks.get(id) ?? []), k]));
  return [...blocks.values()];
};

/**
 * The strand glyph kinds (`permutation`, `set-partition`, `diagram`) as the `Show` they draw as: `value` is the glyph's
 * integer list (a permutation's one-line image, a restricted-growth string for a set partition, or
 * one over 2n points for a diagram), and the box is sized to the figure. Undefined for any other kind.
 */
export function lowerStrandFigure(
  kind: string,
  value: readonly number[],
): { readonly show: string; readonly width: number; readonly height: number } | undefined {
  if (!value.every(Number.isInteger)) return undefined;
  const half = value.length / 2;
  let name: string;
  let blocks: number[][];
  if (kind === "permutation") {
    name = "Permutation";
    blocks = [];
  } else if (kind === "set-partition") {
    name = "SetPartition";
    blocks = blocksOf(value).map((b) => b.map((k) => k + 1));
  } else if (kind === "diagram" && value.length > 0 && value.length % 2 === 0) {
    name = "Diagram";
    blocks = blocksOf(value).map((b) => b.map((k) => (k < half ? k + 1 : -(k - half + 1))));
  } else return undefined;
  const list = (xs: readonly (readonly number[])[]): string => `[${xs.map((x) => `[${x.join(", ")}]`).join(", ")}]`;
  const layer = name === "Permutation" ? `Permutation([${value.join(", ")}])` : `${name}(${list(blocks)})`;
  const model = strandModelOf(
    name === "Permutation" ? [name, ["List", ...value]] : [name, ["List", ...blocks.map((b) => ["List", ...b])]],
  );
  if (typeof model === "string") return undefined;
  const fit = fitView(strandLayer(model), 1e9);
  const [width, height] = [(model.slots - 1 + 1.2) * FIGURE_UNIT, 2 * fit.extent * FIGURE_UNIT];
  return {
    show: `Show(StrandDiagram(${layer}), ImageSize -> [Automatic, ${Math.round(height)}], GestureHandling -> "none")`,
    width: Math.round(width),
    height: Math.round(height),
  };
}

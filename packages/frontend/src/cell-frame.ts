// The cell frame: a layer for `Show` whose addresses are (row, column) cells of a Cartesian grid,
// numbered from 1 and drawn with row 1 on top. A partition (`IntegerPartition`), a tableau
// (`StandardTableau`), a composition (`Composition`) and a subset of 1…n (`Subset`) are all this
// frame; the first two are ragged, so only the cells they have are addresses. A composition's
// cells are its parts, drawn as wide as their value.
//
// Properties: IsFilled, IsCorner (a removable corner), IsInFirstRow, IsInFirstColumn, IsEntry
// (the cell carries a number). Values: Row, Column, Content (column − row), Hook (hook length),
// Arm, Leg, Entry, Part. Relations to the selection: SameRow, SameColumn, SameContent, Hook (the
// hook of the selected cell), Adjacent.

import {
  argsOf,
  carrierOf,
  type FigureLayer,
  headOf,
  intOf,
  intsOf,
  type Json,
  normal,
  UNIT_BASIS,
  unwrapped,
} from "./frame-json.ts";
import type { Address, FramePoint, GraphicsPrimitive } from "./tiles-canvas.ts";

interface Cell {
  readonly row: number;
  readonly column: number;
  readonly filled: boolean;
  /** The number the cell carries: a tableau's entry, a composition's part size, a subset's element. */
  readonly entry?: number;
  /** The part it belongs to, from 1: a partition's or tableau's row, a composition's part. */
  readonly part?: number;
  /** Unit cells wide: 1, except for a composition's parts. */
  readonly width: number;
  /** The unit column a composition's part starts at. */
  readonly start: number;
}

export interface CellModel {
  readonly kind: "partition" | "tableau" | "composition" | "subset";
  readonly cells: readonly Cell[];
  /** Row lengths of a ragged shape (partition, tableau): what a hook is measured against. */
  readonly shape?: readonly number[];
}

const positive = (xs: readonly number[] | undefined): xs is number[] => !!xs && xs.length > 0 && xs.every((x) => x > 0);
const descending = (xs: readonly number[]): boolean => xs.every((x, k) => k === 0 || x <= xs[k - 1]!);

function partitionModel(parts: readonly number[]): CellModel | string {
  if (!positive(parts) || !descending(parts))
    return "IntegerPartition needs positive parts, largest first: IntegerPartition([3, 1]).";
  return {
    kind: "partition",
    shape: parts,
    cells: parts.flatMap((p, r) =>
      Array.from({ length: p }, (_, c) => ({
        row: r + 1,
        column: c + 1,
        filled: true,
        part: r + 1,
        width: 1,
        start: c + 1,
      })),
    ),
  };
}

/** A tableau from its rows; rows that do not make a partition's shape are refused. */
function tableauModel(rows: readonly (readonly number[])[]): CellModel | string {
  const shape = rows.map((r) => r.length);
  if (!positive(shape) || !descending(shape))
    return "A tableau needs rows, longest first: StandardTableau([[1, 2], [3]]).";
  return {
    kind: "tableau",
    shape,
    cells: rows.flatMap((r, i) =>
      r.map((entry, c) => ({ row: i + 1, column: c + 1, filled: true, entry, part: i + 1, width: 1, start: c + 1 })),
    ),
  };
}

function compositionModel(parts: readonly number[]): CellModel | string {
  if (!positive(parts)) return "Composition needs positive parts: Composition([2, 1]).";
  let start = 1;
  const cells = parts.map((p, k) => {
    const cell = { row: 1, column: k + 1, filled: true, entry: p, part: k + 1, width: p, start };
    start += p;
    return cell;
  });
  return { kind: "composition", cells };
}

function subsetModel(members: readonly number[], n: number): CellModel | string {
  if (!Number.isInteger(n) || n < 1 || members.some((m) => m < 1 || m > n))
    return "Subset needs members of 1 … n: Subset([1, 3], 5).";
  const set = new Set(members);
  return {
    kind: "subset",
    cells: Array.from({ length: n }, (_, k) => ({
      row: 1,
      column: k + 1,
      filled: set.has(k + 1),
      entry: k + 1,
      width: 1,
      start: k + 1,
    })),
  };
}

/** The model an expression names: `IntegerPartition`, `StandardTableau`, `Composition` or `Subset`. */
export function cellModelOf(node: Json): CellModel | string {
  const json = unwrapped(node);
  const head = headOf(json);
  const [arg, size] = argsOf(json);
  if (head === "IntegerPartition") {
    const parts = intsOf(arg);
    return parts ? partitionModel(parts) : "IntegerPartition needs a list: IntegerPartition([3, 1]).";
  }
  if (head === "Composition") {
    const parts = intsOf(arg);
    return parts ? compositionModel(parts) : "Composition needs a list: Composition([2, 1]).";
  }
  if (head === "StandardTableau" || head === "SemistandardTableau" || head === "Tableau") {
    const rows = headOf(arg) === "List" ? argsOf(arg).map(intsOf) : [];
    return rows.length > 0 && rows.every((r) => r !== undefined)
      ? tableauModel(rows as number[][])
      : "A tableau needs its rows: StandardTableau([[1, 2], [3]]).";
  }
  if (head === "Subset" || head === "Finset") {
    // A subset as its carrier, `Finset(Tuple(n, members))`, bare or as `Subset`'s argument.
    const carrier = carrierOf(head === "Finset" ? json : arg);
    if (head === "Finset" && carrier === undefined) return "Finset needs its carrier: Finset(Tuple(5, [1, 3])).";
    const members = intsOf(carrier ? carrier.members : arg);
    if (!members) return "Subset needs a list: Subset([1, 3], 5).";
    const n = carrier ? carrier.n : size === undefined ? Math.max(1, ...members) : intOf(size);
    return subsetModel(members, n ?? Number.NaN);
  }
  return "CellDiagram needs IntegerPartition(…), StandardTableau(…), Composition(…), Subset(…) or Finset(…).";
}

/** Side of a cell's square, in cell widths: the rest is the gap between neighbors. */
const SIDE = 0.9;
/** Label height, in cell widths. */
const LABEL = 0.45;

/** A cell diagram as a layer for `Show`; each cell a square (a composition's part a bar) at (column, −row). */
export function cellLayer(model: CellModel): FigureLayer {
  const { cells, shape } = model;
  const byAddress = new Map(cells.map((c) => [`${c.row},${c.column}`, c] as const));
  const cellAt = (i: number, j: number): Cell | undefined => byAddress.get(`${i},${j}`);
  const rows = Math.max(...cells.map((c) => c.row));
  const columns = Math.max(...cells.map((c) => c.column));
  const center = (c: Cell): FramePoint => [c.start + (c.width - 1) / 2, -c.row];

  const arm = (c: Cell): number | undefined => (shape ? shape[c.row - 1]! - c.column : undefined);
  const leg = (c: Cell): number | undefined => (shape ? shape.filter((p) => p >= c.column).length - c.row : undefined);
  const hook = (c: Cell): number | undefined => (shape ? arm(c)! + leg(c)! + 1 : undefined);
  // Removable: nothing to its right and nothing below.
  const corner = (c: Cell): boolean => !!shape && arm(c) === 0 && leg(c) === 0;
  const inHook = (c: Cell, s: Cell): boolean =>
    !!shape && ((c.row === s.row && c.column >= s.column) || (c.column === s.column && c.row >= s.row));
  const title = {
    partition: "Ferrers diagram",
    tableau: "Young tableau",
    composition: "Composition",
    subset: "Subset",
  }[model.kind];

  return {
    title,
    view: "fixed",
    basis: UNIT_BASIS,
    maxIndex: Math.max(rows, columns),
    bounds: { i: [1, rows], j: [1, columns] },
    grid: UNIT_BASIS,
    gridLabel: (_axis, k) => String(k),
    addresses: () => cells.map((c): Address => [c.row, c.column]),
    place: (i, j) => {
      const c = cellAt(i, j);
      return c ? center(c) : [j, -i];
    },
    mark: (i, j): GraphicsPrimitive => {
      const c = cellAt(i, j);
      if (!c) return { head: "Disk", radius: 0 };
      const [x, y] = center(c) as [number, number];
      const [dx, dy] = [(c.width - (1 - SIDE)) / 2, SIDE / 2];
      return {
        head: "Polygon",
        points: [
          [x - dx, y - dy],
          [x + dx, y - dy],
          [x + dx, y + dy],
          [x - dx, y + dy],
        ],
      };
    },
    label: (i, j) => {
      const c = cellAt(i, j);
      if (!c || c.entry === undefined) return undefined;
      return { text: String(c.entry), size: LABEL, opacity: c.filled ? 1 : 0.4 };
    },
    known: () => true,
    prepare: () => {},
    has: (i, j, name) => {
      const c = cellAt(i, j);
      if (!c) return undefined;
      switch (normal(name)) {
        case "filled":
          return c.filled;
        case "corner":
          return corner(c);
        case "infirstrow":
          return c.row === 1;
        case "infirstcolumn":
          return c.column === 1;
        case "entry":
          return c.entry !== undefined;
        case "unknown":
          return false;
      }
      return undefined;
    },
    value: (i, j, name) => {
      const c = cellAt(i, j);
      if (!c) return undefined;
      switch (normal(name)) {
        case "row":
          return c.row;
        case "column":
          return c.column;
        case "content":
          return c.column - c.row;
        case "hook":
          return hook(c);
        case "arm":
          return arm(c);
        case "leg":
          return leg(c);
        case "entry":
          return c.entry;
        case "part":
          return c.part;
      }
      return undefined;
    },
    relatedTo: (relation, [t, m], i, j) => {
      const [c, s] = [cellAt(i, j), cellAt(t, m)];
      if (!c || !s) return false;
      switch (relation) {
        case "SameRow":
          return c.row === s.row;
        case "SameColumn":
          return c.column === s.column;
        case "SameContent":
          return c.column - c.row === s.column - s.row;
        case "Hook":
          return inHook(c, s);
        case "Adjacent":
          return Math.abs(c.row - s.row) + Math.abs(c.column - s.column) === 1;
      }
      return false;
    },
    summary: () => [
      ["cells", String(cells.length)],
      ["rows", String(rows)],
      ["columns", String(columns)],
    ],
    describe: (i, j) => {
      const c = cellAt(i, j);
      if (!c) return { title: `(${i}, ${j})`, rows: [] };
      const out: [string, string][] = [["content", String(c.column - c.row)]];
      if (c.entry !== undefined) out.push(["entry", String(c.entry)]);
      const h = hook(c);
      if (h !== undefined) out.push(["hook", `${h} (arm ${arm(c)}, leg ${leg(c)})`]);
      if (corner(c)) out.push(["corner", "removable"]);
      return { title: `cell (${c.row}, ${c.column})`, rows: out };
    },
  };
}

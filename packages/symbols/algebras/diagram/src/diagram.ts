// Diagrams: the combinatorial carrier the whole family is built on.
//
// A diagram on n strands is a SET PARTITION of 2n points — a top row 1…n and a bottom
// row 1′…n′ — drawn as two rows of dots with each block joined up. Multiplication is
// geometric: stack `a` above `b`, glue a's bottom row to b's top row, read off which of
// the outer points are now connected, and discard the middle. Every block that ends up
// living entirely in the discarded middle was a closed loop, and each one contributes a
// factor of the loop parameter δ.
//
// That single rule is the whole algebra. The named algebras differ only in WHICH
// diagrams they admit — all of them, or only the matchings, or only the planar ones —
// exactly as the hypercomplex families differed only in a square and a commutation
// rule. Points are labelled 1…n on top and −1…−n on the bottom, as in the literature.

/** A diagram: its point count per row, and its blocks over the labels ±1…±n. */
export interface Diagram {
  readonly strands: number;
  /** Blocks of signed labels, each sorted, the blocks themselves in canonical order. */
  readonly blocks: readonly (readonly number[])[];
}

/** Internal index for a signed label: 0…n−1 for the top row, n…2n−1 for the bottom. */
const indexOf = (label: number, n: number): number => (label > 0 ? label - 1 : n - label - 1);
const labelOf = (index: number, n: number): number => (index < n ? index + 1 : -(index - n + 1));

/** Sort blocks into one canonical spelling, so equal diagrams compare equal. */
function canonicalise(strands: number, blocks: readonly (readonly number[])[]): Diagram {
  const sorted = blocks
    .filter((b) => b.length > 0)
    .map((b) => [...b].sort((x, y) => indexOf(x, strands) - indexOf(y, strands)));
  sorted.sort((a, b) => indexOf(a[0]!, strands) - indexOf(b[0]!, strands));
  return { strands, blocks: sorted };
}

/** Build a diagram from blocks of signed labels. */
export const diagram = (strands: number, blocks: readonly (readonly number[])[]): Diagram =>
  canonicalise(strands, blocks);

/** A diagram as a restricted-growth string over the 2n points — the canonical key. */
export function toRgs(d: Diagram): number[] {
  const rgs: number[] = Array.from({ length: 2 * d.strands }, () => 0);
  d.blocks.forEach((block, id) => {
    for (const label of block) rgs[indexOf(label, d.strands)] = id;
  });
  return rgs;
}

export const diagramKey = (d: Diagram): string => `${d.strands}:${toRgs(d).join(",")}`;

/** Blocks from a restricted-growth string over 2n points. */
export function fromRgs(rgs: readonly number[]): Diagram {
  const strands = rgs.length / 2;
  const blocks = new Map<number, number[]>();
  rgs.forEach((id, index) => {
    const block = blocks.get(id) ?? [];
    block.push(labelOf(index, strands));
    blocks.set(id, block);
  });
  return canonicalise(strands, [...blocks.values()]);
}

/** The identity: each top point joined to the bottom point beneath it. */
export const identityDiagram = (n: number): Diagram =>
  diagram(
    n,
    Array.from({ length: n }, (_, k) => [k + 1, -(k + 1)]),
  );

// ── the product ─────────────────────────────────────────────────────────────────

interface UnionFind {
  find(x: number): number;
  union(x: number, y: number): void;
}

const unionFind = (size: number): UnionFind => {
  const parent = Array.from({ length: size }, (_, i) => i);
  const find = (x: number): number => {
    let root = x;
    while (parent[root] !== root) root = parent[root]!;
    for (let cur = x; parent[cur] !== root;) {
      const next = parent[cur]!;
      parent[cur] = root;
      cur = next;
    }
    return root;
  };
  return { find, union: (x, y) => void (parent[find(x)] = find(y)) };
};

/**
 * Stack `a` above `b`. Returns the composite diagram and the number of closed loops
 * removed from the middle — the exponent of δ in `a·b = δ^loops · (a∘b)`.
 *
 * Three layers of points: a's top (0…n−1), the glued middle (n…2n−1), b's bottom
 * (2n…3n−1). a's blocks join layer 0 to layer 1, b's join layer 1 to layer 2, and a
 * middle point belongs to both — which is exactly what the union-find expresses.
 */
export function composeDiagrams(a: Diagram, b: Diagram): { result: Diagram; loops: number } {
  const n = a.strands;
  const uf = unionFind(3 * n);
  // a: top → layer 0, bottom → layer 1.
  for (const block of a.blocks) {
    const points = block.map((l) => (l > 0 ? l - 1 : n + (-l - 1)));
    for (let i = 1; i < points.length; i++) uf.union(points[0]!, points[i]!);
  }
  // b: top → layer 1, bottom → layer 2.
  for (const block of b.blocks) {
    const points = block.map((l) => (l > 0 ? n + (l - 1) : 2 * n + (-l - 1)));
    for (let i = 1; i < points.length; i++) uf.union(points[0]!, points[i]!);
  }

  // The surviving blocks, read off the outer layers.
  const outer = new Map<number, number[]>();
  for (let k = 0; k < n; k++) {
    const top = uf.find(k);
    outer.set(top, [...(outer.get(top) ?? []), k + 1]);
    const bottom = uf.find(2 * n + k);
    outer.set(bottom, [...(outer.get(bottom) ?? []), -(k + 1)]);
  }

  // A middle point whose class touches no outer point was a closed loop.
  const touchesOuter = new Set<number>();
  for (let k = 0; k < n; k++) {
    touchesOuter.add(uf.find(k));
    touchesOuter.add(uf.find(2 * n + k));
  }
  const loopRoots = new Set<number>();
  for (let k = n; k < 2 * n; k++) {
    const root = uf.find(k);
    if (!touchesOuter.has(root)) loopRoots.add(root);
  }

  return { result: canonicalise(n, [...outer.values()]), loops: loopRoots.size };
}

// ── diagram classes ─────────────────────────────────────────────────────────────

/**
 * Planarity. Lay the 2n points around a circle — top 1…n left to right, then the
 * bottom row RIGHT TO LEFT, so the rectangle closes up — and the diagram is planar
 * exactly when no two blocks interleave in that cyclic order. Cutting the circle at
 * any point turns that into the ordinary non-crossing test.
 */
export function isPlanar(d: Diagram): boolean {
  const n = d.strands;
  // Position of each point around the circle.
  const position = new Map<number, number>();
  for (let k = 0; k < n; k++) position.set(k + 1, k);
  for (let k = 0; k < n; k++) position.set(-(n - k), n + k);

  const spans = d.blocks.map((block) => block.map((label) => position.get(label) ?? 0).sort((x, y) => x - y));
  for (let i = 0; i < spans.length; i++) {
    for (let j = i + 1; j < spans.length; j++) {
      // Two blocks cross when their positions interleave as a < c < b < d.
      for (const a of spans[i]!) {
        for (const b of spans[i]!) {
          if (a >= b) continue;
          const between = spans[j]!.some((c) => a < c && c < b);
          const outside = spans[j]!.some((c) => c < a || c > b);
          if (between && outside) return false;
        }
      }
    }
  }
  return true;
}

const blockSizes = (d: Diagram) => d.blocks.map((b) => b.length);
const isMatching = (d: Diagram) => blockSizes(d).every((s) => s === 2);
const crossesRows = (block: readonly number[]) => block.some((l) => l > 0) && block.some((l) => l < 0);

/** The diagram classes, each a subset of the partition diagrams closed under the product. */
export type DiagramClass =
  | "partition"
  | "planar-partition"
  | "brauer"
  | "temperley-lieb"
  | "motzkin"
  | "rook"
  | "symmetric";

export const CLASS_ADMITS: Record<DiagramClass, (d: Diagram) => boolean> = {
  partition: () => true,
  "planar-partition": isPlanar,
  brauer: isMatching,
  "temperley-lieb": (d) => isMatching(d) && isPlanar(d),
  motzkin: (d) => blockSizes(d).every((s) => s <= 2) && isPlanar(d),
  // A partial permutation: every block is a lone point or one top joined to one bottom.
  rook: (d) => d.blocks.every((b) => b.length === 1 || (b.length === 2 && crossesRows(b))),
  symmetric: (d) => d.blocks.every((b) => b.length === 2 && crossesRows(b)),
};

// ── enumeration ─────────────────────────────────────────────────────────────────

/** Every set partition of `size` points, as restricted-growth strings. */
function* growthStrings(size: number): Generator<number[]> {
  const rgs: number[] = Array.from({ length: size }, () => 0);
  const walk = function* (index: number, used: number): Generator<number[]> {
    if (index === size) {
      yield [...rgs];
      return;
    }
    for (let block = 0; block <= used; block++) {
      rgs[index] = block;
      yield* walk(index + 1, Math.max(used, block + 1));
    }
  };
  if (size === 0) yield [];
  else yield* walk(0, 0);
}

/** Every diagram of a class on n strands, in restricted-growth order. */
export function enumerateDiagrams(cls: DiagramClass, n: number): Diagram[] {
  const admits = CLASS_ADMITS[cls];
  const found: Diagram[] = [];
  for (const rgs of growthStrings(2 * n)) {
    const d = fromRgs(rgs);
    if (admits(d)) found.push(d);
  }
  return found;
}

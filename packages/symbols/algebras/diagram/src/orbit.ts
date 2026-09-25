// The orbit basis of the partition algebra.
//
// The diagram basis d_λ is the obvious one: one element per set partition, multiplied by
// stacking. The ORBIT basis x_λ is the other one the subject is written in, and the two are
// related by summing over the partition lattice:
//
//     d_λ = Σ_{μ ⪰ λ} x_μ                 (sum over partitions COARSER than λ)
//     x_λ = Σ_{μ ⪰ λ} μ_Π(λ, μ) · d_μ     (the same sum, Möbius-inverted)
//
// The names say why d_λ is a sum: a diagram asks for points to be connected, while an orbit
// basis element asks for them to be connected AND NOTHING ELSE. So a diagram is the union
// of the orbits that refine it, and recovering one orbit from the diagrams is inclusion–
// exclusion.
//
// The Möbius function here is the PARTITION lattice's,
//
//     μ_Π(λ, μ) = Π_{B ∈ μ} (−1)^{k_B − 1} (k_B − 1)!,   k_B = λ-blocks inside B,
//
// which is worth contrasting with the Hopf-algebra bases next door: those also come from
// Möbius inversion, but over the BOOLEAN lattice, where the function is just a sign. Here
// the factorials are the difference between merging any set of blocks and merging only
// adjacent ones.
//
// What the orbit basis buys: the map onto the centraliser algebra of the symmetric group
// acting on V^⊗n kills x_λ exactly when λ has more blocks than δ — a statement with no
// clean form in the diagram basis at all, and the reason the partition algebra's
// representation theory is written in x rather than d.

import { composeDiagrams, type Diagram, diagramKey, fromRgs, toRgs } from "./diagram.ts";

/** An element of the algebra: a coefficient per diagram, in whichever basis is meant. */
export type AlgebraElement = ReadonlyMap<string, { diagram: Diagram; coefficient: number }>;

export function element(parts: readonly (readonly [Diagram, number])[]): AlgebraElement {
  const out = new Map<string, { diagram: Diagram; coefficient: number }>();
  for (const [d, coefficient] of parts) {
    const key = diagramKey(d);
    const total = (out.get(key)?.coefficient ?? 0) + coefficient;
    if (total === 0) out.delete(key);
    else out.set(key, { diagram: d, coefficient: total });
  }
  return out;
}

export const basisElement = (d: Diagram): AlgebraElement => element([[d, 1]]);

/** Whether every block of `finer` sits inside a block of `coarser`. */
export function refines(finer: Diagram, coarser: Diagram): boolean {
  if (finer.strands !== coarser.strands) return false;
  const home = new Map<number, number>();
  coarser.blocks.forEach((block, id) => {
    for (const label of block) home.set(label, id);
  });
  return finer.blocks.every((block) => block.every((label) => home.get(label) === home.get(block[0] as number)));
}

/** Every set partition of a k-element set, as an assignment of block ids. */
function setPartitions(k: number): number[][] {
  if (k === 0) return [[]];
  const out: number[][] = [];
  const walk = (prefix: number[], used: number): void => {
    if (prefix.length === k) {
      out.push([...prefix]);
      return;
    }
    for (let id = 0; id <= used; id++) walk([...prefix, id], Math.max(used, id + 1));
  };
  walk([], 0);
  return out;
}

/**
 * Every partition coarser than this one: merge its blocks, in all ways. There are Bell(k)
 * of them for k blocks, because coarsening is exactly partitioning the blocks.
 */
export function coarsenings(d: Diagram): Diagram[] {
  const rgs = toRgs(d);
  return setPartitions(d.blocks.length).map((assignment) => fromRgs(rgs.map((id) => assignment[id] as number)));
}

const factorial = (n: number): number => {
  let total = 1;
  for (let i = 2; i <= n; i++) total *= i;
  return total;
};

/**
 * The partition lattice's Möbius function on the interval [finer, coarser]. The interval is
 * a product of smaller partition lattices, one per block of the coarser partition, and
 * μ(Π_k) = (−1)^{k−1}(k−1)! — so the answer is that product.
 */
export function partitionMobius(finer: Diagram, coarser: Diagram): number | undefined {
  if (!refines(finer, coarser)) return undefined;
  const home = new Map<number, number>();
  coarser.blocks.forEach((block, id) => {
    for (const label of block) home.set(label, id);
  });
  const counts = new Map<number, number>();
  for (const block of finer.blocks) {
    const id = home.get(block[0] as number) as number;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  let value = 1;
  for (const k of counts.values()) value *= (-1) ** (k - 1) * factorial(k - 1);
  return value;
}

const expand = (
  input: AlgebraElement,
  images: (d: Diagram) => readonly (readonly [Diagram, number])[],
): AlgebraElement =>
  element(
    [...input.values()].flatMap(({ diagram: d, coefficient }) =>
      images(d).map(([target, weight]) => [target, coefficient * weight] as const),
    ),
  );

/** d_λ written in the orbit basis: the unsigned sum over coarsenings. */
export const diagramToOrbit = (input: AlgebraElement): AlgebraElement =>
  expand(input, (d) => coarsenings(d).map((c) => [c, 1] as const));

/** x_λ written in the diagram basis: the same sum, weighted by the Möbius function. */
export const orbitToDiagram = (input: AlgebraElement): AlgebraElement =>
  expand(input, (d) => coarsenings(d).map((c) => [c, partitionMobius(d, c) as number] as const));

/**
 * The product of the algebra in the diagram basis: stack, and pay one factor of the loop
 * parameter per closed loop. Returned as a polynomial in δ — coefficient by δ-degree —
 * because the structure constants are not numbers.
 */
export function diagramProduct(a: AlgebraElement, b: AlgebraElement): Map<number, AlgebraElement> {
  const byDegree = new Map<number, (readonly [Diagram, number])[]>();
  for (const left of a.values()) {
    for (const right of b.values()) {
      const { result, loops } = composeDiagrams(left.diagram, right.diagram);
      const parts = byDegree.get(loops) ?? [];
      parts.push([result, left.coefficient * right.coefficient] as const);
      byDegree.set(loops, parts);
    }
  }
  return new Map([...byDegree].map(([degree, parts]) => [degree, element(parts)]));
}

/** The number of blocks — the statistic the change of basis is triangular with respect to. */
export const blockCount = (d: Diagram): number => d.blocks.length;

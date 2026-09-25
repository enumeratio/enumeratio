// Finite groups, and their group algebras k[G].
//
// k[G] has a basis of the group elements and the group's own multiplication as its
// product, extended bilinearly. That makes it the most elementary construction in this
// whole section — and the reason it goes last rather than first is that the interesting
// part is not the product but the CENTRE.
//
// k[G] is commutative exactly when G is abelian, which is usually false. But its centre
// is always commutative, and it always has a basis of CLASS SUMS: one element per
// conjugacy class, got by adding up that class. So a non-commutative algebra carries a
// canonical commutative subalgebra whose dimension is the number of conjugacy classes —
// which is also the number of irreducible characters, and the doorway to representation
// theory.
//
// The other thing worth seeing: k[Z_n] is k[x]/(x^n − 1). The group algebra of a cyclic
// group is a polynomial ring modulo one relation, and when the base field has n-th roots
// of unity it splits into n copies of the field — the same CRT-flavoured splitting the
// hypercomplex and numeral pages keep running into.

/** A finite group, given as a multiplication table over element indices. */
export interface Group {
  readonly name: string;
  /** Element labels, index 0 being the identity. */
  readonly elements: readonly string[];
  /** Index of the product of elements i and j. */
  multiply(i: number, j: number): number;
}

/** Build a group from labels and a multiplication on labels. Identity must come first. */
function build(name: string, labels: readonly string[], product: (a: string, b: string) => string): Group | undefined {
  const index = new Map(labels.map((label, i) => [label, i]));
  const table = labels.map((a) => labels.map((b) => index.get(product(a, b))));
  if (table.some((row) => row.some((entry) => entry === undefined))) return undefined;
  return {
    name,
    elements: labels,
    multiply: (i, j) => table[i]![j]!,
  };
}

/** The cyclic group Z_n, written additively as 0…n−1. */
export const cyclicGroup = (n: number): Group | undefined =>
  !Number.isSafeInteger(n) || n < 1 || n > 512
    ? undefined
    : build(
        `CyclicGroup(${n})`,
        Array.from({ length: n }, (_, i) => String(i)),
        (a, b) => String((Number(a) + Number(b)) % n),
      );

/**
 * The dihedral group of order 2n: the symmetries of an n-gon. Elements are `r^k` and
 * `s·r^k`, written `k` and `s k`, with the relations r^n = 1, s² = 1 and s r s = r^{-1}.
 */
export const dihedralGroup = (n: number): Group | undefined => {
  if (!Number.isSafeInteger(n) || n < 1 || n > 128) return undefined;
  const labels = [...Array.from({ length: n }, (_, k) => `${k}`), ...Array.from({ length: n }, (_, k) => `s${k}`)];
  const parse = (label: string): { flip: boolean; turn: number } =>
    label.startsWith("s") ? { flip: true, turn: Number(label.slice(1)) } : { flip: false, turn: Number(label) };
  const show = (flip: boolean, turn: number) => `${flip ? "s" : ""}${((turn % n) + n) % n}`;
  return build(`DihedralGroup(${n})`, labels, (a, b) => {
    const x = parse(a);
    const y = parse(b);
    // Normal form s^a r^b, with s r^b = r^{-b} s. The branch is on the SECOND factor's
    // flip, not the first: pushing y's flip leftwards past r^{x.turn} is what inverts a
    // turn, so it is y that decides whether x's turn is added or subtracted.
    return y.flip ? show(!x.flip, y.turn - x.turn) : show(x.flip, x.turn + y.turn);
  });
};

/** The direct product G × H, with componentwise multiplication. */
export function directProduct(g: Group, h: Group): Group | undefined {
  const labels = g.elements.flatMap((a) => h.elements.map((b) => `${a}/${b}`));
  return build(`${g.name}×${h.name}`, labels, (a, b) => {
    const [a1 = "", a2 = ""] = a.split("/");
    const [b1 = "", b2 = ""] = b.split("/");
    const left = g.multiply(g.elements.indexOf(a1), g.elements.indexOf(b1));
    const right = h.multiply(h.elements.indexOf(a2), h.elements.indexOf(b2));
    return `${g.elements[left]}/${h.elements[right]}`;
  });
}

export const order = (g: Group): number => g.elements.length;

/** The identity's index — 0 by construction, but checked rather than assumed. */
export function identityIndex(g: Group): number | undefined {
  for (let e = 0; e < order(g); e++) {
    if (g.elements.every((_, i) => g.multiply(e, i) === i && g.multiply(i, e) === i)) return e;
  }
  return undefined;
}

/** The inverse of element i. */
export function inverse(g: Group, i: number): number | undefined {
  const e = identityIndex(g);
  if (e === undefined) return undefined;
  for (let j = 0; j < order(g); j++) if (g.multiply(i, j) === e) return j;
  return undefined;
}

export const isAbelian = (g: Group): boolean =>
  g.elements.every((_, i) => g.elements.every((__, j) => g.multiply(i, j) === g.multiply(j, i)));

/**
 * The conjugacy classes: orbits of g ↦ x g x⁻¹. Their number is the dimension of the
 * centre of k[G], and also the number of irreducible characters of G.
 */
export function conjugacyClasses(g: Group): number[][] {
  const seen = new Set<number>();
  const classes: number[][] = [];
  for (let i = 0; i < order(g); i++) {
    if (seen.has(i)) continue;
    const orbit = new Set<number>();
    for (let x = 0; x < order(g); x++) {
      const xInverse = inverse(g, x);
      if (xInverse === undefined) continue;
      orbit.add(g.multiply(g.multiply(x, i), xInverse));
    }
    for (const member of orbit) seen.add(member);
    classes.push([...orbit].sort((a, b) => a - b));
  }
  return classes;
}

// ── elements of k[G] ────────────────────────────────────────────────────────────

/** An element: a coefficient per group element index. */
export type Element = ReadonlyMap<number, number>;

export const basisElement = (i: number): Element => new Map([[i, 1]]);

export function combine(parts: readonly (readonly [Element, number])[]): Element {
  const out = new Map<number, number>();
  for (const [element, factor] of parts) {
    for (const [index, coefficient] of element) {
      const total = (out.get(index) ?? 0) + coefficient * factor;
      if (total === 0) out.delete(index);
      else out.set(index, total);
    }
  }
  return out;
}

/** The product of k[G]: the group's multiplication, extended bilinearly. */
export function multiplyElements(g: Group, a: Element, b: Element): Element {
  const parts: [Element, number][] = [];
  for (const [i, ca] of a) {
    for (const [j, cb] of b) parts.push([basisElement(g.multiply(i, j)), ca * cb]);
  }
  return combine(parts);
}

/** The class sum of a conjugacy class — a basis element of the centre. */
export const classSum = (members: readonly number[]): Element => new Map(members.map((i) => [i, 1]));

/** Whether an element commutes with every basis element — i.e. lies in the centre. */
export function isCentral(g: Group, element: Element): boolean {
  for (let i = 0; i < order(g); i++) {
    const left = multiplyElements(g, basisElement(i), element);
    const right = multiplyElements(g, element, basisElement(i));
    if (left.size !== right.size) return false;
    for (const [index, coefficient] of left) if (right.get(index) !== coefficient) return false;
  }
  return true;
}

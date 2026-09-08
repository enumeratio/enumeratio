// The one collection contract, shared by every pack. A pack is a list of PackEntry — pure kernels
// (count / unrank / rank / valid) over plain JS values, with NO compute-engine dependency. The engine
// wiring (boxing to MathJSON, CE CollectionHandlers) lives entirely in library.ts via `adaptEntry`.
//
// element shape (`kind`):
//   "ints"   → number[]         (a flat list: words, parts, subsets, step sequences)
//   "blocks" → number[][]       (a list of int lists: set partitions, matchings, [image,colors])
//   "nested" → 0 | NestedTree   (recursively nested: binary / k-ary / ordered trees; leaf = 0 or [])
import type { Expression } from "@cortex-js/compute-engine";

export type NestedTree = number | NestedTree[]; // a leaf is a number (0 for the trees, a label for Groupings)

export interface PackEntry {
  head: string;
  paramCount: 1 | 2;
  kind: "ints" | "blocks" | "nested";
  count: (p: number[]) => number;
  unrank: (p: number[], r: number) => number[] | number[][] | NestedTree;
  rank: (e: any, p: number[]) => number;
  valid: (e: any, p: number[]) => boolean;
}

// A CE-facing family: closed-form count, an `elt` that emits the element as MathJSON, and `rank`
// (element → 0-based index, or undefined for a non-member). library.ts turns these into CollectionHandlers.
export interface FamilySpec {
  paramCount: 1 | 2;
  signature: string;
  count: (p: number[]) => number;
  elt: (p: number[], rank0: number) => any;
  rank: (target: Expression, p: number[]) => number | undefined;
}

const intOf = (x: any): number => Math.trunc(Number(x?.re ?? x?.value ?? x?.json));

// MathJSON encoders (element → boxed MathJSON expression)
export const listMJ = (xs: number[]): any => ["List", ...xs];
export const blocksMJ = (bs: number[][]): any => ["List", ...bs.map((b) => ["List", ...b])];
export const nestMJ = (t: NestedTree): any => (Array.isArray(t) ? ["List", ...t.map(nestMJ)] : t);

// boxed MathJSON → JS element (the inverse, for membership/rank)
export const asIntList = (t: any): number[] => (t?.ops ?? []).map(intOf);
export const asBlockList = (t: any): number[][] => (t?.ops ?? []).map((b: any) => (b?.ops ?? []).map(intOf));
export const denest = (x: any): NestedTree => (x?.ops ? (x.ops.map(denest) as NestedTree[]) : intOf(x));

const signatureFor = (kind: PackEntry["kind"], pc: 1 | 2): string => {
  if (kind === "nested") return pc === 1 ? "(integer) -> collection" : "(integer, integer) -> collection";
  const inner = kind === "ints" ? "list<list<integer>>" : "list<list<list<integer>>>";
  return pc === 1 ? `(integer) -> ${inner}` : `(integer, integer) -> ${inner}`;
};

const decodeFor = (kind: PackEntry["kind"]) =>
  kind === "ints" ? asIntList : kind === "blocks" ? asBlockList : denest;
const encodeFor = (kind: PackEntry["kind"]) =>
  kind === "ints" ? listMJ : kind === "blocks" ? blocksMJ : nestMJ;

/** Adapt a pure PackEntry into a CE-facing FamilySpec (boxing + membership-gated rank). */
export function adaptEntry(e: PackEntry): FamilySpec {
  const encode = encodeFor(e.kind);
  const decode = decodeFor(e.kind);
  return {
    paramCount: e.paramCount,
    signature: signatureFor(e.kind, e.paramCount),
    count: e.count,
    elt: (p, r) => encode(e.unrank(p, r) as any),
    rank: (t, p) => { const el = decode(t); return e.valid(el, p) ? e.rank(el, p) : undefined; },
  };
}

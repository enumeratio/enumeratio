// An explicit stack of frames kept in a fold's list, for walks over a tree that would otherwise
// recurse (Epsil has no recursion). The list holds the stack's height at position 1, whatever
// the walk produces, then the frames, `width` entries each, slot 1 first. A step pops the top
// frame and pushes up to two for its children, the first where the popped one was.

import { add, at, iff, mul, sub } from "../../../collections/src/families/tables.ts";

type MathJSON = unknown;
export type Cells = (readonly [MathJSON, MathJSON])[];

/** `state` with each (position, value) written, in order. */
export const writes = (state: MathJSON, ...cells: Cells): MathJSON =>
  cells.reduce<MathJSON>((s, [position, value]) => ["ReplaceAt", s, position, value], state);

/** Frames of `width` entries from position `first` + 1, slot 1 first. */
export const frames = (first: MathJSON, width: number) => {
  const position = (slot: MathJSON, c: number): MathJSON => add(first, mul(width, sub(slot, 1)), c);
  return {
    field: (state: MathJSON, slot: MathJSON, c: number): MathJSON => at(state, position(slot, c)),
    /** Frames for the two children of the one popped from `top`: `below` takes its place and
     *  `above` the slot after it, which is the same slot when `below` is absent (`hasBelow`). */
    push: (top: MathJSON, hasBelow: MathJSON, below: readonly MathJSON[], above: readonly MathJSON[]): Cells => [
      ...below.map((value, c) => [position(top, c + 1), value] as const),
      ...above.map((value, c) => [position(add(top, iff(hasBelow, 1, 0)), c + 1), value] as const),
    ],
  };
};

/** The stack's height after a pop and a push for each child that is present. */
export const heightAfter = (top: MathJSON, hasBelow: MathJSON, hasAbove: MathJSON): MathJSON =>
  add(sub(top, 1), iff(hasBelow, 1, 0), iff(hasAbove, 1, 0));

// A curve's points out of an evaluated expression: `[[x, y, z], …]`.

import type { Expression } from "@cortex-js/compute-engine";
import type { Triple } from "@enumeratio/frontend/core";

// `ops` lives on compute-engine's narrowed function interface; read it structurally.
const opsOf = (e: Expression): readonly Expression[] => (e as unknown as { ops?: readonly Expression[] }).ops ?? [];

/**
 * Read `[[x,y,z], …]` out of an evaluated expression.
 *
 * Straight off the boxed operands where it can: `.json` materializes the whole tree first, which
 * for a 600-point curve is ~1800 throwaway nodes per frame on top of the ~1800 boxed numbers the
 * curve already allocated. Falls back to the JSON reading for anything not shaped as a boxed list
 * of boxed lists.
 */
export function pointsOf(value: Expression): Triple[] {
  if (value.operator === "List") {
    const out: Triple[] = [];
    for (const row of opsOf(value)) {
      if (row.operator !== "List") continue;
      const [a, b, c] = opsOf(row);
      const p: Triple = [a?.re ?? Number.NaN, b?.re ?? Number.NaN, c?.re ?? Number.NaN];
      if (p.every((v) => Number.isFinite(v))) out.push(p);
    }
    if (out.length > 0) return out;
  }
  return pointsOfJson(value.json);
}

/** The points of a list of numeric triples, as MathJSON (numbers and rationals). */
export function pointsOfJson(json: unknown): Triple[] {
  if (!Array.isArray(json) || json[0] !== "List") return [];
  const out: Triple[] = [];
  for (const row of json.slice(1)) {
    if (!Array.isArray(row) || row[0] !== "List" || row.length !== 4) continue;
    const [x, y, z] = row.slice(1).map(numberOf);
    if (x === undefined || y === undefined || z === undefined) continue;
    out.push([x, y, z]);
  }
  return out;
}

function numberOf(node: unknown): number | undefined {
  if (typeof node === "number") return node;
  if (Array.isArray(node) && node.length === 3 && node[0] === "Rational") {
    const p = numberOf(node[1]);
    const q = numberOf(node[2]);
    return p !== undefined && q !== undefined && q !== 0 ? p / q : undefined;
  }
  if (typeof node === "object" && node !== null) {
    const num = (node as { num?: unknown }).num;
    if (typeof num === "string") {
      const v = Number(num.replace(/_/g, ""));
      return Number.isFinite(v) ? v : undefined;
    }
  }
  return undefined;
}

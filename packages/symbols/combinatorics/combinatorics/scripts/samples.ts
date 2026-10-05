// Small elements of a carrier, for the generators to check compiled code against the
// interpreter: every family whose elements are values of the carrier, at small sizes, the
// first few ranks of each.

import type { Engine } from "@enumeratio/engine";
import { allKernels } from "../collections/src/families/index.ts";

const toJson = (element: unknown): unknown => (Array.isArray(element) ? ["List", ...element.map(toJson)] : element);

/** Elements (as MathJSON contents) of the families over `carrier` (its constructor name):
 *  one-parameter families up to `maxSize`, two-parameter ones (n, k) at k ≤ n. */
export function smallElements(ce: Engine, carrier: string, maxSize = 5, perFamily = 8): unknown[] {
  const out: unknown[] = [];
  // A carrier whose slots are other carriers' values (`carrierElements`) isn't sampled.
  for (const family of allKernels(ce).filter(
    (f) => f.carrier === carrier && f.paramCount >= 1 && f.paramCount <= 2 && f.carrierElements === undefined,
  ))
    for (let n = 0; n <= maxSize; n++)
      for (const params of family.paramCount === 1 ? [[n]] : Array.from({ length: n + 1 }, (_, k) => [n, k])) {
        const total = family.count(params);
        if (typeof total !== "bigint") continue;
        const last = total < BigInt(perFamily) ? total : BigInt(perFamily);
        // A carrier with params packs them first, `Tuple(...params, element)`, as its
        // constructor's contents (`carrierParams`, declare.ts).
        for (let r = 0n; r < last; r++) {
          const element = toJson(family.unrank(params, r));
          const packed = family.carrierParams ?? 0;
          out.push(packed === 0 ? element : ["Tuple", ...params.slice(0, packed), element]);
        }
      }
  return out;
}

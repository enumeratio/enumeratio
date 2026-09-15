// The core, DERIVED rather than declared.
//
// Every definition is an expression over other heads. Walk them all, subtract the heads we
// define ourselves, and what is left is what the whole body of definitions actually rests
// on. That residue is the core — and because it is computed, it cannot drift from the
// definitions the way a hand-maintained list would.
//
// The tower falls out of the same walk. A head defined only in terms of core heads sits at
// level 1; one that uses a level-1 head sits at level 2; and so on. The level is a fact
// about the definitions, not a decision.

import { ALL_STATISTICS } from "./all.ts";
import { type Definition, headsOf, signatureOf } from "./types.ts";

/** Heads that carry no meaning of their own — expression plumbing, not operations. */
const STRUCTURAL = new Set(["Function", "Delimiter", "Sequence", "Hold"]);

/** Every head appearing in any definition, with how many definitions use it. */
export function headUsage(
  definitions: readonly Definition[] = ALL_STATISTICS,
): Map<string, number> {
  const usage = new Map<string, number>();
  for (const definition of definitions)
    for (const head of headsOf(definition.expr)) {
      if (STRUCTURAL.has(head)) continue;
      usage.set(head, (usage.get(head) ?? 0) + 1);
    }
  return usage;
}

/**
 * The core: heads our definitions USE but do not DEFINE. These are compute-engine's, and
 * they are the vocabulary the whole catalog would have to be expressed in.
 */
export function core(definitions: readonly Definition[] = ALL_STATISTICS): string[] {
  const defined = new Set(definitions.map((d) => d.head));
  return [...headUsage(definitions).keys()].filter((head) => !defined.has(head)).sort();
}

/**
 * The tower. Level 0 is the core; a definition's level is one more than the deepest level
 * among the heads it uses. A definition using a head nobody defines stays at level 1.
 *
 * Returns the level per SIGNATURE, since a head can sit at different depths on different
 * carriers — `MajorIndex` is level 1 everywhere, but a statistic defined in terms of another
 * (StandardTableauCount over HookProduct) is not.
 */
export function tower(definitions: readonly Definition[] = ALL_STATISTICS): Map<string, number> {
  const byHead = new Map<string, Definition[]>();
  for (const definition of definitions) {
    const list = byHead.get(definition.head) ?? [];
    list.push(definition);
    byHead.set(definition.head, list);
  }

  const level = new Map<string, number>();
  const visiting = new Set<string>();

  const levelOf = (definition: Definition): number => {
    const key = signatureOf(definition);
    const known = level.get(key);
    if (known !== undefined) return known;
    // A cycle would mean a definition defined in terms of itself; treat it as level 1 rather
    // than looping, and let the caller notice via `cycles()`.
    if (visiting.has(key)) return 1;
    visiting.add(key);

    let deepest = 0;
    for (const head of headsOf(definition.expr)) {
      if (STRUCTURAL.has(head) || head === definition.head) continue;
      for (const other of byHead.get(head) ?? []) deepest = Math.max(deepest, levelOf(other));
    }
    visiting.delete(key);
    const result = deepest + 1;
    level.set(key, result);
    return result;
  };

  for (const definition of definitions) levelOf(definition);
  return level;
}

/** Definitions that reference themselves, directly or through another definition. */
export function cycles(definitions: readonly Definition[] = ALL_STATISTICS): string[] {
  const byHead = new Map<string, Definition[]>();
  for (const definition of definitions)
    byHead.set(definition.head, [...(byHead.get(definition.head) ?? []), definition]);

  const found: string[] = [];
  for (const definition of definitions) {
    const seen = new Set<string>();
    const stack = [...headsOf(definition.expr)];
    while (stack.length > 0) {
      const head = stack.pop();
      if (head === undefined || seen.has(head)) continue;
      seen.add(head);
      if (head === definition.head) {
        found.push(signatureOf(definition));
        break;
      }
      for (const other of byHead.get(head) ?? []) stack.push(...headsOf(other.expr));
    }
  }
  return found;
}

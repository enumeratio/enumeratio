// What a library's version number must say, computed from what changed
// (https://github.com/enumeratio/enumeratio/wiki/Speculative-Vdom-Markup §4.3): a range (`^1.2.0`) trusts it
// when it pulls in a newer version, so it's checked, not declared. Diffs the surfaces a
// published library carries: its names, their signatures, their definitions (pins), their
// examples, and its system range. Attributes, named slots and notation aren't published yet.

import { gt, gte, inc, satisfies, subset } from "semver";
import type { LibraryIndex } from "./format.ts";

export type Level = "none" | "patch" | "minor" | "major";

export interface Change {
  readonly symbol?: string;
  readonly level: Exclude<Level, "none">;
  readonly what: string;
}

/** A published version, as the checker reads it. */
export interface LibrarySnapshot {
  readonly version: string;
  readonly index: LibraryIndex;
  /** The `enumeratio.system` range. */
  readonly system?: string;
}

/**
 * Whether a value of type `a` can stand wherever `b` is expected: compute-engine's
 * `ce.type(a).matches(ce.type(b))`, which is contravariant in a function's parameters.
 */
export type IsSubtype = (a: string, b: string) => boolean;

const RANK: Readonly<Record<Level, number>> = { none: 0, patch: 1, minor: 2, major: 3 };

/** The level a set of changes needs: the largest of them. */
export const levelOf = (changes: readonly Change[]): Level =>
  changes.reduce<Level>((level, change) => (RANK[change.level] > RANK[level] ? change.level : level), "none");

/**
 * What changed from `previous` to `next`, and the level each change needs. Behaviour (the
 * previous version's examples, run against the new definitions) is the caller's to add: it
 * needs an engine.
 */
export function changesOf(previous: LibrarySnapshot, next: LibrarySnapshot, isSubtype: IsSubtype): Change[] {
  const changes: Change[] = [];
  const before = previous.index.symbols;
  const after = next.index.symbols;
  for (const symbol of Object.keys(before).toSorted()) {
    const old = before[symbol]!;
    const now = after[symbol];
    if (now === undefined) {
      changes.push({ symbol, level: "major", what: "removed" });
      continue;
    }
    if (old.signature !== now.signature) {
      const substitutable = isSubtype(now.signature, old.signature);
      const same = substitutable && isSubtype(old.signature, now.signature);
      if (!same)
        changes.push({
          symbol,
          level: substitutable ? "minor" : "major",
          what: `signature ${old.signature} to ${now.signature}${substitutable ? ", widened" : ""}`,
        });
    }
    if (old.pin !== now.pin) changes.push({ symbol, level: "patch", what: "definition changed" });
    if ((now.examples ?? 0) > (old.examples ?? 0)) changes.push({ symbol, level: "minor", what: "examples added" });
  }
  for (const symbol of Object.keys(after).toSorted())
    if (!(symbol in before)) changes.push({ symbol, level: "minor", what: "added" });
  const [was, is] = [previous.system ?? "*", next.system ?? "*"];
  if (was !== is) {
    const widened = subset(was, is);
    changes.push({ level: widened ? "minor" : "major", what: `system ${was} to ${is}${widened ? ", widened" : ""}` });
  }
  return changes;
}

/**
 * Whether going from `previous` to `next` says at least `level`, as a caret range reads it: a
 * major change must leave `^previous` (in 0.x that's a minor bump, as npm has it), a minor one
 * must bump the minor from 1.0 on, and anything must move forward.
 */
export function versionSays(previous: string, next: string, level: Level): boolean {
  if (level === "none") return true;
  if (!gt(next, previous)) return false;
  if (level === "major") return !satisfies(next, `^${previous}`);
  if (level === "minor" && gte(previous, "1.0.0")) return gte(next, inc(previous, "minor")!);
  return true;
}

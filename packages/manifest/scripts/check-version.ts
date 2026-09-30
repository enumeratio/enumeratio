// Whether a library's new version number says what changed since its previous one
// (https://github.com/enumeratio/enumeratio/wiki/Speculative-Vdom-Markup §4.3): the published surfaces diffed
// (`changesOf`), and the previous version's examples run against the new definitions, a
// failing one being a break. Both versions are packed directories; the previous one is what
// the host serves for it, unpacked.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ComputeEngine } from "@cortex-js/compute-engine";
import type { LibraryField, LibraryIndex } from "../src/libraries/format.ts";
import {
  type Change,
  changesOf,
  type Level,
  levelOf,
  type LibrarySnapshot,
  versionSays,
} from "../src/libraries/versioning.ts";
import {
  agrees,
  type CheckedValue,
  createRegistryResolver,
  type Definition,
  definitionRegistry,
  type Example,
} from "../src/registry.ts";

interface Packed {
  readonly snapshot: LibrarySnapshot;
  readonly symbolsDir: string;
}

function readPacked(dir: string): Packed {
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as {
    version: string;
    enumeratio: LibraryField;
  };
  const indexPath = join(dir, pkg.enumeratio.index);
  const index = JSON.parse(readFileSync(indexPath, "utf8")) as LibraryIndex;
  return {
    snapshot: {
      version: pkg.version,
      index,
      ...(pkg.enumeratio.system === undefined ? {} : { system: pkg.enumeratio.system }),
    },
    symbolsDir: indexPath.replace(/[^/]*$/, ""),
  };
}

const readJson = <T>(path: string): T | undefined =>
  existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as T) : undefined;

/** The previous version's examples that the new definitions no longer meet: each a break. */
async function behaviour(previous: Packed, next: Packed): Promise<Change[]> {
  const { namespace } = next.snapshot.index;
  const definitions: Record<string, Definition> = {};
  for (const name of readdirSync(next.symbolsDir)) {
    const definition = readJson<Definition>(join(next.symbolsDir, name, "definition.json"));
    if (definition !== undefined) definitions[name] = definition;
  }
  const resolver = createRegistryResolver(definitionRegistry<ComputeEngine>(namespace, definitions));
  const changes: Change[] = [];
  for (const symbol of Object.keys(previous.snapshot.index.symbols).toSorted()) {
    if (!(symbol in definitions)) continue;
    const examples = readJson<Example[]>(join(previous.symbolsDir, symbol, "examples.json")) ?? [];
    for (const example of examples) {
      const ce = new ComputeEngine();
      const { expression, errors, unresolved } = await resolver.ensure(ce, example.expr);
      let failure: string | undefined;
      if (errors.length > 0 || unresolved.length > 0) failure = [...errors, ...unresolved].join("; ");
      else {
        const box = (json: unknown) => ce.box(json as never).evaluate() as unknown as CheckedValue;
        const got = box(expression);
        if (!agrees(got, box(example.expected), example.tolerance)) failure = `now ${JSON.stringify(got.json)}`;
      }
      if (failure !== undefined) changes.push({ symbol, level: "major", what: `example ${example.id}: ${failure}` });
    }
  }
  return changes;
}

export interface VersionCheck {
  readonly level: Level;
  readonly changes: readonly Change[];
  /** Whether the new version number says at least `level`. */
  readonly says: boolean;
}

/** Check the packed library at `dir` against its previous version, packed at `previousDir`. */
export async function checkVersion(dir: string, previousDir: string): Promise<VersionCheck> {
  const [previous, next] = [readPacked(previousDir), readPacked(dir)];
  const ce = new ComputeEngine();
  const isSubtype = (a: string, b: string): boolean => ce.type(a).matches(ce.type(b));
  const changes = [...changesOf(previous.snapshot, next.snapshot, isSubtype), ...(await behaviour(previous, next))];
  const level = levelOf(changes);
  return { level, changes, says: versionSays(previous.snapshot.version, next.snapshot.version, level) };
}

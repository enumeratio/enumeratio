// The fs-based loader for the YAML records (design/examples-as-data.md §8 step 1). Reads
// `<package>/reference/<Head>.yaml` and its optional `<Head>.implementations.yaml`, through
// `@enumeratio/entry`'s strict reader, validated against its JSON Schema, and checks for `id`
// collisions on a head shared between two packages (§9 "Shared heads").
//
// Node-only (`node:fs`), so this lives on the `/node` subpath, never the package's `.` entry:
// `ExampleAlternatives.vue` imports `@enumeratio/reference` in the browser, and a filesystem
// loader on the main export would break the site build. No data lives under `reference/` yet
// -- the data flip is step 4 -- so an empty scan is the expected result today.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  HEAD_IMPLEMENTATIONS_SCHEMA,
  type HeadImplementations,
  parseYaml,
  REFERENCE_ENTRY_SCHEMA,
  type ReferenceEntry,
  validateSchema,
} from "@enumeratio/entry";

export interface LoadedHead {
  /** The workspace package's directory name (`analytic`, `collections`, …). */
  readonly package: string;
  /** The head name, from the file's basename. */
  readonly head: string;
  readonly entryPath: string;
  readonly entry: ReferenceEntry;
  readonly implementationsPath?: string;
  readonly implementations?: HeadImplementations;
}

export interface LoadIssue {
  readonly file: string;
  readonly message: string;
}

export interface LoadResult {
  readonly heads: readonly LoadedHead[];
  readonly issues: readonly LoadIssue[];
}

const ENTRY_SUFFIX = ".yaml";
const IMPLEMENTATIONS_SUFFIX = ".implementations.yaml";

function headName(fileName: string): string {
  return fileName.slice(0, -ENTRY_SUFFIX.length);
}

/**
 * Scan every `<packagesRoot>/<package>/reference/` directory for `<Head>.yaml` files, parse
 * and validate each one (and its `.implementations.yaml`, if present), and check that no two
 * packages assign the same id to the same head (design/examples-as-data.md §3, §9).
 *
 * `packagesRoot` is normally the repo's `packages/` directory; a caller passes a fixture
 * directory in tests instead of scanning real data.
 */
export function loadReferenceData(packagesRoot: string): LoadResult {
  const heads: LoadedHead[] = [];
  const issues: LoadIssue[] = [];
  // "<Head>/<id>" -> the file that first declared it, so a repeat can name where it collides.
  const seenIds = new Map<string, string>();

  const packageDirs = readdirSync(packagesRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  for (const pkg of packageDirs) {
    const referenceDir = join(packagesRoot, pkg, "reference");
    if (!existsSync(referenceDir)) continue;

    const files = readdirSync(referenceDir).filter(
      (f) => f.endsWith(ENTRY_SUFFIX) && !f.endsWith(IMPLEMENTATIONS_SUFFIX),
    );

    for (const file of files.sort()) {
      const head = headName(file);
      const entryPath = join(referenceDir, file);
      let entry: ReferenceEntry;
      try {
        entry = parseYaml(readFileSync(entryPath, "utf8")) as ReferenceEntry;
      } catch (error) {
        issues.push({ file: entryPath, message: `failed to parse: ${(error as Error).message}` });
        continue;
      }
      for (const message of validateSchema(REFERENCE_ENTRY_SCHEMA, entry))
        issues.push({ file: entryPath, message });

      const implementationsPath = join(referenceDir, `${head}${IMPLEMENTATIONS_SUFFIX}`);
      let implementations: HeadImplementations | undefined;
      if (existsSync(implementationsPath)) {
        try {
          implementations = parseYaml(
            readFileSync(implementationsPath, "utf8"),
          ) as HeadImplementations;
        } catch (error) {
          issues.push({
            file: implementationsPath,
            message: `failed to parse: ${(error as Error).message}`,
          });
        }
        if (implementations !== undefined)
          for (const message of validateSchema(HEAD_IMPLEMENTATIONS_SCHEMA, implementations))
            issues.push({ file: implementationsPath, message });
      }

      for (const example of entry.examples ?? []) {
        if (example.id === undefined) continue;
        const globalId = `${head}/${example.id}`;
        const seenIn = seenIds.get(globalId);
        if (seenIn !== undefined)
          issues.push({
            file: entryPath,
            message: `id collision: "${globalId}" is also declared in ${seenIn}`,
          });
        else seenIds.set(globalId, entryPath);
      }

      heads.push({
        package: pkg,
        head,
        entryPath,
        entry,
        implementationsPath: implementations !== undefined ? implementationsPath : undefined,
        implementations,
      });
    }
  }

  return { heads, issues };
}

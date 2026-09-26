// The site's reference, assembled from the documented entries (the loader's, one per head):
// behind them a stub for every carrier domain and every symbol the bare engine binds, so each
// has a page that shows its crosswalk. Stubs never shadow an entry. Shared by the browser
// (reference.ts, over the virtual module) and the Node side of the site (reference-node.ts).

import { DOMAINS, type Domain } from "@enumeratio/domains";
import type { MathJSON, ReferenceEntry } from "@enumeratio/reference";
import { engineEntries } from "@enumeratio/reference";

export interface HeadInfo {
  href?: string;
  definition?: ReferenceEntry["examples"][number]["expr"];
  primitive?: string;
}

/** Split `tuple<A, B, …>`'s inner list on top-level commas -- a shape can nest
 *  (`tuple<list<integer>, list<integer>>`), so a plain `.split(",")` would cut inside it. */
function splitShapeArgs(inner: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of inner) {
    if (ch === "<") depth++;
    if (ch === ">") depth--;
    if (ch === "," && depth === 0) {
      args.push(current.trim());
      current = "";
    } else current += ch;
  }
  if (current.trim().length > 0) args.push(current.trim());
  return args;
}

/** A structurally-valid MathJSON value for a carrier's shape -- a leaf primitive, a
 *  one-element `list<...>`, a `tuple<...>` of its parts, or another carrier's own
 *  constructor when the shape names it by type (a tableau pair is two tableaux). Used only
 *  to build the one worked example a plural's stub page shows. */
function sampleForShape(shape: string, byType: ReadonlyMap<string, Domain>): MathJSON {
  if (shape === "integer" || shape === "number") return 1;
  if (shape === "string") return "'a'";
  if (shape === "boolean") return true;
  if (shape.startsWith("list<")) return ["List", sampleForShape(shape.slice(5, -1), byType)];
  if (shape.startsWith("tuple<")) {
    return ["Tuple", ...splitShapeArgs(shape.slice(6, -1)).map((part) => sampleForShape(part, byType))];
  }
  const domain = byType.get(shape);
  return domain === undefined ? 1 : [domain.name, sampleForShape(domain.shape, byType)];
}

export function assemble(loaded: readonly ReferenceEntry[]) {
  const byName = new Map<string, ReferenceEntry>(loaded.map((entry) => [entry.name, entry]));
  /** The documented heads -- the ones with examples, and the ones prose auto-links. */
  const documented: readonly ReferenceEntry[] = [...byName.values()];
  // Page generation keys files by name CASE-INSENSITIVELY (macOS's default filesystem), so a
  // domain's singular inhabitant constructor (e.g. `KAryTree`) can't get its own stub page
  // when a documented head differs only in case (Wolfram's `KaryTree` graph constructor) --
  // that collision broke the site build once already (#260). The documented head wins; the
  // carrier still gets its crosswalk via the documented page instead of a stub.
  const byNameLower = new Set([...byName.keys()].map((name) => name.toLowerCase()));
  const carrierStubs: ReferenceEntry[] = DOMAINS.filter(
    (d) => !byName.has(d.name) && !byNameLower.has(d.name.toLowerCase()),
  ).map((d) => ({
    name: d.name,
    domain: "Carrier domains",
    signature: `${d.name}: ${d.shape}`,
    summary: d.restricts
      ? `A carrier domain restricting ${d.restricts}.`
      : "A carrier domain: the nominal type this object is stored and dispatched as.",
    examples: [],
    stub: "carrier",
  }));
  const takenLower = new Set([...byNameLower, ...carrierStubs.map((s) => s.name.toLowerCase())]);
  const byType = new Map(DOMAINS.map((d) => [d.type, d]));
  // A domain's plural TYPE-SPACE name gets its own stub page too -- same case-insensitive
  // guard as above (a plural minted fresh, or one that already names a collection family,
  // can still collide with something documented or another carrier's stub by case alone).
  const pluralStubs: ReferenceEntry[] = DOMAINS.filter(
    (d): d is Domain & { plural: string } =>
      d.plural !== undefined && !byName.has(d.plural) && !takenLower.has(d.plural.toLowerCase()),
  ).map((d) => {
    const sample: MathJSON = [d.name, sampleForShape(d.shape, byType)];
    const expr: MathJSON = ["Element", sample, d.plural];
    return {
      name: d.plural,
      domain: "Carrier domains",
      signature: `${d.plural}: set<${d.type}>`,
      summary: `The type space of ${d.name} -- Element(x, ${d.plural}) is True for a ${d.name}(...) value, False for one of another carrier.`,
      examples: [{ id: "membership", expr, expected: "True" }],
      stub: "carrier",
    };
  });
  const entries: readonly ReferenceEntry[] = [
    ...documented,
    ...carrierStubs,
    ...pluralStubs,
    ...engineEntries(
      new Set([...byName.keys(), ...carrierStubs.map((s) => s.name), ...pluralStubs.map((s) => s.name)]),
    ),
  ];
  const getEntry = (name: string): ReferenceEntry | undefined => entries.find((entry) => entry.name === name);
  /**
   * The head resolver a reference page hands to its TreeForm cells: a link to the entry, the
   * `reference` implementation to unfold into, and the primitive reason when there is one.
   */
  const resolveHead = (name: string): HeadInfo | undefined => {
    const entry = getEntry(name);
    if (!entry) return undefined;
    const definition = entry.implementations?.find((impl) => impl.origin === "reference")?.expr;
    return {
      href: `/reference/symbol/${name}`,
      ...(definition === undefined ? {} : { definition }),
      ...(entry.primitive ? { primitive: entry.primitive } : {}),
    };
  };
  const entriesByDomain = (): { domain: string; entries: ReferenceEntry[] }[] => {
    const groups = new Map<string, ReferenceEntry[]>();
    for (const entry of entries) {
      const group = groups.get(entry.domain) ?? [];
      group.push(entry);
      groups.set(entry.domain, group);
    }
    return [...groups].map(([domain, group]) => ({ domain, entries: group }));
  };
  return { documented, entries, getEntry, resolveHead, entriesByDomain };
}

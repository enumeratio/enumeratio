// A carrier's fields: the statistics defined on it and the maps into and out of it, with what
// FindStat says of each (its title, properties and a few of its values). Node-only, read at
// build: a carrier's page, its collections' pages and the per-carrier statistic and map pages
// all draw from here, so nothing is written twice.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ALL_STATISTICS, CARRIERS, findstatMaps, MAPS, UNDEFINED_MAPS } from "@enumeratio/combinatorics";
import { allFamilies } from "@enumeratio/combinatorics/collections";
import { crosswalkForMap, crosswalkForStatistic } from "@enumeratio/reference";
import { repoRoot } from "./repo-docs.ts";

const DATA = join(repoRoot, "packages/symbols/combinatorics/combinatorics/findstat/data");

interface Snapshot<T> {
  readonly source: string;
  readonly items: Readonly<Record<string, T>>;
}
export interface FindStatStatistic {
  readonly collection: string;
  readonly title: string;
  readonly description: string;
  readonly sample: readonly [string, number][];
}
export interface FindStatMap {
  readonly domain: string;
  readonly codomain: string;
  readonly title: string;
  readonly properties: readonly string[];
  readonly description: string;
  readonly sample: readonly [string, string][];
}

const read = <T>(file: string): Snapshot<T> => JSON.parse(readFileSync(join(DATA, file), "utf8")) as Snapshot<T>;
const statistics = read<FindStatStatistic>("statistics.json").items;
const maps = read<FindStatMap>("maps.json").items;

/** FindStat's collections that are one of our carriers. */
const COLLECTION_CARRIER: Readonly<Record<string, string>> = {
  Permutations: "Permutation",
  "Signed permutations": "SignedPermutation",
  "Decorated permutations": "DecoratedPermutation",
  "Dyck paths": "DyckPath",
  "Integer partitions": "IntegerPartition",
  "Skew partitions": "SkewPartition",
  Cores: "CorePartition",
  "Set partitions": "SetPartition",
  "Ordered set partitions": "SetComposition",
  "Integer compositions": "Composition",
  "Binary words": "BinaryWord",
  "Binary trees": "BinaryTree",
  "Ordered trees": "OrderedTree",
  "Perfect matchings": "PerfectMatching",
  "Parking functions": "ParkingFunction",
  "Alternating sign matrices": "AlternatingSignMatrix",
  "Standard tableaux": "StandardTableau",
  "Semistandard tableaux": "SemistandardTableau",
  "Plane partitions": "PlanePartition",
  "Gelfand-Tsetlin patterns": "GelfandTsetlinPattern",
};

/** A FindStat id on a row, with what FindStat says of it. */
export interface FindStatRef {
  readonly id: string;
  readonly url: string;
  readonly title?: string;
  readonly description?: string;
  readonly properties?: readonly string[];
  readonly sample?: readonly [string, string | number][];
}

export interface Field {
  readonly kind: "statistic" | "map";
  readonly name: string;
  /** The carrier a statistic is on, or a map's source carrier. */
  readonly carrier: string;
  /** A map's target carrier. */
  readonly to?: string;
  readonly summary?: string;
  readonly note?: string;
  readonly laws: readonly string[];
  readonly findstat: readonly FindStatRef[];
  /** Named but not defined yet (a frontier map). */
  readonly frontier?: boolean;
  readonly href: string;
}

/** A FindStat map we haven't implemented, listed on the carrier it leaves or reaches. */
export interface OtherMap {
  readonly id: string;
  readonly title: string;
  readonly from: string;
  readonly to: string;
  readonly properties: readonly string[];
}

export interface CarrierFields {
  readonly carrier: string;
  readonly statistics: readonly Field[];
  readonly mapsFrom: readonly Field[];
  readonly mapsTo: readonly Field[];
  readonly otherMaps: readonly OtherMap[];
}

const carrierNames = new Map(CARRIERS.map((c) => [c.type, c.name]));
const carrierName = (type: string): string => carrierNames.get(type) ?? type;

const statisticHref = (carrier: string, name: string): string => `/reference/statistic/${carrier}/${name}`;
const mapHref = (carrier: string, name: string): string => `/reference/map/${carrier}/${name}`;

function findStatRef(id: string, url: string): FindStatRef {
  const stat = statistics[id];
  const map = maps[id];
  if (stat) return { id, url, title: stat.title, description: stat.description, sample: stat.sample };
  if (map)
    return { id, url, title: map.title, description: map.description, properties: map.properties, sample: map.sample };
  return { id, url };
}

const idsOf = (refs: readonly { system: string; identity: string; url?: string; href?: string }[]): FindStatRef[] =>
  refs
    .filter((r) => r.system === "findstat")
    .map((r) => findStatRef(r.identity, r.url ?? r.href ?? `https://www.findstat.org/${r.identity}`));

const statisticFields: Field[] = ALL_STATISTICS.map((d) => ({
  kind: "statistic",
  name: d.head,
  carrier: d.on,
  summary: d.summary,
  note: d.note,
  laws: [],
  findstat: idsOf(crosswalkForStatistic(d.head, d.on)),
  href: statisticHref(d.on, d.head),
}));

/** A map's FindStat refs: the crosswalk's, and those matched by value (`find-findstat-maps.ts`). */
function mapRefs(name: string, from: string): FindStatRef[] {
  const refs = idsOf(crosswalkForMap(name, from));
  const have = new Set(refs.map((r) => r.id));
  const matched = (findstatMaps.find((m) => m.name === name && m.from === from)?.findstat ?? []).filter(
    (id) => !have.has(id),
  );
  return [...refs, ...matched.map((id) => findStatRef(id, `https://www.findstat.org/${id}`))];
}

const mapFields: Field[] = [
  ...MAPS.map((m): Field => ({
    kind: "map",
    name: m.name,
    carrier: carrierName(m.from),
    to: carrierName(m.to),
    summary: m.summary,
    note: m.note,
    laws: (m.laws ?? []).map((law) => (typeof law === "string" ? law : Object.keys(law)[0]!)),
    findstat: mapRefs(m.name, carrierName(m.from)),
    href: mapHref(carrierName(m.from), m.name),
  })),
  ...UNDEFINED_MAPS.map((m): Field => ({
    kind: "map",
    name: m.name,
    carrier: carrierName(m.from),
    to: carrierName(m.to),
    summary: m.why,
    laws: [],
    findstat: mapRefs(m.name, carrierName(m.from)),
    frontier: true,
    href: mapHref(carrierName(m.from), m.name),
  })),
];

/** The map ids of ours, so FindStat's other maps can be told apart. */
const ours = new Set(mapFields.flatMap((m) => m.findstat.map((f) => f.id)));

/** FindStat's maps we don't have, by the carrier they leave or reach. */
function otherMapsOf(carrier: string): OtherMap[] {
  return Object.entries(maps)
    .filter(([id]) => !ours.has(id))
    .flatMap(([id, m]) => {
      const from = COLLECTION_CARRIER[m.domain];
      const to = COLLECTION_CARRIER[m.codomain];
      return from === carrier || to === carrier
        ? [
            {
              id,
              title: m.title,
              from: from ?? m.domain,
              to: to ?? m.codomain,
              properties: m.properties,
            },
          ]
        : [];
    });
}

/** The carrier a name stands for: itself, or the carrier of a collection family. */
export function carrierOf(name: string): string | undefined {
  if (carrierNames.size > 0 && [...carrierNames.values()].includes(name)) return name;
  return allFamilies.find((family) => family.head === name)?.carrier;
}

/** A carrier's fields, or `undefined` when it has none to show. */
export function fieldsOf(name: string): CarrierFields | undefined {
  const carrier = carrierOf(name);
  if (carrier === undefined) return undefined;
  const result: CarrierFields = {
    carrier,
    statistics: statisticFields.filter((f) => f.carrier === carrier).toSorted((a, b) => a.name.localeCompare(b.name)),
    mapsFrom: mapFields.filter((f) => f.carrier === carrier).toSorted((a, b) => a.name.localeCompare(b.name)),
    mapsTo: mapFields
      .filter((f) => f.to === carrier && f.carrier !== carrier)
      .toSorted((a, b) => a.name.localeCompare(b.name)),
    otherMaps: otherMapsOf(carrier),
  };
  return result.statistics.length + result.mapsFrom.length + result.mapsTo.length + result.otherMaps.length === 0
    ? undefined
    : result;
}

/** Every statistic's and map's own page: `[carrier, name]`. */
export const statisticPages = (): Field[] => statisticFields;
export const mapPages = (): Field[] => mapFields;

/** The same name on other carriers, for a page to point at: they are distinct implementations. */
export const siblingsOf = (field: Field): Field[] =>
  (field.kind === "statistic" ? statisticFields : mapFields).filter(
    (f) => f.name === field.name && f.carrier !== field.carrier,
  );

// FindStat writes an object as text; the carrier value we read it as, for the carriers whose
// text we have checked against our own.
const listOf = (text: string): unknown => ["List", ...(JSON.parse(text) as number[])];
const READERS: Readonly<Record<string, (text: string) => unknown>> = {
  Permutation: (text) => ["Permutation", listOf(text)],
  IntegerPartition: (text) => ["IntegerPartition", listOf(text)],
  DyckPath: (text) => ["DyckPath", listOf(text)],
  SetPartition: (text) => [
    "SetPartition",
    ["List", ...(JSON.parse(text.replace(/\{/g, "[").replace(/\}/g, "]")) as number[][]).map((b) => ["List", ...b])],
  ],
};

/** `CombinatorialStat(object, "Name")` (or the map's) for FindStat's first sample, when we can read its text. */
export function liveExpression(field: Field): unknown {
  // The first object big enough to show something: not the empty one, nor a single point.
  const samples = field.findstat.flatMap((f) => f.sample ?? []);
  const sample =
    samples.find(([object]) => object.length >= 5) ?? samples.find(([object]) => !/^(\[\]|\{\})$/.test(object));
  const read = READERS[field.carrier];
  if (!sample || !read) return undefined;
  try {
    return [field.kind === "statistic" ? "CombinatorialStat" : "CombinatorialMap", read(sample[0]), `'${field.name}'`];
  } catch {
    return undefined;
  }
}

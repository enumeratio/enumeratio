// The Language Reference sidebar, derived from the same NODES dataset the pages come from. config.ts imports
// `referenceSidebarItems` and drops it under the section header — so adding a head to nodes.ts wires its nav
// entry automatically (no separate edit here). Legacy groups (the primitives / list ops / counting sequences,
// and the collection pages not yet migrated into the dataset) are listed explicitly until their families land.
import { NODES } from "./nodes.js";

type Item = { text: string; link?: string; items?: Item[]; collapsed?: boolean };

// hand-authored pages that predate the dataset — keep their nav until each is migrated into nodes.ts.
const LEGACY_GROUPS: Item[] = [
  {
    text: "Generic primitives",
    items: [
      { text: "unrank", link: "/reference/unrank" },
      { text: "rank", link: "/reference/rank" },
      { text: "random_element", link: "/reference/random-element" },
      { text: "cardinality", link: "/reference/cardinality" },
    ],
  },
  {
    text: "List operations",
    items: [
      { text: "join", link: "/reference/join" },
      { text: "sort", link: "/reference/sort" },
      { text: "unique", link: "/reference/unique" },
    ],
  },
  {
    text: "Counting sequences",
    items: [
      { text: "BellB", link: "/reference/bell-b" },
      { text: "CatalanNumber", link: "/reference/catalan-number" },
      { text: "Fubini", link: "/reference/fubini" },
      { text: "PartitionsP", link: "/reference/partitions-p" },
    ],
  },
];

// collection pages still hand-authored (not yet in NODES); drop each row once its family is migrated.
const LEGACY_COLLECTIONS: Item[] = [
  { text: "IntegerPartitions", link: "/reference/integer-partitions" },
  { text: "Subsets", link: "/reference/subsets" },
  { text: "DyckPaths", link: "/reference/dyck-paths" },
];

/** One collapsible group per collection family present in the dataset, in first-seen order. */
function familyGroups(): Item[] {
  const groups = new Map<string, Item[]>();
  for (const n of NODES) {
    if (!groups.has(n.family)) groups.set(n.family, []);
    groups.get(n.family)!.push({ text: n.head, link: `/reference/${n.slug ?? n.head}` });
  }
  return [...groups].map(([text, items]) => ({ text, collapsed: true, items }));
}

export const referenceSidebarItems: Item[] = [
  ...LEGACY_GROUPS,
  ...familyGroups(),
  ...(LEGACY_COLLECTIONS.length ? [{ text: "Collections (not yet migrated)", collapsed: true, items: LEGACY_COLLECTIONS }] : []),
];

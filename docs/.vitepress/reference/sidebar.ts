// The Language Reference sidebar, derived entirely from the NODES dataset the pages come from. config.ts imports
// `referenceSidebarItems` and drops it under the section header — so adding a head to nodes.ts wires its nav entry
// automatically (no separate edit here). The legacy hand-authored reference pages (primitives / list ops / counting
// sequences / un-migrated collections) were removed; entities land in the sidebar only once they're real nodes.
import { NODES } from "./nodes.js";

type Item = { text: string; link?: string; items?: Item[]; collapsed?: boolean };

/** One collapsible group per collection family present in the dataset, in first-seen order. */
function familyGroups(): Item[] {
  const groups = new Map<string, Item[]>();
  for (const n of NODES) {
    if (!groups.has(n.family)) groups.set(n.family, []);
    groups.get(n.family)!.push({ text: n.head, link: `/reference/${n.slug ?? n.head}` });
  }
  return [...groups].map(([text, items]) => ({ text, collapsed: true, items }));
}

export const referenceSidebarItems: Item[] = familyGroups();

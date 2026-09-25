// The seam between the review sidebar (ReviewPanel.vue / store.ts) and wherever the
// backlog actually lives. Today that's the dev-server's markdown-backed REST API
// (see web/.vitepress/review/plugin.ts and backlog.ts); the panel only ever talks to
// this interface, so a later "any user collects feedback on page elements" tool could
// swap in a different BacklogSource without touching the panel.
import type { BacklogItem, ItemPatch } from "../../review/backlog.ts";

export interface Backlog {
  path: string;
  items: BacklogItem[];
}

export interface BacklogSource {
  load(): Promise<Backlog>;
  save(id: string, patch: ItemPatch): Promise<BacklogItem>;
  /** Subscribe to out-of-band changes (e.g. the file edited by hand); returns an unsubscribe. */
  onChange(cb: () => void): () => void;
}

export const httpBacklogSource: BacklogSource = {
  async load() {
    const res = await fetch("/__review/backlog");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as Backlog;
  },
  async save(id, patch) {
    const res = await fetch("/__review/item", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { item } = (await res.json()) as { item: BacklogItem };
    return item;
  },
  onChange(cb) {
    const hot = import.meta.hot;
    if (!hot) return () => {};
    const handler = (): void => cb();
    hot.on("review:changed", handler);
    return () => hot.off("review:changed", handler);
  },
};

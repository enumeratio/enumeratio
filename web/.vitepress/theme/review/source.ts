// The seam between the review sidebar (ReviewPanel.vue / store.ts) and wherever the
// backlog actually lives. Today that's the dev-server's markdown-backed REST API
// (see web/.vitepress/review/plugin.ts and backlog.ts); the panel only ever talks to
// this interface, so a later "any user collects feedback on page elements" tool could
// swap in a different BacklogSource without touching the panel.
import type { BacklogItem } from "../../review/backlog.ts";

export interface Backlog {
  path: string;
  items: BacklogItem[];
}

export interface BacklogSource {
  load(): Promise<Backlog>;
  /** Persist an existing item's current status/feedback (the id must already exist). */
  save(item: BacklogItem): Promise<BacklogItem>;
  /** Create an item if `item.id` isn't known yet, otherwise patch it like `save` --
   * used for ad-hoc items from a modifier-click (see ReviewPanel.vue / adhoc.ts). */
  createItem(item: BacklogItem): Promise<BacklogItem>;
  /** Subscribe to out-of-band changes (e.g. the file edited by hand); returns an unsubscribe. */
  onChange(cb: () => void): () => void;
}

async function postItem(body: Record<string, unknown>): Promise<BacklogItem> {
  const res = await fetch("/__review/item", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const { item } = (await res.json()) as { item: BacklogItem };
  return item;
}

export const httpBacklogSource: BacklogSource = {
  async load() {
    const res = await fetch("/__review/backlog");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as Backlog;
  },
  save(item) {
    return postItem({ id: item.id, status: item.status, feedback: item.feedback });
  },
  createItem(item) {
    return postItem({
      id: item.id,
      title: item.title,
      bullets: item.bullets,
      status: item.status,
      feedback: item.feedback,
    });
  },
  onChange(cb) {
    const hot = import.meta.hot;
    if (!hot) return () => {};
    const handler = (): void => cb();
    hot.on("review:changed", handler);
    return () => hot.off("review:changed", handler);
  },
};

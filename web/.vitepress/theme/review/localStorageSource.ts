// Off-localhost BacklogSource: localStorage only, no server, no identity, no GitHub
// API (see AGENTS.md). Every prod/preview visitor who leaves ad-hoc feedback via a
// modifier-click keeps it in their own browser; there's nothing to sync it to.
import type { BacklogSource } from "./source.ts";
import { putLocalEntry, readLocalEntries } from "./localStorage.ts";

export const localStorageSource: BacklogSource = {
  async load() {
    const entries = readLocalEntries();
    return { path: "localStorage", items: Object.values(entries).map((e) => e.item) };
  },
  async save(item) {
    putLocalEntry(item, false);
    return item;
  },
  async createItem(item) {
    putLocalEntry(item, false);
    return item;
  },
  onChange() {
    return () => {};
  },
};

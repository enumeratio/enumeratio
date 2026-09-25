// Shared reactive state for the review sidebar. A module-level singleton (not a
// per-component instance) so the floating panel and the `/review` landing page --
// which both mount independently -- see the same open/closed state and selection.
// Persists open/closed and the selected item id to localStorage (wrapped in
// try/catch: private browsing, quota, blocked storage all fail silently here).
import { computed, ref, watch } from "vue";
import type { BacklogItem, ItemStatus } from "../../review/backlog.ts";
import { type BacklogSource, httpBacklogSource } from "./source.ts";

const OPEN_KEY = "review-panel:open";
const SELECTED_KEY = "review-panel:selected";

function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeLocal(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function prField(item: BacklogItem, index: number): string {
  return (
    (item.pr ?? "")
      .split("·")
      .map((s) => s.trim())
      .filter(Boolean)[index] ?? ""
  );
}
export function prNumber(item: BacklogItem): string {
  return prField(item, 0).replace(/^#/, "");
}
export function area(item: BacklogItem): string {
  return prField(item, 1);
}
export { prField };

export function createReviewStore(source: BacklogSource = httpBacklogSource) {
  const path = ref("");
  const items = ref<BacklogItem[]>([]);
  const loaded = ref(false);
  const loadError = ref("");

  const isOpen = ref(readLocal(OPEN_KEY) === "1");
  const selectedId = ref<string | null>(readLocal(SELECTED_KEY));
  watch(isOpen, (v) => writeLocal(OPEN_KEY, v ? "1" : null));
  watch(selectedId, (v) => writeLocal(SELECTED_KEY, v));

  const statusFilter = ref<"all" | ItemStatus>("all");
  const areaFilter = ref<string>("all");
  const search = ref("");

  const draft = ref("");
  const saveState = ref<"idle" | "saving" | "saved" | "error">("idle");
  let saveTimer: ReturnType<typeof setTimeout> | undefined;

  const areas = computed(() => {
    const set = new Set<string>();
    for (const it of items.value) {
      const a = area(it);
      if (a) set.add(a);
    }
    return [...set].sort();
  });

  const filtered = computed(() => {
    const q = search.value.trim().toLowerCase();
    return items.value.filter((it) => {
      if (statusFilter.value !== "all" && it.status !== statusFilter.value) return false;
      if (areaFilter.value !== "all" && area(it) !== areaFilter.value) return false;
      if (
        q &&
        !(
          it.title.toLowerCase().includes(q) ||
          it.id.toLowerCase().includes(q) ||
          (it.check ?? "").toLowerCase().includes(q)
        )
      )
        return false;
      return true;
    });
  });

  const selected = computed(() => items.value.find((i) => i.id === selectedId.value) ?? null);

  /** The item `/review` should land on: the persisted selection if it still exists,
   * else the first open item, else the first item at all. */
  const landingItem = computed<BacklogItem | null>(() => {
    const persisted = items.value.find((i) => i.id === selectedId.value);
    if (persisted) return persisted;
    return items.value.find((i) => i.status === "open") ?? items.value[0] ?? null;
  });

  async function load(preserveSelection: boolean): Promise<void> {
    try {
      const data = await source.load();
      path.value = data.path;
      items.value = data.items;
      loaded.value = true;
      loadError.value = "";
      const stillThere = preserveSelection && items.value.some((i) => i.id === selectedId.value);
      if (!stillThere) selectedId.value = items.value[0]?.id ?? null;
    } catch (e) {
      loaded.value = true;
      loadError.value = e instanceof Error ? e.message : String(e);
    }
  }

  function selectItem(id: string): void {
    void flushSave();
    selectedId.value = id;
  }

  watch(
    () => selected.value?.id,
    () => {
      draft.value = selected.value?.feedback ?? "";
      saveState.value = "idle";
    },
    { immediate: true },
  );

  function scheduleSave(): void {
    saveState.value = "saving";
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void flushSave(), 800);
  }

  async function flushSave(): Promise<void> {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = undefined;
    }
    const item = selected.value;
    if (!item || draft.value === item.feedback) {
      if (saveState.value === "saving") saveState.value = "idle";
      return;
    }
    saveState.value = "saving";
    try {
      const updated = await source.save(item.id, { feedback: draft.value });
      const idx = items.value.findIndex((i) => i.id === updated.id);
      if (idx !== -1) items.value[idx] = updated;
      saveState.value = "saved";
    } catch {
      saveState.value = "error";
    }
  }

  async function setStatus(status: ItemStatus): Promise<void> {
    const item = selected.value;
    if (!item) return;
    const previous = item.status;
    item.status = status; // optimistic
    try {
      const updated = await source.save(item.id, { status });
      const idx = items.value.findIndex((i) => i.id === updated.id);
      if (idx !== -1) items.value[idx] = updated;
    } catch {
      item.status = previous;
    }
  }

  let unsubscribe: (() => void) | undefined;
  let initialized = false;
  function init(): void {
    if (initialized) return;
    initialized = true;
    // `true`: keep a selection restored from localStorage if that item still exists,
    // rather than always resetting to the first item on a fresh page load.
    void load(true);
    unsubscribe = source.onChange(() => void load(true));
  }
  function dispose(): void {
    unsubscribe?.();
    initialized = false;
  }

  return {
    path,
    items,
    loaded,
    loadError,
    isOpen,
    selectedId,
    statusFilter,
    areaFilter,
    search,
    draft,
    saveState,
    areas,
    filtered,
    selected,
    landingItem,
    load,
    selectItem,
    scheduleSave,
    flushSave,
    setStatus,
    init,
    dispose,
  };
}

export type ReviewStore = ReturnType<typeof createReviewStore>;

// One store for the whole client session -- see the module comment above.
let singleton: ReviewStore | undefined;
export function useReviewStore(): ReviewStore {
  if (!singleton) singleton = createReviewStore();
  return singleton;
}

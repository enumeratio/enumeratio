// Shared reactive state for the review sidebar. A module-level singleton (not a
// per-component instance) so the floating panel and the `/review` landing page --
// which both mount independently -- see the same open/closed state and selection.
// Persists open/closed and the selected item id to localStorage (wrapped in
// try/catch: private browsing, quota, blocked storage all fail silently here).
import { computed, ref, watch } from "vue";
import { buildAdhocItem } from "../../review/adhoc.ts";
import type { BacklogItem, ItemStatus } from "../../review/backlog.ts";
import { serializeItem } from "../../review/backlog.ts";
import { resolveReviewLink, splitHash } from "../../review/link.ts";
import { fileSource } from "./fileSource.ts";
import { isLocalhost } from "./mode.ts";
import { localStorageSource } from "./localStorageSource.ts";
import type { BacklogSource } from "./source.ts";

/** Localhost gets the file-backed source (REVIEW.md through the dev plugin, with a
 * localStorage write-behind cache); everywhere else is localStorage only -- see
 * AGENTS.md's persistence requirement. */
function pickSource(): BacklogSource {
  return isLocalhost() ? fileSource : localStorageSource;
}

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

export function createReviewStore(source: BacklogSource = pickSource()) {
  const path = ref("");
  const items = ref<BacklogItem[]>([]);
  const loaded = ref(false);
  const loadError = ref("");

  // Collapsed on every page load; `/review` and `?review` open it explicitly.
  const isOpen = ref(false);
  const selectedId = ref<string | null>(readLocal(SELECTED_KEY));
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
      const updated = await source.save({ ...item, feedback: draft.value });
      const idx = items.value.findIndex((i) => i.id === updated.id);
      if (idx !== -1) items.value[idx] = updated;
      saveState.value = "saved";
    } catch {
      saveState.value = "error";
    }
  }

  /** Set an item's status: the selected one unless another is given (the list's checkboxes). */
  async function setStatus(status: ItemStatus, item: BacklogItem | null = selected.value): Promise<void> {
    if (!item) return;
    const previous = item.status;
    item.status = status; // optimistic
    try {
      const updated = await source.save({ ...item, status });
      const idx = items.value.findIndex((i) => i.id === updated.id);
      if (idx !== -1) items.value[idx] = updated;
    } catch {
      item.status = previous;
    }
  }

  /** Find an existing item whose link targets this page path + anchor id, resolved
   * through link.ts exactly like the sidebar itself resolves links -- so a
   * modifier-click on an already-reviewed element reopens that item instead of
   * creating a duplicate. */
  function findByTarget(path: string, anchorId: string): BacklogItem | undefined {
    return items.value.find((i) => {
      if (!i.link) return false;
      const resolved = resolveReviewLink(i.link);
      if (resolved.kind !== "local") return false;
      const { path: p, id } = splitHash(resolved.path);
      return p === path && id === anchorId;
    });
  }

  /** Modifier-click entry point (see ReviewPanel.vue): reuse a matching item, or
   * create a fresh ad-hoc one keyed on page path + anchor id (an opaque string --
   * never parsed for shape, see adhoc.ts) and select it. */
  async function selectOrCreateAdhoc(pageLabel: string, path: string, anchorId: string): Promise<void> {
    const existing = findByTarget(path, anchorId);
    if (existing) {
      selectItem(existing.id);
      return;
    }
    const item = buildAdhocItem(pageLabel, path, anchorId);
    const created = await source.createItem(item);
    items.value.push(created);
    selectItem(created.id);
  }

  const copyState = ref<"idle" | "copied" | "error">("idle");
  let copyTimer: ReturnType<typeof setTimeout> | undefined;

  /** All items with feedback -- including ad-hoc ones -- as REVIEW.md-compatible
   * markdown (the same `###` / `#### Feedback` shape the serializer produces for the
   * real file), so it can be pasted back in by hand. */
  async function copyFeedback(): Promise<void> {
    const withFeedback = items.value.filter((i) => i.feedback.trim().length > 0);
    const markdown = withFeedback.map(serializeItem).join("\n");
    try {
      await navigator.clipboard.writeText(markdown);
      copyState.value = "copied";
    } catch {
      copyState.value = "error";
    }
    if (copyTimer) clearTimeout(copyTimer);
    copyTimer = setTimeout(() => (copyState.value = "idle"), 1800);
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
    findByTarget,
    selectOrCreateAdhoc,
    copyState,
    copyFeedback,
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

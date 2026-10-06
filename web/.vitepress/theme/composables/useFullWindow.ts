import { computed, onScopeDispose, ref, watch, type Ref } from "vue";

/**
 * Full-window state for a display panel: the panel's live area covers the browser window
 * (CSS, not the Fullscreen API). Esc exits, and body scroll is locked while active.
 * Bind `class` and `style` on the panel root; the CSS that does the covering lives with the panel.
 *
 * `root` is the panel element: its height is held while the live area leaves the flow, so the
 * page behind does not collapse and lose the reader's scroll position.
 */
export function useFullWindow(root?: Ref<HTMLElement | null | undefined>) {
  const active = ref(false);
  const heldHeight = ref(0);

  const toggle = (): void => {
    if (!active.value) heldHeight.value = root?.value?.offsetHeight ?? 0;
    active.value = !active.value;
  };
  const exit = (): void => {
    active.value = false;
  };

  const label = computed(() => (active.value ? "Exit full window" : "Full window"));
  /** Hook for panel content that adapts (`var(--story-full-window)`); unset otherwise. */
  const style = computed(() =>
    active.value
      ? { "--story-full-window": "1", ...(heldHeight.value ? { height: `${heldHeight.value}px` } : {}) }
      : undefined,
  );

  const onKey = (event: KeyboardEvent): void => {
    if (event.key === "Escape") exit();
  };
  let restoreScroll: (() => void) | undefined;
  const release = (): void => {
    window.removeEventListener("keydown", onKey);
    restoreScroll?.();
    restoreScroll = undefined;
  };

  watch(
    active,
    (on) => {
      if (!on) return release();
      window.addEventListener("keydown", onKey);
      const previous = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      restoreScroll = () => {
        document.body.style.overflow = previous;
      };
    },
    { flush: "sync" },
  );
  // Elements that size themselves from `window` events, not a ResizeObserver, reflow too.
  watch(active, () => requestAnimationFrame(() => window.dispatchEvent(new Event("resize"))), { flush: "post" });
  onScopeDispose(release);

  return { active, label, style, toggle, exit };
}

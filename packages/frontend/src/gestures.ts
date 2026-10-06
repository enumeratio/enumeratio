// Gesture handling for every plot, 2-D and 3-D, after the map embeds' (Google Maps'
// `gestureHandling`, Mapbox's `cooperativeGestures`). It decides only whether a wheel goes to the
// plot or the page; how the plot then moves (orbit, turntable, pan and zoom) is its camera's own.
//
//   cooperative  the default: the page scrolls unless the plot is engaged — focused (a click or
//                tab into it) or filling the window — or ⌘/Ctrl is held, which is also how
//                browsers report a trackpad pinch;
//   greedy       every wheel over the plot is the plot's;
//   none         the plot never takes the wheel.

export type GestureHandling = "cooperative" | "greedy" | "none";

export const gestureHandlingOf = (value: unknown): GestureHandling =>
  value === "greedy" || value === "none" ? value : "cooperative";

/** Whether a wheel event over `host` should zoom it rather than scroll the page. */
export function wheelZooms(
  e: WheelEvent,
  host: Element | null | undefined,
  handling: GestureHandling = "cooperative",
): boolean {
  if (handling === "none") return false;
  if (handling === "greedy" || e.ctrlKey || e.metaKey) return true;
  if (!host) return false;
  const active = host.ownerDocument?.activeElement;
  if (active && (active === host || host.contains(active))) return true;
  return host.closest(".is-full-window") !== null;
}

/** Engage a plot on pointer down: focus its surface, so the wheel zooms it until focus leaves. */
export function engage(e: PointerEvent): void {
  (e.currentTarget as HTMLElement | null)?.focus?.({ preventScroll: true });
}

/** The gesture, for a tooltip. */
export const WHEEL_HINT = "click, then scroll to zoom · or ⌘/Ctrl+scroll";

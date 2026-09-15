// A small floating panel hung under an inline control -- the entry menu of a toggler,
// the speed and loop panel of a play button. Lives on `document.body` rather than in
// the sentence, where a panel's box would break the line it hangs off.
//
// Uses the Popover API when the browser has it -- top layer and light dismiss for free
// -- and a fixed-position box with its own outside-click listener when it does not.
// Placement is measured rather than anchor-positioned, since CSS anchor positioning is
// not yet something every current browser does.

export interface Mounted {
  /** Close and remove the panel. Idempotent; also what light dismiss ends up calling. */
  close: () => void;
}

/**
 * Show `panel` under `anchor`. Focus returns to the anchor on close; `onClose` fires
 * once, however the panel went away -- a pick, Escape, a click elsewhere.
 */
export function mountPopover(
  anchor: HTMLElement,
  panel: HTMLElement,
  onClose?: () => void,
): Mounted {
  const native = "popover" in HTMLElement.prototype;
  if (native) panel.setAttribute("popover", "auto");

  let open = true;
  const close = (): void => {
    if (!open) return;
    open = false;
    document.removeEventListener("pointerdown", onOutside, true);
    if (native && panel.matches(":popover-open")) panel.hidePopover();
    panel.remove();
    anchor.focus({ preventScroll: true });
    onClose?.();
  };
  const onOutside = (event: PointerEvent): void => {
    if (!panel.contains(event.target as Node)) close();
  };

  panel.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      close();
      event.preventDefault();
    }
  });
  // Light dismiss (a click elsewhere, Escape) closes a native popover on its own; the
  // element has to go with it.
  if (native) {
    panel.addEventListener("toggle", (e) => {
      if ((e as ToggleEvent).newState === "closed") close();
    });
  }

  document.body.append(panel);
  if (native) panel.showPopover();
  else document.addEventListener("pointerdown", onOutside, true);
  place(panel, anchor);
  return { close };
}

/** Under the anchor, left-aligned; above it when the viewport runs out below. */
function place(panel: HTMLElement, anchor: HTMLElement): void {
  const a = anchor.getBoundingClientRect();
  const m = panel.getBoundingClientRect();
  const gap = 4;
  const below = a.bottom + gap + m.height <= window.innerHeight;
  const top = below ? a.bottom + gap : Math.max(gap, a.top - gap - m.height);
  const left = Math.max(gap, Math.min(a.left, window.innerWidth - m.width - gap));
  panel.style.top = `${top}px`;
  panel.style.left = `${left}px`;
}

/**
 * A long press on a button, for opening a panel off a control whose click already
 * means something. The press ARMS on the timer and the release fires: a popover shown
 * mid-press would be light-dismissed by the very release that follows. The click the
 * release also produces is swallowed, and a right-click fires at once.
 *
 * Bind the four handlers to the button; `fire` is called with the button.
 */
export class LongPress {
  #timer: ReturnType<typeof setTimeout> | undefined;
  #armed = false;
  #swallow = false;

  constructor(
    private readonly ms: number,
    private readonly fire: (anchor: HTMLElement) => void,
  ) {}

  down = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    this.#armed = false;
    this.#swallow = false;
    this.#clear();
    this.#timer = setTimeout(() => (this.#armed = true), this.ms);
  };

  up = (event: PointerEvent): void => {
    this.#clear();
    if (!this.#armed) return;
    this.#armed = false;
    this.#swallow = true;
    this.fire(event.currentTarget as HTMLElement);
  };

  cancel = (): void => {
    this.#clear();
    this.#armed = false;
  };

  /** Returns true when the click was the tail of a long press and should be ignored. */
  click = (event: Event): boolean => {
    if (!this.#swallow) return false;
    this.#swallow = false;
    event.preventDefault();
    return true;
  };

  contextmenu = (event: Event): void => {
    event.preventDefault();
    this.#clear();
    this.fire(event.currentTarget as HTMLElement);
  };

  #clear(): void {
    if (this.#timer !== undefined) clearTimeout(this.#timer);
    this.#timer = undefined;
  }
}

// The options menu a toggler opens on long-press or right-click: every entry, laid
// out as a listbox you can pick from directly instead of cycling to it.

import { loadMarkup } from "./mathlive.ts";
import { mountPopover } from "./popover.ts";
import { looksLikeMath } from "@enumeratio/notatio";

export interface ChoiceMenuOptions {
  /** The grip the menu hangs under. Focus returns here when the menu closes. */
  anchor: HTMLElement;
  /** Rendered markup per entry, from `entryMarkup`. */
  items: string[];
  selected: number;
  label: string;
  onPick: (index: number) => void;
  /** Called once, however the menu went away: a pick, Escape, a click elsewhere. */
  onClose?: () => void;
}

/**
 * How long a press has to be held before it means "show me the options". Longer than
 * the usual half second: a trackpad click is often a slow one, and a menu that opens
 * on a click you meant as a click is worse than one that takes a beat to reach.
 */
export const LONG_PRESS_MS = 750;

/** Pointer travel a press may make and still count as a press rather than a drag. */
export const PRESS_SLOP_PX = 4;

const escape = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** An entry as it appears in a grip or a menu: typeset when it is a value, prose when a word. */
export async function entryMarkup(source: string): Promise<string> {
  if (!source) return "";
  // A word, not a value -- typesetting it would italicise it into a product of variables.
  if (!looksLikeMath(source)) return escape(source);
  return (await loadMarkup())(source);
}

/**
 * Open the menu. Returns a function that closes it; the menu also closes itself on a
 * pick, on Escape, and on a click anywhere else.
 */
export function openChoiceMenu(options: ChoiceMenuOptions): () => void {
  const { anchor, items, selected, label, onPick, onClose } = options;
  const menu = document.createElement("div");
  menu.className = "notatio-choice-menu";
  menu.setAttribute("role", "listbox");
  menu.setAttribute("aria-label", label);

  const entries = items.map((markup, index) => {
    const el = document.createElement("div");
    el.className = "notatio-choice-option";
    el.setAttribute("role", "option");
    el.setAttribute("aria-selected", String(index === selected));
    el.tabIndex = -1;
    el.dataset.index = String(index);
    el.innerHTML = markup;
    menu.append(el);
    return el;
  });

  const mounted = mountPopover(anchor, menu, onClose);
  const pick = (index: number): void => {
    onPick(index);
    mounted.close();
  };

  menu.addEventListener("click", (event) => {
    const option = (event.target as HTMLElement).closest<HTMLElement>(".notatio-choice-option");
    if (option?.dataset.index !== undefined) pick(Number(option.dataset.index));
  });
  menu.addEventListener("keydown", (event) => {
    const current = entries.findIndex((el) => el === document.activeElement);
    const n = entries.length;
    const move = (to: number): void => {
      entries[((to % n) + n) % n]?.focus();
      event.preventDefault();
    };
    switch (event.key) {
      case "ArrowDown":
      case "ArrowRight":
        return move(current + 1);
      case "ArrowUp":
      case "ArrowLeft":
        return move(current - 1);
      case "Home":
        return move(0);
      case "End":
        return move(n - 1);
      case "Enter":
      case " ":
        if (current >= 0) pick(current);
        return event.preventDefault();
      default:
        return;
    }
  });

  (entries[selected] ?? entries[0])?.focus();
  return mounted.close;
}

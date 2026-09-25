// The panel a long press on a play button opens: how fast to play, and what to do at
// the ends (the `loop`). One panel for every control that plays -- an inline knob, a toggler, a
// Manipulate slider -- so the same two questions get the same two rows everywhere.

import { mountPopover } from "./popover.ts";
import { type Loop, LOOPS, RATES } from "@enumeratio/notatio";

export interface PlaybackSettings {
  rate: number;
  loop: Loop;
}

export interface PlaybackMenuOptions {
  anchor: HTMLElement;
  settings: PlaybackSettings;
  onChange: (settings: PlaybackSettings) => void;
  onClose?: () => void;
}

const rateLabel = (r: number): string => (r < 1 ? `×${r}`.replace("0.", ".") : `×${r}`);

/** Open the panel. A pick applies at once and the panel stays for the next one. */
export function openPlaybackMenu(options: PlaybackMenuOptions): () => void {
  const { anchor, onChange, onClose } = options;
  let settings = { ...options.settings };
  const panel = document.createElement("div");
  panel.className = "notatio-playback-menu";
  panel.setAttribute("role", "group");
  panel.setAttribute("aria-label", "playback");

  const row = <T extends string | number>(
    label: string,
    values: readonly T[],
    current: () => T,
    text: (v: T) => string,
    set: (v: T) => void,
  ): HTMLButtonElement[] => {
    const line = document.createElement("div");
    line.className = "notatio-playback-row";
    line.setAttribute("role", "radiogroup");
    line.setAttribute("aria-label", label);
    const caption = document.createElement("span");
    caption.className = "notatio-playback-label";
    caption.textContent = label;
    line.append(caption);
    const buttons = values.map((v) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "notatio-playback-choice";
      b.setAttribute("role", "radio");
      b.textContent = text(v);
      b.addEventListener("click", () => {
        set(v);
        for (const [i, other] of buttons.entries()) {
          other.setAttribute("aria-checked", String(values[i] === current()));
        }
        onChange({ ...settings });
      });
      line.append(b);
      return b;
    });
    for (const [i, b] of buttons.entries()) b.setAttribute("aria-checked", String(values[i] === current()));
    panel.append(line);
    return buttons;
  };

  const rates = row(
    "speed",
    RATES,
    () => settings.rate,
    rateLabel,
    (r) => (settings = { ...settings, rate: r }),
  );
  row(
    "loop",
    LOOPS,
    () => settings.loop,
    (c) => c,
    (c) => (settings = { ...settings, loop: c }),
  );

  const mounted = mountPopover(anchor, panel, onClose);
  // Arrow keys move within the panel: left/right along a row, up/down between them.
  panel.addEventListener("keydown", (event) => {
    const rows = [...panel.querySelectorAll<HTMLElement>(".notatio-playback-row")].map((r) => [
      ...r.querySelectorAll<HTMLButtonElement>("button"),
    ]);
    const active = document.activeElement as HTMLButtonElement;
    const r = rows.findIndex((row) => row.includes(active));
    if (r < 0) return;
    const c = rows[r].indexOf(active);
    let target: HTMLButtonElement | undefined;
    if (event.key === "ArrowRight") target = rows[r][c + 1];
    else if (event.key === "ArrowLeft") target = rows[r][c - 1];
    else if (event.key === "ArrowDown") target = rows[r + 1]?.[Math.min(c, (rows[r + 1]?.length ?? 1) - 1)];
    else if (event.key === "ArrowUp") target = rows[r - 1]?.[Math.min(c, (rows[r - 1]?.length ?? 1) - 1)];
    if (!target) return;
    target.focus();
    event.preventDefault();
  });
  (rates.find((b) => b.getAttribute("aria-checked") === "true") ?? rates[0])?.focus();
  return mounted.close;
}

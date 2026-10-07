// A figure's frame: the stage a plot draws on, with its caption and legend each placed beside
// it (above, below, left, right), over it in a corner, or not at all. Shared so every plot that
// adopts it places them the same way and takes the same `caption` and `legend` attributes.

import { html, nothing, type TemplateResult } from "lit";

export type FramePlacement =
  | "below"
  | "above"
  | "left"
  | "right"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "none";

export const FRAME_PLACEMENTS: readonly FramePlacement[] = [
  "below",
  "above",
  "left",
  "right",
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
  "none",
];

const OVERLAYS = new Set<FramePlacement>(["top-left", "top-right", "bottom-left", "bottom-right"]);

export const isOverlay = (at: FramePlacement): boolean => OVERLAYS.has(at);

/** A placement attribute's value, or the fallback for anything else. */
export const placementOf = (value: string | null | undefined, fallback: FramePlacement): FramePlacement =>
  FRAME_PLACEMENTS.includes(value as FramePlacement) ? (value as FramePlacement) : fallback;

/** Whether content placed here reads down rather than across: beside the stage, or over it. */
export const isVertical = (at: FramePlacement): boolean => at === "left" || at === "right" || isOverlay(at);

export interface FrameParts {
  readonly toolbar?: unknown;
  /** The drawing surface; it fills whatever room the frame leaves it. */
  readonly stage: TemplateResult;
  readonly caption?: unknown;
  readonly legend?: unknown;
  readonly captionAt: FramePlacement;
  readonly legendAt: FramePlacement;
  /** Inline style for the stage box: its height. */
  readonly stageStyle?: string;
}

/**
 * The frame as a grid — toolbar, then above / left · stage · right / below — with overlays
 * positioned inside the stage. A caption and a legend sharing a side stack, legend first.
 */
export function figureFrame(parts: FrameParts): TemplateResult {
  const slot = (at: FramePlacement) => {
    const items = [
      parts.legendAt === at && parts.legend !== undefined
        ? html`<div class="notatio-frame-legend">${parts.legend}</div>`
        : nothing,
      parts.captionAt === at && parts.caption !== undefined
        ? html`<figcaption class="notatio-frame-caption">${parts.caption}</figcaption>`
        : nothing,
    ];
    return items.every((i) => i === nothing) ? nothing : html`<div class=${`notatio-frame-${at}`}>${items}</div>`;
  };
  return html`<figure class="notatio-frame">
    ${parts.toolbar ?? nothing} ${slot("above")}
    <div class="notatio-frame-middle">
      ${slot("left")}
      <div class="notatio-frame-stage" style=${parts.stageStyle ?? ""}>
        ${parts.stage} ${[...OVERLAYS].map((at) => (isOverlay(at) ? slot(at) : nothing))}
      </div>
      ${slot("right")}
    </div>
    ${slot("below")}
  </figure>`;
}

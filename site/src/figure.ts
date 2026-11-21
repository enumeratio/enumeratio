/**
 * An element's figure, drawn by notatio: the glyph its front end draws for a
 * value of that head. Its own chunk, loaded when a page first shows a figure.
 */
import { HEAD_GLYPHS, glyphSvg } from '@notatio/frontend/core';

/** The attribute that marks where a figure goes; its value is the element as MathJSON. */
export const figureAttribute = 'data-figure';

/** Draws every figure marked under `root`. A value notatio has no glyph for is left as it is. */
export function drawFigures(root: ParentNode): void {
  for (const spot of root.querySelectorAll<HTMLElement>(`[${figureAttribute}]`)) {
    let json: unknown;
    try {
      json = JSON.parse(spot.getAttribute(figureAttribute) ?? 'null');
    } catch {
      continue;
    }
    spot.removeAttribute(figureAttribute);
    const head = Array.isArray(json) && typeof json[0] === 'string' ? json[0] : undefined;
    const kind = head === undefined ? undefined : (HEAD_GLYPHS as Record<string, string>)[head];
    const svg = glyphSvg(kind, json as never);
    if (svg !== undefined) spot.innerHTML = svg;
  }
}

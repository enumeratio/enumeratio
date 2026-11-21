/**
 * Mathematics in a notatio record's sentence, typeset by notatio's own renderer. Its own chunk,
 * with KaTeX's stylesheet and fonts, loaded only when a page shows a sentence with an island.
 */
import { renderSummary } from '@notatio/formats/typeset';
import 'katex/dist/katex.min.css';
import { summaryAttribute } from './live.ts';

/** Typesets every marked sentence under `root`. `renderSummary` escapes; the text is passed as it is. */
export function typesetSummaries(root: ParentNode): void {
  for (const spot of root.querySelectorAll<HTMLElement>(`[${summaryAttribute}]`)) {
    spot.removeAttribute(summaryAttribute);
    spot.innerHTML = renderSummary(spot.textContent ?? '');
  }
}

import type { Env } from './live.ts';
import { pickerTarget } from './live.ts';
import { type Page, renderPage, sectionId } from './pages.ts';

export interface StartOptions {
  /**
   * Loads what the computed parts of a page ask (the kernel), the first time a
   * page needs it and after that page's shell is drawn. Without it the
   * computed parts stay as they were drawn.
   */
  loadEnv?: () => Promise<Env>;
  /** Called with each computed part once it is drawn, for what is added to it afterwards (figures). */
  decorate?: (drawn: HTMLElement) => void;
}

export type Win = Window & typeof globalThis;

/** How long the kernel waits for a frame before it starts anyway, in milliseconds. */
const paintWait = 100;

type Navigation = 'initial' | 'push' | 'pop';

/** Path and query as the browser holds them: the one normalization every comparison goes through. */
function normalized(target: string, base: string): string {
  const url = new URL(target, base);
  return url.pathname + url.search;
}

function setHeadElement(
  doc: Document,
  selector: string,
  create: () => HTMLElement,
  present: boolean,
): HTMLElement | null {
  let el = doc.head.querySelector<HTMLElement>(selector);
  if (!present) {
    el?.remove();
    return null;
  }
  if (!el) {
    el = create();
    doc.head.append(el);
  }
  return el;
}

/** Scrolls to the element a hash names; a malformed hash names nothing. */
function scrollToHash(win: Win): boolean {
  const raw = win.location.hash.slice(1);
  if (raw === '') return false;
  let id = raw;
  try {
    id = decodeURIComponent(raw);
  } catch {
    // a malformed escape: try the hash as written
  }
  const target = win.document.getElementById(id);
  if (!target) return false;
  target.scrollIntoView();
  return true;
}

/**
 * Draws the page for the window's location, and takes over internal link clicks and back/forward.
 * Returns a function that undoes the listeners.
 */
export function start(win: Win, options: StartOptions = {}): () => void {
  const doc = win.document;
  const app = doc.getElementById('app');
  if (!app) throw new Error('no #app element');
  // Back and forward restore the scroll position themselves.
  win.history.scrollRestoration = 'auto';
  let shown = '';
  /** Counts the pages drawn, so an answer that arrives after the reader has moved on is dropped. */
  let drawn = 0;
  let env: Promise<Env> | undefined;

  /** Fills in the computed parts of the page just drawn, one after another, once the shell has painted. */
  async function compute(page: Page, turn: number): Promise<void> {
    if (!options.loadEnv || (!page.sections && !page.moveTo && !page.nonMember)) return;
    // After the first paint, but never waiting on one: a hidden tab fires no animation frame.
    await new Promise<void>((done) => {
      let finished = false;
      const finish = (): void => {
        if (finished) return;
        finished = true;
        done();
      };
      if (typeof win.requestAnimationFrame === 'function') win.requestAnimationFrame(finish);
      win.setTimeout(finish, paintWait);
    });
    env ??= options.loadEnv();
    const kernel = await env;
    if (page.moveTo) {
      const to = await page.moveTo(kernel);
      if (turn !== drawn) return;
      if (to !== undefined && normalized(to, win.location.href) !== shown) {
        win.history.replaceState(win.history.state, '', new URL(to, win.location.href).href);
        show('initial');
        return;
      }
    }
    if (page.nonMember && (await page.nonMember(kernel))) {
      if (turn !== drawn) return;
      // No canonical form for a non-member: the same as an unreadable address.
      setHeadElement(doc, 'link[rel="canonical"]', () => doc.createElement('link'), false);
      setHeadElement(
        doc,
        'meta[name="robots"]',
        () => {
          const el = doc.createElement('meta');
          el.setAttribute('name', 'robots');
          el.setAttribute('content', 'noindex');
          return el;
        },
        true,
      );
    }
    for (const section of page.sections ?? []) {
      let body: string;
      try {
        body = (await section.run(kernel)).value;
      } catch (error) {
        body = '<p class="notice"><span class="declined">not computed</span></p>';
        console.error(error);
      }
      if (turn !== drawn) return;
      const target = doc.getElementById(sectionId(section.id))?.querySelector('.pending');
      if (target) {
        target.outerHTML = `<div class="computed">${body}</div>`;
        const filled = doc.getElementById(sectionId(section.id));
        if (filled) options.decorate?.(filled);
      }
    }
  }

  /** Reads the location, moves a non-canonical address to its canonical one once, and draws. */
  function show(how: Navigation): void {
    const page = renderPage(win.location.pathname, win.location.search);
    if (page.replaceWith !== undefined) {
      const here = win.location.href;
      const target = new URL(page.replaceWith + win.location.hash, here);
      // Compared after one normalization (the browser percent-encodes some marks the codec writes
      // raw), and replaced at most once per draw, and only when the URL would change.
      if (
        normalized(page.replaceWith, here) !== win.location.pathname + win.location.search &&
        target.href !== here
      ) {
        win.history.replaceState(win.history.state, '', target.href);
      }
    }
    shown = win.location.pathname + win.location.search;
    doc.title = page.title;
    setHeadElement(
      doc,
      'link[rel="canonical"]',
      () => {
        const el = doc.createElement('link');
        el.rel = 'canonical';
        return el;
      },
      page.canonical !== undefined,
    )?.setAttribute('href', page.canonical ?? '');
    setHeadElement(
      doc,
      'meta[name="robots"]',
      () => {
        const el = doc.createElement('meta');
        el.setAttribute('name', 'robots');
        el.setAttribute('content', 'noindex');
        return el;
      },
      page.noindex,
    );
    (app as HTMLElement).innerHTML = page.body.value;
    drawn += 1;
    void compute(page, drawn).catch((error: unknown) => console.error(error));
    if (how === 'pop') return;
    if (!scrollToHash(win) && how === 'push') win.scrollTo(0, 0);
  }

  const onClick = (event: MouseEvent): void => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = (event.target as Element | null)?.closest('a');
    if (!anchor || anchor.target || anchor.hasAttribute('download')) return;
    const url = new URL(anchor.href, win.location.href);
    if (url.origin !== win.location.origin) return;
    if (url.pathname + url.search === win.location.pathname + win.location.search) {
      // The same page: nothing to draw. A hash is the browser's to follow; the same URL does nothing.
      if (url.hash === '' || url.href === win.location.href) event.preventDefault();
      return;
    }
    event.preventDefault();
    win.history.pushState(null, '', url.pathname + url.search + url.hash);
    show('push');
  };

  const onPop = (): void => {
    // A hash-only step between two entries of one page does not redraw it.
    if (win.location.pathname + win.location.search === shown) return;
    show('pop');
  };

  /** A parameter picker: its form leads to the collection with the filled-in values bound. */
  const onSubmit = (event: Event): void => {
    const form = event.target as HTMLFormElement | null;
    const name = form?.getAttribute?.('data-picker');
    if (!form || name === null || name === undefined) return;
    event.preventDefault();
    const values = new Map<string, string>();
    for (const input of form.querySelectorAll('input')) values.set(input.name, input.value);
    const to = pickerTarget(name, values);
    if (to === undefined || to === win.location.pathname + win.location.search) return;
    win.history.pushState(null, '', to);
    show('push');
  };

  doc.addEventListener('submit', onSubmit);
  doc.addEventListener('click', onClick);
  win.addEventListener('popstate', onPop);
  show('initial');
  return () => {
    doc.removeEventListener('submit', onSubmit);
    doc.removeEventListener('click', onClick);
    win.removeEventListener('popstate', onPop);
  };
}

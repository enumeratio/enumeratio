// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vite-plus/test';
import { areas } from '@enumeratio/address';
import { path, query } from '../../packages/address/test/build.ts';
import { areaLink, renderPage } from '../src/pages.ts';
import { start } from '../src/router.ts';

const win = window as unknown as Window & typeof globalThis;
const atlas = areaLink(areas.atlas);
const about = areaLink(areas.about);
const app = () => document.getElementById('app') as HTMLElement;
const headings = () => app().querySelector('h1')?.textContent;

let stop = () => {};
/** Whether the last click was left to the browser; the click's own default is always cancelled after. */
let left = false;

function go(url: string): void {
  win.history.replaceState(null, '', url);
}

function attach(): void {
  stop = start(win);
  document.addEventListener('click', observe);
}

function begin(url: string): void {
  go(url);
  attach();
}

function click(a: HTMLAnchorElement, init: MouseEventInit = {}): void {
  left = false;
  a.dispatchEvent(
    new win.MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init }),
  );
}

function anchor(href: string, attributes: Record<string, string> = {}): HTMLAnchorElement {
  const a = document.createElement('a');
  a.setAttribute('href', href);
  for (const [k, v] of Object.entries(attributes)) a.setAttribute(k, v);
  document.getElementById('links')?.append(a);
  return a;
}

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '<nav id="links"></nav><div id="app"></div>';
});

/** Runs after the router's listener: records whether it left the click alone, then stops the
 * environment from navigating for real. */
const observe = (event: Event): void => {
  left = !event.defaultPrevented;
  event.preventDefault();
};

afterEach(() => {
  document.removeEventListener('click', observe);
  stop();
  stop = () => {};
  vi.restoreAllMocks();
});

describe('the router', () => {
  test('a plain click on an internal link is intercepted: pushState and a new page', () => {
    begin(path());
    const push = vi.spyOn(win.history, 'pushState');
    click(anchor(atlas));
    expect(left).toBe(false);
    expect(push).toHaveBeenCalledTimes(1);
    expect(win.location.pathname).toBe(atlas);
    expect(headings()).toBe('Atlas');
  });

  test.each([
    ['meta', { metaKey: true }],
    ['control', { ctrlKey: true }],
    ['shift', { shiftKey: true }],
    ['alt', { altKey: true }],
    ['middle button', { button: 1 }],
    ['secondary button', { button: 2 }],
  ] as [string, MouseEventInit][])('a %s click is left alone', (_name, init) => {
    begin(path());
    const push = vi.spyOn(win.history, 'pushState');
    click(anchor(atlas), init);
    expect(left).toBe(true);
    expect(push).not.toHaveBeenCalled();
    expect(win.location.pathname).toBe(path());
  });

  test('an external link, a target and a download are left alone', () => {
    begin(path());
    const push = vi.spyOn(win.history, 'pushState');
    for (const a of [
      anchor('https://example.invalid/atlas'),
      anchor(atlas, { target: '_blank' }),
      anchor(atlas, { download: '' }),
    ]) {
      click(a);
      expect(left).toBe(true);
    }
    expect(push).not.toHaveBeenCalled();
  });

  test('back and forward draw the page of the location', () => {
    begin(path());
    click(anchor(atlas));
    click(anchor(about));
    expect(headings()).toBe('About');
    go(atlas);
    win.dispatchEvent(new win.PopStateEvent('popstate'));
    expect(headings()).toBe('Atlas');
    go(path());
    win.dispatchEvent(new win.PopStateEvent('popstate'));
    expect(headings()).toBe('enumeratio');
  });

  test('a non-canonical path is moved once and does not loop', () => {
    const asked = path('collections', 'dyck-path');
    go(asked);
    const replace = vi.spyOn(win.history, 'replaceState');
    attach();
    expect(replace).toHaveBeenCalledTimes(1);
    expect(win.location.pathname).toBe(path('collection', 'DyckPath'));
    win.dispatchEvent(new win.PopStateEvent('popstate'));
    click(anchor(path('collection', 'DyckPath', '360')));
    expect(replace).toHaveBeenCalledTimes(1);
  });

  // The browser holds a quote in the query percent-encoded; the codec writes it raw.
  const quoted = query(['where', 'a%27b']);

  test('a quote in a query of an address already in place is not a move', () => {
    go(path('collection', 'DyckPath') + quoted);
    const replace = vi.spyOn(win.history, 'replaceState');
    stop = start(win);
    win.dispatchEvent(new win.PopStateEvent('popstate'));
    expect(replace).not.toHaveBeenCalled();
    expect(win.location.search).toBe(quoted);
  });

  test('a quote in a query does not make a moved address move again', () => {
    go(path('collections', 'dyck-path') + quoted);
    const replace = vi.spyOn(win.history, 'replaceState');
    attach();
    expect(replace).toHaveBeenCalledTimes(1);
    expect(win.location.pathname).toBe(path('collection', 'DyckPath'));
    const href = win.location.href;
    win.dispatchEvent(new win.PopStateEvent('popstate'));
    click(anchor(path('collection', 'DyckPath') + quoted + '#x'));
    expect(replace).toHaveBeenCalledTimes(1);
    expect(win.location.href.startsWith(href)).toBe(true);
  });

  test('a malformed hash does not stop the page from drawing', () => {
    expect(() => begin(atlas + '#%E0%A4%A')).not.toThrow();
    expect(headings()).toBe('Atlas');
  });

  test('a click that changes only the hash, or nothing, does not redraw', () => {
    begin(atlas);
    const drawn = app().firstElementChild;
    const push = vi.spyOn(win.history, 'pushState');
    click(anchor(atlas + '#statuses'));
    expect(left).toBe(true); // the browser follows the hash itself
    click(anchor(atlas));
    expect(left).toBe(false); // the same URL: nothing to do
    expect(push).not.toHaveBeenCalled();
    expect(app().firstElementChild).toBe(drawn);
  });

  test('back and forward leave the scroll to the browser; a push scrolls to the top', () => {
    begin(path());
    expect(win.history.scrollRestoration).toBe('auto');
    const scroll = vi.spyOn(win, 'scrollTo').mockImplementation(() => {});
    click(anchor(atlas));
    expect(scroll).toHaveBeenCalledTimes(1);
    scroll.mockClear();
    go(path());
    win.dispatchEvent(new win.PopStateEvent('popstate'));
    expect(headings()).toBe('enumeratio');
    expect(scroll).not.toHaveBeenCalled();
  });

  test('a pushed address with a hash does not scroll to the top', () => {
    begin(path());
    const scroll = vi.spyOn(win, 'scrollTo').mockImplementation(() => {});
    click(anchor(atlas + '#statuses'));
    // the hash names an element of the new page, or nothing: either way the top is not forced
    // unless there is no such element
    expect(win.location.hash).toBe('#statuses');
    expect(scroll.mock.calls.length).toBeLessThanOrEqual(1);
  });

  test('the canonical link and the robots element follow the page', () => {
    const canonical = () => document.head.querySelector('link[rel="canonical"]');
    const robots = () => document.head.querySelector('meta[name="robots"]');
    begin(atlas);
    expect(canonical()?.getAttribute('href')).toBe(renderPage(atlas, '').canonical);
    expect(robots()).toBeNull();
    click(anchor(path('nonesuch')));
    expect(canonical()).toBeNull();
    expect(robots()?.getAttribute('content')).toBe('noindex');
    click(anchor(about));
    expect(canonical()?.getAttribute('href')).toBe(renderPage(about, '').canonical);
    expect(robots()).toBeNull();
    expect(document.title).toBe(renderPage(about, '').title);
  });

  test('a deep address replaces anything drawn into the shell before the script ran', () => {
    app().innerHTML = '<main><h1>enumeratio</h1></main>';
    document.head.innerHTML = '<link rel="canonical" href="https://example.invalid/">';
    begin(atlas);
    expect(headings()).toBe('Atlas');
    expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      renderPage(atlas, '').canonical,
    );
  });
});

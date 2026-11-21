// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vite-plus/test';
import { areas } from '@enumeratio/address';
import type { Answer } from '@enumeratio/kernel';
import { rowByName } from '@enumeratio/routes';
import { path, query, rank, seg } from '../../packages/address/test/build.ts';
import { type Env, pickerTarget } from '../src/live.ts';
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

  describe('computed sections', () => {
    const param = (name: string, index: number): string =>
      rowByName.get(name)?.parameters?.[index]?.word ?? '';
    const dyckSizeFour = seg('DyckPath', [param('DyckPath', 0), 4]);
    // A Dyck path's word runs its digits together (the digits shape).
    const word = [1, 1, 0, 1, 0, 0, 1, 0];
    const dyckJson = ['DyckPath', ['List', ...word]];

    /** A kernel that answers every request the same, canned way, and records what it was asked. */
    function fakeEnv(answer: (epsil: string) => Answer, gate?: Promise<void>) {
      const asked: string[] = [];
      const described: string[] = [];
      const env: Env = {
        ask: async (epsil) => {
          asked.push(epsil);
          await gate;
          return answer(epsil);
        },
        describe: async (name) => {
          described.push(name);
          await gate;
          return `About ${name}.`;
        },
      };
      return { env, asked, described };
    }
    const value = (asked: string, json: unknown, epsil: string): Answer => ({
      asked,
      status: 'value',
      json,
      epsil,
    });
    const declined = (asked: string): Answer => ({ asked, status: 'declined', reason: 'canned' });

    test('the router fills a computed section: the placeholder is replaced by the answer', async () => {
      const { env, asked } = fakeEnv((e) => value(e, 77, '77'));
      go(path('collection', 'DyckPath'));
      stop = start(win, { loadEnv: async () => env });
      expect(app().querySelectorAll('.pending').length).toBeGreaterThan(0);
      await vi.waitFor(() => expect(app().querySelector('.pending')).toBeNull());
      expect(app().querySelectorAll('.computed').length).toBeGreaterThan(0);
      expect(asked.length).toBeGreaterThan(0);
      const counts = document.getElementById('section-counts');
      expect(counts?.textContent).toContain('77');
      expect(document.getElementById('section-definition')?.textContent).toContain('About');
    });

    test('a non-member loses its canonical link and asks not to be indexed once the kernel says so', async () => {
      const element = path('collection', 'Prime', '18');
      const { env } = fakeEnv((e) =>
        e.startsWith('Element(') ? value(e, 'False', 'False') : declined(e),
      );
      go(element);
      stop = start(win, { loadEnv: async () => env });
      expect(document.head.querySelector('link[rel="canonical"]')).not.toBeNull();
      await vi.waitFor(() =>
        expect(document.head.querySelector('meta[name="robots"]')).not.toBeNull(),
      );
      expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
      expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
        'noindex',
      );
    });

    test('a hidden tab never fires an animation frame, and the kernel still starts and fills the page', async () => {
      const frame = vi.spyOn(win, 'requestAnimationFrame').mockImplementation(() => 0);
      try {
        const { env } = fakeEnv((e) => value(e, 77, '77'));
        const loadEnv = vi.fn(async () => env);
        go(path('collection', 'DyckPath'));
        stop = start(win, { loadEnv });
        expect(frame).toHaveBeenCalled();
        await vi.waitFor(() => expect(app().querySelector('.pending')).toBeNull());
        expect(loadEnv).toHaveBeenCalledTimes(1);
        expect(document.getElementById('section-counts')?.textContent).toContain('77');
      } finally {
        frame.mockRestore();
      }
    });

    test('a member keeps its canonical link', async () => {
      const { env } = fakeEnv((e) =>
        e.startsWith('Element(') ? value(e, 'True', 'True') : declined(e),
      );
      go(path('collection', 'Prime', '17'));
      stop = start(win, { loadEnv: async () => env });
      await vi.waitFor(() => expect(app().querySelector('.pending')).toBeNull());
      expect(document.head.querySelector('link[rel="canonical"]')).not.toBeNull();
      expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
    });

    test('a section that cannot be computed says so, and the other sections still fill', async () => {
      const { env } = fakeEnv((e) => declined(e));
      go(path('collection', 'DyckPath'));
      stop = start(win, { loadEnv: async () => env });
      await vi.waitFor(() => expect(app().querySelector('.pending')).toBeNull());
      expect(document.getElementById('section-counts')?.textContent).toContain('not computed');
    });

    test('the kernel is not loaded for a page that computes nothing', async () => {
      const loadEnv = vi.fn(async () => fakeEnv((e) => declined(e)).env);
      begin(atlas);
      stop();
      stop = start(win, { loadEnv });
      await new Promise((done) => setTimeout(done, 20));
      expect(loadEnv).not.toHaveBeenCalled();
    });

    test('an answer that arrives after the reader navigated away is dropped', async () => {
      let release = () => {};
      const gate = new Promise<void>((done) => {
        release = done;
      });
      const { env, described } = fakeEnv((e) => value(e, 77, '77'), gate);
      go(path('collection', 'DyckPath'));
      stop = start(win, { loadEnv: async () => env });
      document.addEventListener('click', observe);
      await vi.waitFor(() => expect(described.length).toBeGreaterThan(0));
      // The kernel is still working on the first page when the reader leaves it for a page
      // that has sections with the same ids: a late answer would land in them if it were kept.
      click(anchor(path('collection', 'Permutation')));
      expect(headings()).toBe('Permutation');
      release();
      await vi.waitFor(() => expect(app().querySelector('.pending')).toBeNull());
      const definition = document.getElementById('section-definition')?.textContent ?? '';
      expect(definition).toContain('Permutations');
      expect(definition).not.toContain('DyckPaths');
      expect(app().textContent).not.toContain('DyckPaths');
    });

    test('an answer that arrives after the reader left for a page without sections is dropped', async () => {
      let release = () => {};
      const gate = new Promise<void>((done) => {
        release = done;
      });
      const { env, described } = fakeEnv((e) => value(e, 77, '77'), gate);
      go(path('collection', 'DyckPath'));
      stop = start(win, { loadEnv: async () => env });
      document.addEventListener('click', observe);
      await vi.waitFor(() => expect(described.length).toBeGreaterThan(0));
      click(anchor(atlas));
      release();
      await new Promise((done) => setTimeout(done, 50));
      expect(headings()).toBe('Atlas');
      expect(app().querySelector('.computed')).toBeNull();
    });

    test('a rank address moves once to its value address and redraws', async () => {
      const { env, asked } = fakeEnv((e) =>
        e.startsWith('At(')
          ? value(e, dyckJson, 'DyckPath([1, 1, 0, 1, 0, 0, 1, 0])')
          : declined(e),
      );
      const rankAddress = path('collection', dyckSizeFour, rank(7));
      go(rankAddress);
      const replace = vi.spyOn(win.history, 'replaceState');
      const push = vi.spyOn(win.history, 'pushState');
      stop = start(win, { loadEnv: async () => env });
      const target = path('collection', dyckSizeFour, word.join(''));
      await vi.waitFor(() => expect(win.location.pathname).toBe(target));
      await vi.waitFor(() => expect(app().querySelector('.pending')).toBeNull());
      expect(replace).toHaveBeenCalledTimes(1);
      expect(push).not.toHaveBeenCalled();
      expect(headings()).toBe(target);
      // The page that was drawn is the value's: it asked after the element, not only for the rank.
      expect(asked.some((e) => e.startsWith('Element('))).toBe(true);
      expect(document.title).toBe(renderPage(target, '').title);
    });

    test('a rank beyond the collection does not move', async () => {
      const { env } = fakeEnv((e) => declined(e));
      const rankAddress = path('collection', dyckSizeFour, rank(9999));
      go(rankAddress);
      const replace = vi.spyOn(win.history, 'replaceState');
      stop = start(win, { loadEnv: async () => env });
      await vi.waitFor(() => expect(app().querySelector('.pending')).toBeNull());
      expect(replace).not.toHaveBeenCalled();
      expect(win.location.pathname).toBe(rankAddress);
    });
  });

  describe('the parameter picker', () => {
    const param = (name: string, index: number): string =>
      rowByName.get(name)?.parameters?.[index]?.word ?? '';

    function submit(form: HTMLFormElement): void {
      form.dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
    }
    const picker = (name: string): HTMLFormElement =>
      document.querySelector(`form[data-picker="${name}"]`) as HTMLFormElement;
    const fill = (form: HTMLFormElement, word: string, value: string): void => {
      (form.querySelector(`input[name="${word}"]`) as HTMLInputElement).value = value;
    };

    test('a submitted form pushes the address of the collection with the values bound', () => {
      begin(path('collection', 'Permutation'));
      const push = vi.spyOn(win.history, 'pushState');
      const form = picker('Permutation');
      expect(form).not.toBeNull();
      fill(form, param('Permutation', 0), '4');
      submit(form);
      const target = path('collection', seg('Permutation', [param('Permutation', 0), 4]));
      expect(push).toHaveBeenCalledTimes(1);
      expect(win.location.pathname).toBe(target);
      expect(headings()).toBe(`${seg('Permutation', [param('Permutation', 0), 4])}`);
      expect(pickerTarget('Permutation', new Map([[param('Permutation', 0), '4']]))).toBe(target);
    });

    test('two parameters are both bound, in the declared order', () => {
      begin(path('collection', 'SetPartition'));
      const form = picker('SetPartition');
      // Filled in the other order on purpose.
      fill(form, param('SetPartition', 1), '2');
      fill(form, param('SetPartition', 0), '4');
      submit(form);
      expect(win.location.pathname).toBe(
        path(
          'collection',
          seg('SetPartition', [param('SetPartition', 0), 4], [param('SetPartition', 1), 2]),
        ),
      );
    });

    test('a value that is not a point is not bound, and a submit that changes nothing pushes nothing', () => {
      begin(path('collection', 'Permutation'));
      const push = vi.spyOn(win.history, 'pushState');
      const form = picker('Permutation');
      fill(form, param('Permutation', 0), '4)');
      submit(form);
      // Nothing valid was entered: the address is the unbound collection's, which is where it is.
      expect(push).not.toHaveBeenCalled();
      expect(win.location.pathname).toBe(path('collection', 'Permutation'));
      expect(pickerTarget('Permutation', new Map([[param('Permutation', 0), '4)']]))).toBe(
        path('collection', 'Permutation'),
      );
      expect(pickerTarget('Permutation', new Map([[param('Permutation', 0), ' 5 ']]))).toBe(
        path('collection', seg('Permutation', [param('Permutation', 0), 5])),
      );
    });

    test('a form that is not a picker is left alone', () => {
      begin(atlas);
      const form = document.createElement('form');
      app().append(form);
      const event = new win.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    });

    test('a picker for a collection that is none leads nowhere', () => {
      expect(pickerTarget('Nonesuch', new Map())).toBeUndefined();
    });
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

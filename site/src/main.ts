import './style.css';
import { renderPage } from './pages.ts';

const app = document.getElementById('app');
if (!app) throw new Error('no #app element');

function setCanonicalLink(href: string): void {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.rel = 'canonical';
    document.head.append(el);
  }
  el.href = href;
}

/** Reads the location, moves a non-canonical address to its canonical one, and draws the page. */
function show(): void {
  const page = renderPage(location.pathname, location.search);
  if (page.replaceWith !== undefined && page.replaceWith !== location.pathname + location.search) {
    history.replaceState(history.state, '', page.replaceWith + location.hash);
  }
  document.title = page.title;
  setCanonicalLink(page.canonical);
  (app as HTMLElement).innerHTML = page.body.value;
  const target =
    location.hash.length > 1
      ? document.getElementById(decodeURIComponent(location.hash.slice(1)))
      : null;
  if (target) target.scrollIntoView();
  else window.scrollTo(0, 0);
}

document.addEventListener('click', (event) => {
  if (event.defaultPrevented || event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const anchor = (event.target as Element | null)?.closest('a');
  if (!anchor || anchor.target || anchor.hasAttribute('download')) return;
  const url = new URL(anchor.href, location.href);
  if (url.origin !== location.origin) return;
  event.preventDefault();
  history.pushState(null, '', url.pathname + url.search + url.hash);
  show();
});

window.addEventListener('popstate', show);
show();

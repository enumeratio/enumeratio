// Namespaced diagnostics for the elements. Silent unless the page opts in, so a
// production page logs nothing until someone asks it to:
//
//   localStorage["notatio:debug"] = "plot3d"      // one element
//   localStorage["notatio:debug"] = "plot*"       // plot, plot3d, polarplot…
//   localStorage["notatio:debug"] = "*"           // everything
//
// Read once at load — toggling takes a reload — so an enabled namespace costs a
// console call and a disabled one costs nothing at all.

type Log = (message: string, ...detail: unknown[]) => void;

const NOOP: Log = () => {};

const patterns: string[] = (() => {
  try {
    // Storage throws outright when cookies are blocked, and is absent under SSR.
    const raw = globalThis.localStorage?.getItem("notatio:debug") ?? "";
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
})();

const enabled = (name: string): boolean =>
  patterns.some((p) => (p.endsWith("*") ? name.startsWith(p.slice(0, -1)) : p === name));

/** A logger for one element, e.g. `debug("plot3d")`; a no-op unless enabled. */
export const debug = (name: string): Log =>
  enabled(name)
    ? (message, ...detail) => console.debug(`notatio:${name}`, message, ...detail)
    : NOOP;

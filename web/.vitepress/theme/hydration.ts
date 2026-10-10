// Prerendered placeholders mark themselves hydrated once Vue has hydrated them (the verbatim
// ones at build time, as Vue never hydrates those). Custom elements are defined only after that:
// Vue's hydration removes the children an already-upgraded element rendered beside its placeholder,
// and `data-allow-mismatch` only silences the warning.

export const HYDRATED_ATTRIBUTE = "data-hydrated";
export const HYDRATED_EVENT = "notatio:hydrated";
/** The placeholders Vue hasn't hydrated yet. */
export const PENDING_SELECTOR = `span.notatio-prerendered:not([${HYDRATED_ATTRIBUTE}])`;

const pending = (): number => document.querySelectorAll(PENDING_SELECTOR).length;

/** Resolves once no placeholder is left to hydrate, or after `timeout` ms if some never do. */
export function hydrated(timeout = 5000): Promise<void> {
  if (pending() === 0) return Promise.resolve();
  return new Promise((resolve) => {
    const done = (): void => {
      clearTimeout(timer);
      document.removeEventListener(HYDRATED_EVENT, check);
      resolve();
    };
    const check = (): void => {
      if (pending() === 0) done();
    };
    const timer = setTimeout(() => {
      console.warn(
        `${pending()} prerendered placeholder(s) still not hydrated after ${timeout} ms; defining elements anyway`,
      );
      done();
    }, timeout);
    document.addEventListener(HYDRATED_EVENT, check);
  });
}

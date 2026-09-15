// Pointer capture that tolerates a pointer the browser no longer knows about -- one
// that was cancelled, or a synthetic one in a test. Either throws from the DOM call
// and neither is worth a gesture failing over.

export function capture(el: HTMLElement, pointerId: number): void {
  try {
    el.setPointerCapture(pointerId);
  } catch {
    // no such pointer: the gesture still works, it just cannot follow the pointer out
  }
}

export function release(el: HTMLElement, pointerId: number): void {
  try {
    el.releasePointerCapture(pointerId);
  } catch {
    // already released
  }
}

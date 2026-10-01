// Drag to rotate, modifier-scroll to zoom, double-click to reset.
//
// Every 3-D figure wants the same gesture, and until now each one carried its own copy of it.
// The copies had already drifted — one guarded against a non-primary button and one did not,
// one coerced its attributes to numbers and one had been bitten by not doing so. This is that
// gesture, once.
//
// It is not a Lit `ReactiveController`: what makes the figure redraw is assigning to the host's
// own reactive `azimuth` / `elevation` / `zoom`, so there is nothing for a controller lifecycle
// to do, and staying a plain object keeps it testable without a host at all.

/** The camera state an orbit turns. */
export interface OrbitView {
  readonly azimuth: number;
  readonly elevation: number;
  readonly zoom: number;
}

/**
 * What an orbit needs of its host.
 *
 * The properties are typed loosely because they ARRIVE loosely: a custom element's attributes
 * are set as string properties by the host framework, which bypasses Lit's own Number
 * conversion. Left uncoerced, `azimuth + dx` concatenates rather than adds — a small drag once
 * sent a camera from 45 degrees to 230, because `"45" + 50` is `"4550"`.
 */
export interface OrbitHost {
  azimuth: number;
  elevation: number;
  zoom: number;
}

/** Half a degree of turn per pixel of drag: a full revolution is about 720 px. */
const DEGREES_PER_PIXEL = 0.5;

/** How far a pointer may travel and still count as a click rather than a drag. */
const SLOP = 4;

export class Orbit {
  #home: OrbitView | undefined;
  #drag: { id: number; x: number; y: number } | null = null;
  #travel = 0;

  constructor(private readonly host: OrbitHost) {}

  get view(): OrbitView {
    return {
      azimuth: Number(this.host.azimuth) || 0,
      elevation: Number(this.host.elevation) || 0,
      zoom: Number(this.host.zoom) || 1,
    };
  }

  /** Remember where the attributes first put the camera, so a double-click can come back to it.
   *  Call from `firstUpdated`. */
  remember(): void {
    this.#home ??= this.view;
  }

  /** Is a drag in progress right now? A figure with its own hover readout needs to stop
   *  chasing the pointer while the view is being turned. */
  get dragging(): boolean {
    return this.#drag !== null;
  }

  /**
   * Did the pointer travel far enough to have been a drag?
   *
   * A figure that is both draggable and clickable needs this: a click fires at the end of every
   * drag too, and selecting whatever happened to be under the pointer when a rotation finished
   * is not what anyone meant.
   */
  get dragged(): boolean {
    return this.#travel > SLOP;
  }

  readonly onPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    this.#drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    this.#travel = 0;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  readonly onPointerMove = (e: PointerEvent): void => {
    if (!this.#drag || e.pointerId !== this.#drag.id) return;
    const dx = e.clientX - this.#drag.x;
    const dy = e.clientY - this.#drag.y;
    this.#drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    this.#travel += Math.abs(dx) + Math.abs(dy);
    const view = this.view;
    this.host.azimuth = (view.azimuth + dx * DEGREES_PER_PIXEL) % 360;
    this.host.elevation = Math.max(-90, Math.min(90, view.elevation + dy * DEGREES_PER_PIXEL));
  };

  readonly onPointerUp = (e: PointerEvent): void => {
    if (this.#drag?.id === e.pointerId) this.#drag = null;
  };

  /** Plain wheel keeps scrolling the page; a modifier — or a trackpad pinch, which browsers
   *  report as ctrl+wheel — zooms the figure instead. */
  readonly onWheel = (e: WheelEvent): void => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    this.host.zoom = Math.max(0.25, Math.min(4, this.view.zoom * Math.exp(-e.deltaY * 0.005)));
  };

  readonly onDblClick = (): void => {
    if (!this.#home) return;
    this.host.azimuth = this.#home.azimuth;
    this.host.elevation = this.#home.elevation;
    this.host.zoom = this.#home.zoom;
  };
}

/** The one-line explanation of the gesture, for a `title`. */
export const ORBIT_HINT = "drag to rotate · ctrl/⌘+scroll to zoom · double-click to reset";

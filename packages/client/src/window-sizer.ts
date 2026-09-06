// The router-side adaptive enumeration-window sizer (#273 Piece 1 — wiki: Adaptive-Enumeration-Windows). A window is a
// batch of [first, first+count) ranks pulled from one request before the caller reacts (renders a page, runs a
// differential). Queries never exhaust and per-item cost RISES as items get larger, so a fixed window is wrong at both
// ends — painfully expensive early, and a hang on a sparse tail. The size is chosen from two inputs and one floor, per
// the design's law:
//
//     w_next = clamp( floor(B / t̄), 1, w_prior_cap )
//
// B is a per-window time budget (a few hundred ms), t̄ an EWMA of MEASURED per-item wall time, w_prior_cap the ceiling
// implied by DECLARED GROWTH. Declared growth chooses the starting window w_0 and the cap; measured timing does the
// rest — the window monotonically shrinks under sustained slowdown and re-expands when items get cheap. This module is
// pure: it never times anything itself, it reads the WindowPerf the window path already measured (core.ts).
//
// Pieces 2 (per-item progress channel) and 3 (durable continuation) stay parked on #273 pending open decisions.

import type { WindowPerf } from './core'

/** A coarse per-collection cost class for producing ONE element at grade n — the growth-rate knowledge `numbers` baked
 *  into hand-tuned constants, here a small enum. A prior, not a promise: it sets w_0 and the cap, then measured timing
 *  corrects. */
export type GrowthClass = 'constant' | 'poly' | 'exp' | 'superexp'

/** The declared-growth prior: the starting window, the hard cap the timing law may never exceed, and (optional) a
 *  value-ceiling hint for a fast-BALLOONING sequence (the MAX_SAFE_INTEGER / 10^7 role `numbers` encoded by hand —
 *  unused by the time law, carried for a later payload-aware pass). */
export type WindowPrior = { cls: GrowthClass; w0: number; cap: number; ceiling?: number }

/** Per-class (w_0, cap). An `exp` collection never opens a wide window even before any timing arrives; a `constant`
 *  sequence is allowed a large one. Tuned so the FIRST batch of an unknown-cost collection is cheap and every later
 *  batch self-corrects from the measured budget. */
const CLASS: Record<GrowthClass, { w0: number; cap: number }> = {
  constant: { w0: 256, cap: 4096 },
  poly:     { w0: 64,  cap: 1024 },
  exp:      { w0: 8,   cap: 64 },
  superexp: { w0: 1,   cap: 4 },
}

/** Default per-window time budget B: a few hundred ms — small enough to stay responsive and keep the #266 watchdog
 *  quiet, large enough to amortize the per-QUERY overhead #291 found dominates. Overridable per call. */
export const DEFAULT_BUDGET_MS = 250
/** EWMA smoothing: α ≈ 0.3 so a sudden slowdown shrinks the window within a batch or two. */
export const DEFAULT_ALPHA = 0.3

/** Derive the declared-growth prior from ACCELERATOR PRESENCE — the cheap phase-1 growth signal (#273 open decision #1
 *  defers the authored registry column). A cheap random-access `fiber_unrank` ⇒ addressing is at worst poly, so a wide
 *  window is safe; a `fiber_count` without unrank ⇒ we can COUNT (know sparsity) but must SCAN to address, so keep it
 *  narrow; neither ⇒ the floor is a naive enumeration per element, the superexp case that must open at w_0 = 1. */
export function priorFromAccel(accel: { count: boolean; unrank: boolean }): WindowPrior {
  const cls: GrowthClass = accel.unrank ? 'poly' : accel.count ? 'exp' : 'superexp'
  return { cls, ...CLASS[cls] }
}

/** The (w_0, cap) for a growth class — for a caller that has an authored class rather than accelerator booleans. */
export function priorFromClass(cls: GrowthClass, ceiling?: number): WindowPrior {
  return { cls, ...CLASS[cls], ...(ceiling != null ? { ceiling } : {}) }
}

const clamp = (x: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, x))

/** EWMA of PER-ITEM wall time (ms) over the recent WindowPerf ring for one collection, oldest→newest. Null when
 *  nothing has been measured for it yet (⇒ the sizer falls back to the prior's w_0). A zero-row window is skipped: it
 *  measures query overhead, not per-item cost. */
export function ewmaPerItemMs(perf: readonly WindowPerf[], coll: string, alpha = DEFAULT_ALPHA): number | null {
  let t: number | null = null
  for (const p of perf) {
    if (p.coll !== coll || p.rows <= 0) continue
    const per = p.ms / p.rows
    t = t == null ? per : alpha * per + (1 - alpha) * t
  }
  return t
}

/** The adaptation law. `tbar` is the EWMA of per-item ms (null ⇒ no measurement yet ⇒ open at the prior's w_0).
 *  `requested` optionally caps the result to a caller-asked window — the sizer only ever shrinks BELOW what was asked,
 *  never grows past it. The result is always ≥ 1: the down-to-1 floor of THIS policy. A single item that still
 *  overruns the budget is past what window sizing can do — Piece 2's job, parked on #273. */
export function sizeWindow(
  prior: WindowPrior,
  tbar: number | null,
  opts: { budgetMs?: number; requested?: number } = {},
): number {
  const budget = opts.budgetMs ?? DEFAULT_BUDGET_MS
  const cap = Math.max(1, Math.min(prior.cap, opts.requested ?? Infinity))
  const base = tbar == null || !(tbar > 0) ? prior.w0 : Math.floor(budget / tbar)
  return clamp(base, 1, cap)
}

/** A stateful sizer for a streaming walk: seed with a prior, `observe()` each finished window's perf, ask `next()` for
 *  the size of the following pull. The EWMA lives here so a caller just feeds it the WindowPerf the window path already
 *  produced. The sparse/empty-fiber early-exit is the caller's (an empty window ends the walk); this only sizes. */
export class WindowSizer {
  private tbar: number | null = null
  constructor(
    readonly prior: WindowPrior,
    private readonly opts: { budgetMs?: number; alpha?: number } = {},
  ) {}
  /** The current EWMA of per-item ms (null until the first non-empty window is observed) — for diagnostics/tests. */
  get perItemMs(): number | null { return this.tbar }
  /** The size for the next window, optionally capped to a caller-requested count. */
  next(requested?: number): number {
    return sizeWindow(this.prior, this.tbar, { budgetMs: this.opts.budgetMs, requested })
  }
  /** Fold one finished window's measured cost into the EWMA (empty windows measure overhead, not per-item cost). */
  observe(perf: WindowPerf): void {
    if (perf.rows <= 0) return
    const per = perf.ms / perf.rows
    const a = this.opts.alpha ?? DEFAULT_ALPHA
    this.tbar = this.tbar == null ? per : a * per + (1 - a) * this.tbar
  }
}

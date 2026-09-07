import type { AdapterFactory, MathInputAdapter } from './math-input-adapter'

// MathLive-backed AdapterFactory. Imported dynamically (never statically) so the docs SSR build — which runs this
// module's static imports under Node, with no `window` — never touches MathLive at all; the import only happens
// once a factory call actually runs in the browser.
//
// MathLive API facts pinned against mathlive@0.110.0 (packages/components/node_modules/mathlive/types/*.d.ts):
//   - `mf.getValue(start, end, 'latex')` — start/end are MathLive "offsets" (0..mf.lastOffset), NOT LaTeX string
//     indices. A run of N LaTeX characters is not necessarily N offsets (e.g. `\frac{}{}` is many chars, few
//     offsets), so converting a completer's `replaceLen` (LaTeX chars) to an offset range means walking backward
//     from the caret until the rendered LaTeX for that offset range is at least that long (offsetForLength below).
//   - `mf.selection = { ranges: [[start, end]] }` then `mf.insert(latex, { selectionMode: 'after' })` is how you
//     replace a range: set the selection, then insert (insertionMode defaults to 'replaceSelection').
//   - `mf.getElementInfo(offset)?.bounds` (a DOMRect) is the caret/atom rect — no separate "caret rect" API.
//   - Events are plain DOM events on the `<math-field>` element itself: `input`, `change`, `focus`, `blur` (native),
//     plus MathLive's own `move-out` (CustomEvent<{direction: 'forward'|'backward'|'upward'|'downward'}>,
//     cancellable — we don't preventDefault it, we just relay). There is no separate "enter" event; Enter is
//     detected via a `keydown` listener on an ANCESTOR of the field in the CAPTURE phase (see below).
//   - `MathfieldElement.fontsDirectory` / `.soundsDirectory` are STATIC (class-level, apply to every instance) —
//     set once per page, not per adapter instance.

let configured = false

/** Set MathLive's static font-loading config once for the whole page. Safe to call more than once — a no-op after the first call. */
export function configureMathlive(opts: { fontsDirectory?: string } = {}): void {
  if (configured) return
  configured = true
  void import('mathlive').then(({ MathfieldElement }) => {
    MathfieldElement.fontsDirectory = opts.fontsDirectory ?? '/mathlive-fonts'
    MathfieldElement.soundsDirectory = null // no keyboard-click sound effects
  })
}

/** Walk back from the caret to find the smallest offset range whose rendered LaTeX is at least `count` chars long. */
function offsetForLength(mf: { position: number; getValue: (a: number, b: number, f: 'latex') => string }, count: number): number {
  const end = mf.position
  let start = end
  while (start > 0 && mf.getValue(start, end, 'latex').length < count) start--
  return start
}

export const mathliveAdapter: AdapterFactory = async (container, opts) => {
  if (typeof window === 'undefined') throw new Error('mathliveAdapter requires a browser environment')

  const { MathfieldElement } = await import('mathlive')
  configureMathlive() // idempotent; first caller wins on fontsDirectory

  const mf = new MathfieldElement()
  // MathLive's instance getters/setters (inlineShortcuts included) throw "Mathfield not mounted" until the element
  // is actually connected to the document — append FIRST, configure after.
  container.appendChild(mf)
  mf.mathVirtualKeyboardPolicy = 'manual' // this component has no on-screen keyboard affordance (yet)
  if (opts.placeholder) mf.placeholder = opts.placeholder
  if (opts.readonly) mf.readOnly = true
  // Extend (not replace) MathLive's built-in inline shortcuts with a few catalog-flavored ones.
  mf.inlineShortcuts = {
    ...mf.inlineShortcuts,
    in: '\\in',
    NN: '\\mathbb{N}',
    ZZ: '\\mathbb{Z}',
    QQ: '\\mathbb{Q}',
    le: '\\le',
    ge: '\\ge',
    ne: '\\ne',
  }

  type Ev = 'input' | 'enter' | 'move-out' | 'blur' | 'focus'
  const enterHandlers = new Set<(detail?: { direction?: 'up' | 'down' }) => void>()

  // Enter has no dedicated MathLive event — detect it via a capture-phase keydown listener on `container` (an
  // ANCESTOR of `mf`). Capture-phase listeners on an ancestor run before the event ever reaches `mf`'s own
  // (target-phase) listeners, so this reliably observes Enter before MathLive's internal handling of it.
  const onKeydownCapture = (ev: KeyboardEvent) => {
    if (ev.key !== 'Enter') return
    for (const fn of enterHandlers) fn()
  }
  container.addEventListener('keydown', onKeydownCapture, true)

  const cleanups: Array<() => void> = [() => container.removeEventListener('keydown', onKeydownCapture, true)]

  const adapter: MathInputAdapter = {
    host: mf,
    getLatex: () => mf.getValue('latex'),
    setLatex: (latex: string) => {
      mf.setValue(latex)
    },
    latexBeforeCaret: () => mf.getValue(0, mf.position, 'latex'),
    caretRect: () => mf.getElementInfo(mf.position)?.bounds ?? null,
    replaceBeforeCaret: (count: number, latex: string) => {
      const end = mf.position
      const start = count > 0 ? offsetForLength(mf, count) : end
      mf.selection = { ranges: [[start, end]] }
      mf.insert(latex, { selectionMode: 'after' })
    },
    focus: () => mf.focus(),
    blur: () => mf.blur(),
    on: (ev: Ev, fn: (detail?: { direction?: 'up' | 'down' }) => void) => {
      if (ev === 'enter') {
        enterHandlers.add(fn)
        return () => enterHandlers.delete(fn)
      }
      if (ev === 'move-out') {
        const handler = (e: Event) => {
          const direction = (e as CustomEvent<{ direction: 'forward' | 'backward' | 'upward' | 'downward' }>).detail?.direction
          const mapped = direction === 'upward' ? 'up' : direction === 'downward' ? 'down' : undefined
          fn(mapped ? { direction: mapped } : undefined)
        }
        mf.addEventListener('move-out', handler)
        return () => mf.removeEventListener('move-out', handler)
      }
      // 'input' | 'blur' | 'focus' — plain native events, no detail to translate.
      const handler = () => fn()
      mf.addEventListener(ev, handler)
      return () => mf.removeEventListener(ev, handler)
    },
    destroy: () => {
      for (const c of cleanups) c()
      mf.remove()
    },
  }
  return adapter
}

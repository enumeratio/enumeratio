// The seam between <enumeratio-math-input> and whatever LaTeX-editing widget actually renders the box. MathLive
// (./mathlive-adapter.ts) is the only implementation today, but the host component only ever talks to this
// interface — swapping engines (or mocking one in a test) means writing a new AdapterFactory, not touching the
// Lit element.
export interface MathInputAdapter {
  /** The element the adapter mounted into `container` (e.g. a `<math-field>`). Host CSS can reach into it via `::part` or by styling `.host` in the shadow root. */
  readonly host: HTMLElement
  getLatex(): string
  setLatex(latex: string): void
  /** The LaTeX from the start of the field up to the caret — what a completer matches against. */
  latexBeforeCaret(): string
  /** Viewport rect of the caret, for anchoring a popover. Null if the field isn't mounted/focused yet. */
  caretRect(): DOMRect | null
  /** Replace the `count` characters of LaTeX immediately before the caret with `latex`, leaving the caret after it. */
  replaceBeforeCaret(count: number, latex: string): void
  focus(): void
  blur(): void
  /** Subscribe to an adapter event; returns an unsubscribe function. */
  on(ev: 'input' | 'enter' | 'move-out' | 'blur' | 'focus', fn: (detail?: { direction?: 'up' | 'down' }) => void): () => void
  /** Tear down the mounted widget and all its listeners. */
  destroy(): void
}

export type AdapterFactory = (
  container: HTMLElement,
  opts: { placeholder?: string; readonly?: boolean },
) => Promise<MathInputAdapter>

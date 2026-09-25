import {
  cliDemosByCategory,
  demosByCategory,
  dim,
  type Driver,
  type Graphic,
  keysOf,
  present,
  type Presented,
  red,
  resumeHint,
  Repl,
  runCommand,
  splitArgs,
} from "@enumeratio/cli/browser";
import { html, LitElement, type PropertyValues } from "lit";
import { createRef, ref } from "lit/directives/ref.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import type { Terminal } from "@xterm/xterm";
import { environmentNamed, linePlotSvg, renderGlyph, TTY } from "@enumeratio/notatio";

// A real terminal emulator (xterm) running the actual @enumeratio/cli logic in
// the browser. Three modes: `repl` drives the interactive core (In[n]/Out[n], :plot
// draws below), `cli` runs one `notatio` command per line at a `$ notatio` prompt,
// and `show` prints one expression as a terminal in `env` would, driving its
// controls from the keyboard where that environment can.
// A grouped example dropdown, a Play button that replays the corpus, and a Clear
// button. xterm and its CSS load lazily.

const CTRL = {
  ENTER: "\r",
  BACKSPACE: "\x7f",
  DELETE: "\x1b[3~",
  UP: "\x1b[A",
  DOWN: "\x1b[B",
  RIGHT: "\x1b[C",
  LEFT: "\x1b[D",
  HOME: "\x01",
  END: "\x05",
  KILL: "\x15",
  INT: "\x03",
  CLEAR: "\x0c",
} as const;

const HIDE_CURSOR = "\x1b[?25l";
const SHOW_CURSOR = "\x1b[?25h";

const THEME = {
  background: "#181818",
  foreground: "#e4e4e4",
  cursor: "#d97706",
  brightBlack: "#6b7280",
};

interface Group {
  category: string;
  demos: { id: string; title: string; lines: string[] }[];
}

/** The behaviour that differs between the REPL and command-line modes. */
interface Engine {
  banner(): string;
  prompt(): string;
  run(input: string): { text: string; graphic?: Graphic; clear?: boolean; exit?: boolean };
  groups(): Group[];
}

function replEngine(color: boolean): Engine {
  const repl = new Repl({ color });
  return {
    banner: () => repl.banner(),
    prompt: () => repl.prompt(),
    run: (input) => repl.eval(input),
    groups: () => demosByCategory(),
  };
}

function cliEngine(color: boolean): Engine {
  const trim = (s: string) => s.replace(/\n+$/, "");
  return {
    banner: () => dim("notatio — command line. Type the args after the prompt (the $ notatio is implied).", color),
    prompt: () => `${dim("$", color)} notatio `,
    run: (input) => {
      const argv = splitArgs(input);
      if (argv.length === 0) return { text: "" };
      const r = runCommand(argv);
      return { text: r.code === 0 ? trim(r.stdout) : red(trim(r.stderr), color) };
    },
    groups: () => cliDemosByCategory(),
  };
}

function graphicSvg(g: Graphic): string {
  return g.kind === "plot" ? linePlotSvg(g.points) : renderGlyph(g.glyph, g.values);
}

let stylesInjected = false;
function ensureTerminalStyles(): void {
  if (stylesInjected || typeof document === "undefined") return;
  stylesInjected = true;
  const style = document.createElement("style");
  style.textContent = TERMINAL_CSS;
  document.head.appendChild(style);
}

/**
 * `<notatio-terminal>` — an in-browser terminal. `mode` is `repl` (default), `cli`
 * or `show`. `seed` is a JSON array of lines to run on mount; `examples` (default on)
 * shows the dropdown + Play/Clear toolbar. In `show` mode, `value` is the expression
 * and `env` the environment it is shown for (`tty` by default).
 */
export class NotatioTerminal extends LitElement {
  static properties = {
    /** `repl` for the interactive session, `cli` for the command-line transcript, `show` for one expression. */
    mode: { type: String, reflect: true },
    /** In `show` mode, the expression, in notatio. */
    value: { type: String },
    /** In `show` mode, the environment it is shown for: `tty` or `pipe`. */
    env: { type: String },
    /** A JSON array of input lines to run on load. */
    seed: { type: String },
    /** Show the example picker beside the terminal. */
    examples: { type: Boolean },
    _figure: { state: true },
    _playing: { state: true },
  };

  declare mode: "repl" | "cli" | "show";
  declare value: string;
  declare env: string;
  declare seed: string;
  declare examples: boolean;
  declare private _figure: string;
  declare private _playing: boolean;

  private readonly screen = createRef<HTMLDivElement>();
  private term?: Terminal;
  private engine!: Engine;
  private input = "";
  private cursor = 0;
  private readonly hist: string[] = [];
  private histIdx = 0;
  private exited = false;
  // One height for every shown result, so switching environments does not move the page;
  // a driven frame (strip, hint, an 8-row plot) fits it, and a settled Out scrolls.
  private static readonly SHOW_ROWS = 18;
  private static readonly SHOW_PLOT_ROWS = 8;
  private shown?: Presented;
  private driving?: Driver;

  constructor() {
    super();
    this.mode = "repl";
    this.value = "";
    this.env = "tty";
    this.seed = "";
    this.examples = true;
    this._figure = "";
    this._playing = false;
    ensureTerminalStyles();
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  protected override render() {
    return html`
      ${
        this.examples && this.mode !== "show"
          ? html`<div class="notatio-term__bar">
              <label class="notatio-term__hint" for="notatio-term-ex-${this.mode}">Examples</label>
              <select
                id="notatio-term-ex-${this.mode}"
                class="notatio-term__select"
                @change=${(e: Event) => this.onPick(e)}
              >
                <option value="">Load an example…</option>
                ${this.groups().map(
                  (g) => html`<optgroup label=${g.category}>
                    ${g.demos.map((d) => html`<option value=${d.id}>${d.title}</option>`)}
                  </optgroup>`,
                )}
              </select>
              <button class="notatio-term__btn" @click=${() => this.togglePlay()}>
                ${this._playing ? "■ Stop" : "▶ Play"}
              </button>
              <button class="notatio-term__btn" @click=${() => this.clearScreen()}>Clear</button>
            </div>`
          : null
      }
      <div class="notatio-term__screen" ${ref(this.screen)}></div>
      <figure class="notatio-term__figure" ?hidden=${!this._figure}>
        <figcaption class="notatio-term__figcap">figure</figcaption>
        ${this._figure ? unsafeHTML(this._figure) : null}
      </figure>
    `;
  }

  protected override async firstUpdated(_: PropertyValues): Promise<void> {
    const host = this.screen.value;
    if (!host) return;
    const color = true;
    if (this.mode !== "show") this.engine = this.mode === "cli" ? cliEngine(color) : replEngine(color);

    const [{ Terminal }, { FitAddon }] = await Promise.all([
      import("@xterm/xterm"),
      import("@xterm/addon-fit"),
      import("@xterm/xterm/css/xterm.css"),
    ]);
    const term = new Terminal({
      convertEol: true,
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
      theme: THEME,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);
    // A shown expression sizes the screen to what it printed; only the width follows the box.
    const show = this.mode === "show";
    const refit = (): void => {
      if (!show) return fit.fit();
      const cols = fit.proposeDimensions()?.cols;
      if (cols !== undefined && cols !== term.cols) term.resize(cols, term.rows);
    };
    refit();
    new ResizeObserver(refit).observe(host);
    term.onData((d) => this.onData(d));
    this.term = term;

    if (this.mode === "show") return this.show();
    term.writeln(this.engine.banner());
    term.write("\r\n");
    this.newPrompt();
    if (this.seed) {
      try {
        this.runLines(JSON.parse(this.seed));
      } catch {
        // ignore a malformed seed
      }
    }
  }

  protected override updated(changed: PropertyValues): void {
    if (this.mode === "show" && this.term && (changed.has("value") || changed.has("env"))) this.show();
  }

  // --- Show --------------------------------------------------------------

  /** Print `value` as a terminal in `env` would, from a clean screen. */
  private show(): void {
    const term = this.term;
    if (!term) return;
    this.driving?.stop();
    this.driving = undefined;
    term.reset();
    term.resize(term.cols, NotatioTerminal.SHOW_ROWS);
    // `convertEol` makes each `\n` a line break, as a TTY's own line discipline does.
    const write = (text: string): void => term.write(text);
    this.shown = present(
      this.value,
      environmentNamed(this.env) ?? TTY,
      {
        write,
        mouse: true,
        cursorRow: () => term.buffer.active.cursorY + 1,
        columns: () => term.cols,
      },
      NotatioTerminal.SHOW_PLOT_ROWS,
    );
    write(`${this.shown.echo}\n`);
    this.driving = this.shown.driver;
    // A cursor only where there is something to key: a pipe is output, not a prompt.
    write(this.driving ? SHOW_CURSOR : HIDE_CURSOR);
    if (this.driving) this.driving.draw();
    else write(this.shown.out);
  }

  private onShowData(data: string): void {
    const d = this.driving;
    if (d === undefined) {
      // Done driving: Enter starts over, the way re-running the line would.
      if (data === CTRL.ENTER && this.shown?.driver) this.show();
      return;
    }
    d.data(data);
    for (const key of keysOf(data)) {
      if (!d.key(key)) continue;
      d.stop();
      this.driving = undefined;
      const out = this.shown!.settle(d.pinned());
      this.term?.write(`${HIDE_CURSOR}${out}\n\n${resumeHint(true)}`);
      return;
    }
  }

  private groups(): Group[] {
    // Groups come from the engine, but render() runs before firstUpdated builds it.
    return (this.mode === "cli" ? cliDemosByCategory() : demosByCategory()) as Group[];
  }

  private newPrompt(): void {
    this.input = "";
    this.cursor = 0;
    this.histIdx = this.hist.length;
    this.term?.write(this.engine.prompt());
  }

  private refresh(): void {
    if (!this.term) return;
    this.term.write(`\x1b[2K\r${this.engine.prompt()}${this.input}`);
    const tail = this.input.length - this.cursor;
    if (tail > 0) this.term.write(`\x1b[${tail}D`);
  }

  private setInput(line: string): void {
    this.input = line;
    this.cursor = line.length;
    this.refresh();
  }

  private submit(): void {
    const term = this.term;
    if (!term || this.exited) return;
    term.write("\r\n");
    const line = this.input;
    if (line.trim()) this.hist.push(line);
    const out = this.engine.run(line);
    if (out.clear) term.clear();
    if (out.text) term.write(`${out.text.replace(/\n/g, "\r\n")}\r\n`);
    if (out.graphic) this._figure = graphicSvg(out.graphic);
    else if (out.text) this._figure = "";
    if (out.text) term.write("\r\n");
    if (out.exit) {
      this.exited = true;
      return;
    }
    this.newPrompt();
  }

  private runLines(lines: readonly string[]): void {
    for (const line of lines) {
      this.setInput(line);
      this.submit();
    }
  }

  private onPick(e: Event): void {
    const select = e.target as HTMLSelectElement;
    const id = select.value;
    select.value = "";
    const demo = this.groups()
      .flatMap((g) => g.demos)
      .find((d) => d.id === id);
    if (demo) {
      this.stopPlay();
      this.runLines(demo.lines);
    }
  }

  private clearScreen(): void {
    this._figure = "";
    this.term?.clear();
    this.input = "";
    this.cursor = 0;
    this.refresh();
  }

  // --- Autoplay ----------------------------------------------------------

  private playGen = 0;

  private togglePlay(): void {
    if (this._playing) this.stopPlay();
    else void this.play();
  }

  private stopPlay(): void {
    this.playGen++; // invalidate any running loop, even one mid-sleep
    this._playing = false;
  }

  private async play(): Promise<void> {
    if (!this.term) return;
    const gen = ++this.playGen; // only the newest loop stays alive
    this._playing = true;
    const alive = () => this.playGen === gen;
    const demos = this.groups().flatMap((g) => g.demos);
    while (alive()) {
      for (const demo of demos) {
        if (!alive()) return;
        this.clearScreen(); // keep the terminal from growing across the corpus
        await this.sleep(450);
        for (const line of demo.lines) {
          if (!alive()) return;
          await this.typeOut(line, alive);
          await this.sleep(250);
          if (!alive()) return;
          this.submit();
          await this.sleep(850);
        }
        await this.sleep(1100);
      }
    }
  }

  private async typeOut(line: string, alive: () => boolean): Promise<void> {
    for (const ch of line) {
      if (!alive()) return;
      this.input += ch;
      this.cursor = this.input.length;
      this.refresh();
      await this.sleep(26);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // --- Input -------------------------------------------------------------

  private onData(data: string): void {
    if (this.mode === "show") return this.onShowData(data);
    if (this.exited) return;
    if (this._playing) this.stopPlay(); // any keystroke stops autoplay
    switch (data) {
      case CTRL.ENTER:
        return this.submit();
      case CTRL.BACKSPACE:
        if (this.cursor > 0) {
          this.input = this.input.slice(0, this.cursor - 1) + this.input.slice(this.cursor);
          this.cursor--;
          this.refresh();
        }
        return;
      case CTRL.DELETE:
        if (this.cursor < this.input.length) {
          this.input = this.input.slice(0, this.cursor) + this.input.slice(this.cursor + 1);
          this.refresh();
        }
        return;
      case CTRL.LEFT:
        if (this.cursor > 0) {
          this.cursor--;
          this.refresh();
        }
        return;
      case CTRL.RIGHT:
        if (this.cursor < this.input.length) {
          this.cursor++;
          this.refresh();
        }
        return;
      case CTRL.HOME:
        this.cursor = 0;
        return this.refresh();
      case CTRL.END:
        this.cursor = this.input.length;
        return this.refresh();
      case CTRL.KILL:
        this.input = "";
        this.cursor = 0;
        return this.refresh();
      case CTRL.UP:
        if (this.histIdx > 0) {
          this.histIdx--;
          this.setInput(this.hist[this.histIdx]);
        }
        return;
      case CTRL.DOWN:
        if (this.histIdx < this.hist.length - 1) {
          this.histIdx++;
          this.setInput(this.hist[this.histIdx]);
        } else {
          this.histIdx = this.hist.length;
          this.setInput("");
        }
        return;
      case CTRL.INT:
        this.term?.write("^C\r\n");
        return this.newPrompt();
      case CTRL.CLEAR:
        return this.clearScreen();
      default:
        this.insert(data);
    }
  }

  private insert(data: string): void {
    for (const ch of data) {
      const code = ch.codePointAt(0) ?? 0;
      if (ch === "\r" || ch === "\n") {
        this.submit();
      } else if (code >= 32) {
        this.input = this.input.slice(0, this.cursor) + ch + this.input.slice(this.cursor);
        this.cursor += ch.length;
      }
    }
    this.refresh();
  }
}

const TERMINAL_CSS = `
notatio-terminal {
  display: block;
  margin: 1rem 0;
}
.notatio-term__bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.6rem;
  flex-wrap: wrap;
}
.notatio-term__hint {
  font-size: 0.8rem;
  opacity: 0.65;
}
.notatio-term__select,
.notatio-term__btn {
  font: inherit;
  font-size: 0.85rem;
  padding: 0.25rem 0.6rem;
  border-radius: 6px;
  border: 1px solid var(--vp-c-divider, #d0d0d0);
  background: var(--vp-c-bg-soft, #f6f6f6);
  color: inherit;
  cursor: pointer;
}
.notatio-term__select {
  max-width: 18rem;
}
.notatio-term__btn:hover {
  border-color: var(--notatio-accent, #d97706);
  color: var(--notatio-accent, #d97706);
}
.notatio-term__screen {
  height: 24rem;
  border-radius: 8px;
  overflow: hidden;
  background: ${THEME.background};
  padding: 0.5rem 0.5rem 0.25rem;
}
notatio-terminal[mode="show"] {
  margin: 0;
}
notatio-terminal[mode="show"] .notatio-term__screen {
  height: auto;
}
.notatio-term__screen .xterm-viewport {
  overflow-y: auto;
}
.notatio-term__figure {
  margin: 0.75rem 0 0;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  border: 1px solid var(--vp-c-divider, #d0d0d0);
  border-radius: 8px;
  --notatio-fg: currentColor;
}
/* the display:flex above would otherwise beat the [hidden] UA rule */
.notatio-term__figure[hidden] {
  display: none;
}
.notatio-term__figcap {
  align-self: flex-start;
  font-size: 0.72rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  opacity: 0.55;
}
.notatio-term__figure svg {
  max-width: 100%;
  max-height: 12rem;
  height: auto;
}
`;

if (typeof customElements !== "undefined" && !customElements.get("notatio-terminal")) {
  customElements.define("notatio-terminal", NotatioTerminal);
}

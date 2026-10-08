// <table-view-box>: the web's `TableViewBox` (https://github.com/enumeratio/enumeratio/wiki/Speculative-Lazy-Grid, §3). A
// fixed-height viewport (`contain: strict`, so the page around it never reflows) over a row
// source it registers with the page's kernel. It draws only the rows in view plus an overscan,
// caches them in aligned blocks, drops blocks far from the view (never the one holding focus),
// and batches what a frame is missing into one request that the next scroll can abort.
//
// The first row in view is state (a bigint); the scroll position is derived from it. A count that
// is a lower bound or infinite gets a runway past what has been seen, and a scroll area taller
// than a browser allows is scaled: wheel and arrows then move by row.

import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import {
  type Box,
  type ColumnSpec,
  describeBig,
  describeCount,
  type IndexRange,
  type RowBatch,
  type RowCount,
} from "@enumeratio/boxes";
import { toText } from "@enumeratio/boxes/render";
import {
  BLOCK_ROWS,
  blockOf,
  blockRange,
  blocksIn,
  clampIndex,
  debug,
  endOf,
  extentRows,
  farOff,
  parseIndex,
  rangesOf,
  scrollAreaPx,
  scrollTopFor,
  statusText,
  topAt,
  visibleRows,
  windowOf,
} from "@enumeratio/frontend/core";
import { openRowsClient, type RowsClient } from "./rows-client.ts";

const log = debug("table-view");

/** A column window is only asked for when there are more columns than this. */
const WIDE = 24;
/** Rows per second above which a scroll is a fling: placeholders show index only until it settles. */
const FLING = 40;
const FLING_SETTLE_MS = 120;
const LIVE_MS = 400;
const DEFAULT_PAGE = 20;
/** The index track's bounds, and the least the element column shrinks to. */
const INDEX_MIN_EM = 3.5;
const INDEX_MAX_EM = 9;
const ELEMENT_MIN_EM = 6;

interface Block {
  /** The rows of the block asked for, over the display columns `cols`; short at the source's end. */
  rows: readonly (readonly Box[])[];
  cols: readonly [number, number];
  status: "loading" | "ready";
}

/** What a table tells the chrome around it (`table-status`, bubbling). */
export interface TableStatus {
  readonly count: RowCount;
  readonly error?: string;
  readonly warning?: string;
  readonly stalled?: { readonly scanned: bigint };
}

const text = (tag: string, className: string, content = ""): HTMLElement => {
  const el = document.createElement(tag);
  el.className = className;
  if (content !== "") el.textContent = content;
  return el;
};

function drawCell(el: HTMLElement, box: Box | undefined, numeric: boolean): void {
  el.classList.toggle("tvb-num", numeric);
  if (box === undefined || box === "") {
    el.textContent = "";
  } else if (typeof box === "string") {
    el.textContent = box;
  } else if (box[0] === "TagBox" && box[2] === "Glyph" && typeof box[1] === "string") {
    // A glyph is an SVG the kernel drew; nothing a reader typed reaches it.
    el.innerHTML = box[1];
  } else {
    el.textContent = toText(box);
  }
}

export class TableViewBox extends HTMLElement {
  static observedAttributes = [
    "source",
    "headers",
    "pagination",
    "max-items",
    "scroll-position",
    "sortable",
    "sort-column",
    "sort-descending",
  ];

  #client: RowsClient | undefined;
  #columns: readonly ColumnSpec[] = [];
  #count: RowCount = { kind: "atLeast", n: 0n, growing: true };
  #random = false;
  #rowEm = 1.9;
  #rowPx = 30;
  #fontPx = 14;
  #top = 1n;
  #sub = 0;
  #furthest = 0n;
  #blocks = new Map<bigint, Block>();
  #rowEls = new Map<bigint, HTMLElement>();
  #active: { index: bigint; col: number } = { index: 1n, col: 0 };
  #inflight: { controller: AbortController; blocks: Set<bigint> } | undefined;
  #generation = 0;
  #registered = false;
  #error = "";
  #warning = "";
  #stalled: { scanned: bigint } | undefined;

  #viewport!: HTMLElement;
  #space!: HTMLElement;
  #layer!: HTMLElement;
  #head!: HTMLElement;
  #rowsEl!: HTMLElement;
  #parked!: HTMLElement;
  #status!: HTMLElement;
  #note!: HTMLElement;
  #jump!: HTMLInputElement;
  #pager!: HTMLElement;
  #live!: HTMLElement;
  #built = false;
  #frame = 0;
  #fetchTimer: ReturnType<typeof setTimeout> | undefined;
  #liveTimer: ReturnType<typeof setTimeout> | undefined;
  #lastMove = { top: 1n, at: 0 };
  #flinging = false;
  /** Where our own `scrollTop` write put it, so that write's scroll event is not read as the reader's. */
  #expected: number | undefined;
  #headers: readonly string[] = [];
  #resizeObserver: ResizeObserver | undefined;

  connectedCallback(): void {
    this.#build();
    this.#top = this.#initialTop();
    this.#active = { index: this.#top, col: 0 };
    if (typeof ResizeObserver !== "undefined") {
      this.#resizeObserver = new ResizeObserver(() => this.#schedule());
      this.#resizeObserver.observe(this);
    }
    this.#reset();
  }

  disconnectedCallback(): void {
    this.#resizeObserver?.disconnect();
    this.#inflight?.controller.abort();
    this.#client?.release();
    this.#client = undefined;
    this.#registered = false;
    cancelAnimationFrame(this.#frame);
    clearTimeout(this.#fetchTimer);
    clearTimeout(this.#liveTimer);
  }

  attributeChangedCallback(name: string, before: string | null, after: string | null): void {
    if (!this.#built || before === after) return;
    if (name === "source") this.#reset();
    else if (name === "headers" || name === "sortable" || name === "sort-column" || name === "sort-descending") {
      this.#drawHeader();
    } else this.#schedule();
  }

  /** The column the view is sorted by (`sort-column`): its header shows the arrow and `aria-sort`. */
  get #sort(): { column: number; descending: boolean } | undefined {
    const column = this.getAttribute("sort-column");
    return column === null || column === ""
      ? undefined
      : { column: Number(column), descending: this.hasAttribute("sort-descending") };
  }

  get #paged(): boolean {
    return this.hasAttribute("pagination");
  }

  get #pageSize(): number {
    return Math.max(1, Number(this.getAttribute("max-items")) || DEFAULT_PAGE);
  }

  #initialTop(): bigint {
    const top = parseIndex(this.getAttribute("scroll-position") ?? "") ?? 1n;
    return this.#paged ? ((top - 1n) / BigInt(this.#pageSize)) * BigInt(this.#pageSize) + 1n : top;
  }

  // ---- structure -------------------------------------------------------------------------

  #build(): void {
    if (this.#built) return;
    this.#built = true;
    ensureTableViewStyles();
    this.setAttribute("role", "grid");
    this.#viewport = text("div", "tvb-viewport");
    this.#viewport.setAttribute("role", "presentation");
    this.#space = text("div", "tvb-space");
    this.#layer = text("div", "tvb-layer");
    this.#head = text("div", "tvb-row tvb-header");
    this.#head.setAttribute("role", "row");
    this.#rowsEl = text("div", "tvb-rows");
    this.#rowsEl.setAttribute("role", "rowgroup");
    this.#parked = text("div", "tvb-parked");
    this.#parked.setAttribute("role", "rowgroup");
    this.#layer.append(this.#head, this.#rowsEl, this.#parked);
    this.#space.append(this.#layer);
    this.#viewport.append(this.#space);
    const foot = text("div", "tvb-foot");
    this.#status = text("span", "tvb-status");
    this.#note = text("span", "tvb-note");
    const label = text("label", "tvb-jump");
    label.append("row ");
    this.#jump = document.createElement("input");
    this.#jump.className = "tvb-input";
    this.#jump.inputMode = "numeric";
    this.#jump.spellcheck = false;
    this.#jump.placeholder = "jump to";
    this.#jump.setAttribute("aria-label", "jump to row");
    label.append(this.#jump);
    this.#pager = text("span", "tvb-pager");
    foot.append(this.#status, this.#note, label, this.#pager);
    this.#live = text("div", "tvb-live");
    this.#live.setAttribute("role", "status");
    this.#live.setAttribute("aria-live", "polite");
    this.replaceChildren(this.#viewport, foot, this.#live);

    this.#viewport.addEventListener("scroll", () => this.#onScroll(), { passive: true });
    this.#viewport.addEventListener("wheel", (e) => this.#onWheel(e), { passive: false });
    this.addEventListener("keydown", (e) => this.#onKey(e));
    this.addEventListener("focusin", (e) => this.#onFocus(e));
    this.#jump.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key !== "Enter") return;
      const index = parseIndex(this.#jump.value);
      if (index === undefined) {
        this.#jump.setAttribute("aria-invalid", "true");
        return;
      }
      this.#jump.removeAttribute("aria-invalid");
      this.goTo(index);
    });
  }

  #drawHeader(): void {
    const labels = this.#columns.length > 0 ? this.#columns.map((c) => c.label) : this.#headersAttribute();
    this.#headers = labels;
    this.#head.replaceChildren(this.#headCell("#", -1));
    labels.forEach((label, i) => this.#head.append(this.#headCell(label, i)));
    this.#setTracks();
  }

  #headersAttribute(): string[] {
    try {
      const parsed: unknown = JSON.parse(this.getAttribute("headers") ?? "[]");
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }

  #headCell(label: string, column: number): HTMLElement {
    const cell = text("div", column < 0 ? "tvb-cell tvb-idx" : "tvb-cell", label);
    cell.setAttribute("role", "columnheader");
    cell.setAttribute("aria-colindex", String(column + 2));
    if (column < 0) return cell;
    cell.style.gridColumn = String(column + 2);
    if (this.#columns[column]?.numeric) cell.classList.add("tvb-num");
    if (this.hasAttribute("sortable") && label !== "") {
      cell.tabIndex = -1;
      cell.classList.add("tvb-sortable");
      const sort = this.#sort;
      const sorted = sort?.column === column;
      cell.setAttribute("aria-sort", sorted ? (sort.descending ? "descending" : "ascending") : "none");
      if (sorted) cell.textContent = `${label} ${sort.descending ? "↓" : "↑"}`;
      cell.title = `sort by ${label}`;
      cell.addEventListener("click", () =>
        this.dispatchEvent(new CustomEvent("table-sort", { bubbles: true, detail: { column } })),
      );
    }
    return cell;
  }

  /** The grid tracks every row shares, so a row's cells line up with the header's. */
  #setTracks(): void {
    const widths = this.#columns.length > 0 ? this.#columns.map((c) => c.width ?? 8) : this.#headers.map(() => 8);
    // The element column takes what room is left; the statistics are as wide as they were measured to be.
    const labels = this.#columns.length > 0 ? this.#columns.map((c) => c.label) : this.#headers;
    const flexible = Math.max(0, labels.indexOf("element"));
    const tracks = [
      `var(--tvb-idx, ${INDEX_MIN_EM}em)`,
      ...widths.map((w, i) => (i === flexible ? `minmax(${ELEMENT_MIN_EM}em, 1fr)` : `${w}em`)),
    ];
    this.style.setProperty("--tvb-tracks", tracks.join(" "));
    // The element column gives way first: the area is only as wide as the others and its minimum.
    const rest = widths.reduce((sum, w, i) => sum + (i === flexible ? ELEMENT_MIN_EM : w), 0);
    this.style.setProperty("--tvb-width", `calc(var(--tvb-idx, ${INDEX_MIN_EM}em) + ${rest}em)`);
    this.setAttribute("aria-colcount", String(widths.length + 1));
  }

  // ---- registering the source ------------------------------------------------------------

  #reset(): void {
    this.#generation++;
    this.#inflight?.controller.abort();
    this.#inflight = undefined;
    this.#client?.release();
    this.#client = undefined;
    this.#registered = false;
    this.#blocks.clear();
    this.#rowEls.clear();
    this.#rowsEl.replaceChildren();
    this.#parked.replaceChildren();
    this.#columns = [];
    this.#furthest = 0n;
    this.#error = this.#warning = "";
    this.#stalled = undefined;
    this.#count = { kind: "atLeast", n: 0n, growing: true };
    this.#top = this.#initialTop();
    this.#active = { index: this.#top, col: 0 };
    this.#drawHeader();
    this.#applySize();
    void this.#register();
    this.#schedule();
  }

  async #register(): Promise<void> {
    const generation = this.#generation;
    let source: MathJsonExpression;
    try {
      source = JSON.parse(this.getAttribute("source") ?? "null") as MathJsonExpression;
    } catch {
      this.#fail("the table's source is not valid JSON");
      return;
    }
    if (source === null) return;
    this.#client = openRowsClient();
    try {
      const reply = await this.#client.register(source);
      if (generation !== this.#generation) return;
      if (!reply.ok) return this.#fail(reply.error);
      this.#columns = reply.columns ?? [];
      this.#random = reply.random === true;
      this.#rowEm = reply.rowHeight ?? this.#rowEm;
      this.#count = reply.count;
      this.#warning = reply.warning ?? "";
      this.#registered = true;
      this.#applySize();
      this.#drawHeader();
      this.#tell();
      this.#schedule();
    } catch (error) {
      if (generation === this.#generation) this.#fail(error instanceof Error ? error.message : String(error));
    }
  }

  #fail(message: string): void {
    this.#error = message;
    log("failed", message);
    this.#tell();
    this.#schedule();
  }

  #tell(): void {
    const status: TableStatus = {
      count: this.#count,
      ...(this.#error && { error: this.#error }),
      ...(this.#warning && { warning: this.#warning }),
      ...(this.#stalled && { stalled: this.#stalled }),
    };
    this.dispatchEvent(new CustomEvent("table-status", { bubbles: true, detail: status }));
  }

  // ---- geometry --------------------------------------------------------------------------

  #applySize(): void {
    const font = Number.parseFloat(getComputedStyle(this).fontSize);
    this.#fontPx = Number.isFinite(font) && font > 0 ? font : 14;
    this.#rowPx = Math.round(this.#rowEm * this.#fontPx * 100) / 100;
    this.style.setProperty("--tvb-row", `${this.#rowPx}px`);
    if (this.#paged && !this.style.height) {
      this.style.height = `${(this.#pageSize + 1) * this.#rowPx + 2.6 * this.#fontPx}px`;
    }
  }

  get #visible(): number {
    const room = this.#viewport.clientHeight - this.#rowPx;
    return this.#paged ? this.#pageSize : visibleRows(room > 0 ? room : this.#rowPx * 10, this.#rowPx);
  }

  get #extent(): number {
    return this.#paged ? this.#pageSize : extentRows(this.#count, this.#furthest, this.#visible);
  }

  get #area(): { px: number; scaled: boolean } {
    return this.#paged ? { px: this.#pageSize * this.#rowPx, scaled: false } : scrollAreaPx(this.#extent, this.#rowPx);
  }

  #clampTop(top: bigint): bigint {
    const floor = top < 1n ? 1n : top;
    const end = endOf(this.#count);
    if (end === undefined) return floor;
    const last = end - BigInt(this.#visible);
    return floor > last ? (last < 1n ? 1n : last) : floor;
  }

  // ---- scrolling -------------------------------------------------------------------------

  #onScroll(): void {
    const scrollTop = this.#viewport.scrollTop;
    if (this.#expected !== undefined && Math.abs(scrollTop - this.#expected) < 1) return;
    this.#expected = undefined;
    if (this.#paged) return;
    const area = this.#area;
    this.#top = this.#clampTop(topAt(scrollTop, area, this.#extent, this.#rowPx, this.#visible));
    this.#sub = area.scaled ? 0 : scrollTop - Number(this.#top - 1n) * this.#rowPx;
    this.#noteMove();
    this.#schedule();
  }

  #onWheel(event: WheelEvent): void {
    if (this.#paged) return event.preventDefault();
    if (!this.#area.scaled) return;
    // A scaled area has no pixels worth scrolling by: move by rows.
    event.preventDefault();
    const rows = Math.sign(event.deltaY) * Math.max(1, Math.round(Math.abs(event.deltaY) / this.#rowPx));
    this.#moveTop(BigInt(rows));
  }

  #moveTop(delta: bigint): void {
    this.setTop(this.#top + delta);
  }

  /** Put row `top` first in view. */
  setTop(top: bigint): void {
    this.#top = this.#clampTop(this.#paged ? ((top - 1n) / BigInt(this.#pageSize)) * BigInt(this.#pageSize) + 1n : top);
    this.#sub = 0;
    this.#syncScroll();
    this.#noteMove();
    this.#schedule();
  }

  /** Jump to row `index`, and focus it once it lands. */
  goTo(index: bigint): void {
    const target = clampIndex(index, this.#count);
    this.#active = { index: target, col: this.#active.col };
    const middle = BigInt(Math.floor(this.#visible / 2));
    this.setTop(this.#paged ? target : target > middle ? target - middle : 1n);
    this.#focusActive();
  }

  #syncScroll(): void {
    if (this.#paged) return;
    const top = scrollTopFor(this.#top, this.#area, this.#extent, this.#rowPx, this.#visible);
    if (Math.abs(this.#viewport.scrollTop - top) >= 1) {
      this.#viewport.scrollTop = top;
      // The browser may clamp the write; what it kept is what to expect back.
      this.#expected = this.#viewport.scrollTop;
    }
  }

  #noteMove(): void {
    const now = performance.now();
    const dt = now - this.#lastMove.at;
    const rows = Number(
      this.#top > this.#lastMove.top ? this.#top - this.#lastMove.top : this.#lastMove.top - this.#top,
    );
    this.#flinging = dt > 0 && dt < 250 && (rows / dt) * 1000 > FLING;
    this.#lastMove = { top: this.#top, at: now };
  }

  // ---- drawing ---------------------------------------------------------------------------

  #schedule(): void {
    if (!this.#built || this.#frame !== 0) return;
    this.#frame = requestAnimationFrame(() => {
      this.#frame = 0;
      this.#render();
    });
  }

  #colWindow(): [number, number] {
    const n = this.#columns.length;
    if (n <= WIDE) return [0, n];
    const left = this.#viewport.scrollLeft / this.#fontPx - INDEX_MIN_EM;
    const right = left + this.#viewport.clientWidth / this.#fontPx;
    let x = 0;
    let first = n;
    let last = 0;
    this.#columns.forEach((c, i) => {
      const w = c.width ?? 8;
      if (x + w >= left && x <= right) {
        first = Math.min(first, i);
        last = Math.max(last, i + 1);
      }
      x += w;
    });
    return [Math.max(0, first - 2), Math.min(n, Math.max(last, first) + 2)];
  }

  #render(): void {
    if (!this.isConnected) return;
    const visible = this.#visible;
    const area = this.#area;
    const height = `${area.px}px`;
    if (this.#space.style.height !== height) {
      this.#space.style.height = height;
      this.#syncScroll();
    }
    this.#layer.style.height = `${this.#viewport.clientHeight}px`;
    this.#top = this.#clampTop(this.#top);
    const view: IndexRange = this.#paged
      ? [this.#top, this.#top + BigInt(this.#pageSize)]
      : windowOf(this.#top, visible, this.#count);
    const above = this.#top - view[0];
    this.#furthest = view[1] - 1n > this.#furthest ? view[1] - 1n : this.#furthest;
    this.#rowsEl.style.transform = `translateY(${-(Number(above) * this.#rowPx + this.#sub)}px)`;

    const cols = this.#colWindow();
    const wanted = new Set<bigint>();
    const ordered: HTMLElement[] = [];
    for (let i = view[0]; i < view[1]; i++) {
      wanted.add(i);
      ordered.push(this.#rowFor(i, cols));
    }
    // The row holding focus stays in the document, parked, when it scrolls out of the window.
    const activeEl = this.#rowEls.get(this.#active.index);
    for (const [index, el] of this.#rowEls) {
      if (wanted.has(index)) continue;
      if (index === this.#active.index) this.#parked.append(el);
      else {
        el.remove();
        this.#rowEls.delete(index);
      }
    }
    if (activeEl !== undefined && wanted.has(this.#active.index) && activeEl.parentElement === this.#parked) {
      activeEl.remove();
    }
    if (ordered.length !== this.#rowsEl.children.length || ordered.some((el, k) => this.#rowsEl.children[k] !== el)) {
      this.#rowsEl.replaceChildren(...ordered);
    }
    this.#marks();
    this.#drawFoot();

    const keep = new Set<bigint>([blockOf(this.#active.index)]);
    for (const b of farOff(this.#blocks.keys(), view, visible, keep)) this.#blocks.delete(b);
    this.#wantRows(view, cols);
  }

  /** The row element for `index`, built (or rebuilt when its data arrived) for the column window. */
  #rowFor(index: bigint, cols: readonly [number, number]): HTMLElement {
    const block = this.#blocks.get(blockOf(index));
    const row = block?.status === "ready" ? block.rows[Number(index - blockRange(blockOf(index))[0])] : undefined;
    const covered = block !== undefined && block.cols[0] <= cols[0] && block.cols[1] >= cols[1];
    const state = row !== undefined && covered ? "ready" : "loading";
    let el = this.#rowEls.get(index);
    const stamp = `${state}:${cols[0]}-${cols[1]}`;
    if (el !== undefined && el.dataset.stamp === stamp) return el;
    const fresh = text("div", "tvb-row");
    fresh.setAttribute("role", "row");
    fresh.setAttribute("aria-rowindex", String(index + 1n));
    fresh.dataset.index = String(index);
    fresh.dataset.stamp = stamp;
    if (state === "loading") fresh.setAttribute("aria-busy", "true");
    const idx = text("div", "tvb-cell tvb-idx", index.toLocaleString("en-US"));
    idx.title = index.toLocaleString("en-US");
    idx.setAttribute("role", "rowheader");
    idx.setAttribute("aria-colindex", "1");
    fresh.append(idx);
    for (let c = cols[0]; c < cols[1]; c++) {
      const cell = text("div", "tvb-cell");
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("aria-colindex", String(c + 2));
      cell.style.gridColumn = String(c + 2);
      cell.dataset.col = String(c);
      cell.tabIndex = -1;
      if (row !== undefined && covered) drawCell(cell, row[c - block!.cols[0]], this.#columns[c]?.numeric === true);
      fresh.append(cell);
    }
    el?.replaceWith(fresh);
    el = fresh;
    this.#rowEls.set(index, el);
    return el;
  }

  /** Roving tabindex: the active cell is the one tab stop. */
  #marks(): void {
    for (const el of this.querySelectorAll<HTMLElement>(".tvb-cell[data-col]")) el.tabIndex = -1;
    const cell = this.#cellEl(this.#active.index, this.#active.col);
    if (cell === undefined) {
      this.#viewport.tabIndex = 0;
    } else {
      cell.tabIndex = 0;
      this.#viewport.removeAttribute("tabindex");
    }
  }

  #cellEl(index: bigint, col: number): HTMLElement | undefined {
    return this.#rowEls.get(index)?.querySelector<HTMLElement>(`[data-col="${col}"]`) ?? undefined;
  }

  #drawFoot(): void {
    const count = this.#count;
    const total = describeCount(count);
    const shown = this.#top + BigInt(this.#visible) - 1n;
    const end = endOf(count);
    const last = end !== undefined && shown >= end ? end - 1n : shown;
    const settled = count.kind === "exact";
    this.#status.textContent = statusText(this.#top, last < this.#top ? this.#top : last, total);
    // The index column fits the rows shown, not the count: a long index is cut short, never the other columns.
    const digits = (last > this.#top ? last : this.#top).toString().length;
    const idx = Math.min(INDEX_MAX_EM, Math.max(INDEX_MIN_EM, digits * 0.6 + 1.4));
    this.style.setProperty("--tvb-idx", `${idx}em`);
    this.setAttribute("aria-rowcount", settled ? String(count.n + 1n) : "-1");
    this.dataset.count = count.kind;
    const message = this.#error || this.#warning;
    this.#note.replaceChildren();
    this.#note.classList.toggle("tvb-error", this.#error !== "");
    if (message) this.#note.append(message);
    if (this.#stalled !== undefined && this.#error === "") {
      const more = text("button", "tvb-button", `scanned ${describeBig(this.#stalled.scanned)} · scan more`);
      more.setAttribute("type", "button");
      more.addEventListener("click", () => void this.#scanMore());
      this.#note.append(message ? " · " : "", more);
    }
    if (!settled && count.kind === "atLeast" && count.growing && this.#registered && !message) {
      this.#note.append("counting…");
    }
    this.#jump.placeholder = settled ? `1–${describeBig(count.n)}` : "jump to";
    this.#jump.title = this.#random ? "" : "This source is walked to a row, so a far jump takes a while.";
    if (this.#paged) this.#drawPager(count);
    clearTimeout(this.#liveTimer);
    this.#liveTimer = setTimeout(() => {
      this.#live.textContent = this.#status.textContent ?? "";
    }, LIVE_MS);
    this.classList.toggle("tvb-busy", this.#inflight !== undefined);
  }

  #drawPager(count: RowCount): void {
    const size = BigInt(this.#pageSize);
    const page = (this.#top - 1n) / size + 1n;
    const pages = count.kind === "exact" ? (count.n + size - 1n) / size : undefined;
    const button = (label: string, to: bigint, disabled: boolean): HTMLElement => {
      const b = text("button", "tvb-button", label);
      b.setAttribute("type", "button");
      b.toggleAttribute("disabled", disabled);
      b.addEventListener("click", () => this.setTop((to - 1n) * size + 1n));
      return b;
    };
    this.#pager.replaceChildren(
      button("‹", page - 1n, page <= 1n),
      `page ${page.toLocaleString("en-US")} of ${pages === undefined ? describeCount(count) : pages.toLocaleString("en-US")}`,
      button("›", page + 1n, pages !== undefined && page >= pages),
    );
  }

  // ---- asking for rows -------------------------------------------------------------------

  #wantRows(view: IndexRange, cols: readonly [number, number]): void {
    if (!this.#registered) return;
    const needed = blocksIn(view).filter((b) => {
      const have = this.#blocks.get(b);
      return have === undefined || (have.status === "ready" && !(have.cols[0] <= cols[0] && have.cols[1] >= cols[1]));
    });
    const loading = this.#inflight;
    if (loading !== undefined) {
      const stillWanted = new Set(blocksIn(view));
      // A scroll that left everything in flight behind stops it; one that still wants some waits.
      if (![...loading.blocks].some((b) => stillWanted.has(b))) loading.controller.abort();
      else return;
    }
    if (needed.length === 0) return;
    clearTimeout(this.#fetchTimer);
    this.#fetchTimer = setTimeout(() => void this.#fetch(needed, cols), this.#flinging ? FLING_SETTLE_MS : 0);
    if (this.#flinging) this.#settleLater();
  }

  /** A fling's rows are asked for once it settles, not as it passes. */
  #settleLater(): void {
    setTimeout(() => {
      this.#flinging = false;
      this.#schedule();
    }, FLING_SETTLE_MS + 20);
  }

  async #fetch(blocks: readonly bigint[], cols: readonly [number, number]): Promise<void> {
    const client = this.#client;
    if (client === undefined || this.#inflight !== undefined) return;
    const view = this.#paged
      ? ([this.#top, this.#top + BigInt(this.#pageSize)] as IndexRange)
      : windowOf(this.#top, this.#visible, this.#count);
    const wanted = new Set(blocksIn(view));
    const mine = blocks.filter((b) => wanted.has(b));
    if (mine.length === 0) return;
    const controller = new AbortController();
    const generation = this.#generation;
    this.#inflight = { controller, blocks: new Set(mine) };
    for (const b of mine) this.#blocks.set(b, { rows: [], cols, status: "loading" });
    this.classList.add("tvb-busy");
    try {
      const reply = await client.range(rangesOf(mine), [cols[0], cols[1]], controller.signal);
      if (generation !== this.#generation) return;
      if (!reply.ok) {
        for (const b of mine) this.#blocks.delete(b);
        return this.#fail(reply.error);
      }
      this.#count = reply.count;
      this.#error = "";
      this.#stalled = undefined;
      for (const batch of reply.batches ?? []) this.#store(batch, cols);
      // What the source had no rows for is answered, empty.
      for (const b of mine) {
        if (this.#blocks.get(b)?.status === "loading") this.#blocks.set(b, { rows: [], cols, status: "ready" });
      }
      this.#warning = reply.warning ?? this.#warning;
      this.#tell();
    } catch (error) {
      if (generation !== this.#generation) return;
      for (const b of mine) if (this.#blocks.get(b)?.status === "loading") this.#blocks.delete(b);
      if (!controller.signal.aborted) this.#fail(error instanceof Error ? error.message : String(error));
    } finally {
      if (this.#inflight?.controller === controller) this.#inflight = undefined;
      this.classList.remove("tvb-busy");
      this.#schedule();
    }
  }

  /** Split a batch into the blocks it covers. */
  #store(batch: RowBatch, cols: readonly [number, number]): void {
    if (batch.stalled !== undefined) this.#stalled = batch.stalled;
    if (batch.declined !== undefined) this.#warning = batch.declined;
    const last = batch.start + BigInt(batch.rows.length);
    if (last > this.#furthest) this.#furthest = last;
    // A request is whole blocks from a block's start, so each block takes its slice.
    for (const b of blocksIn([batch.start, last > batch.start ? last : batch.start + 1n])) {
      const from = Number(blockRange(b)[0] - batch.start);
      this.#blocks.set(b, { rows: batch.rows.slice(from, from + Number(BLOCK_ROWS)), cols, status: "ready" });
    }
  }

  async #scanMore(): Promise<void> {
    const client = this.#client;
    if (client === undefined) return;
    this.#stalled = undefined;
    await client.extend();
    // What was short or partial is asked for again.
    this.#blocks.clear();
    this.#rowEls.clear();
    this.#rowsEl.replaceChildren();
    this.#schedule();
  }

  // ---- keyboard and focus ----------------------------------------------------------------

  #onFocus(event: FocusEvent): void {
    const cell = (event.target as HTMLElement).closest<HTMLElement>(".tvb-cell[data-col]");
    const row = cell?.parentElement;
    if (cell === null || cell === undefined || row === null || row === undefined || row.dataset.index === undefined)
      return;
    this.#active = { index: BigInt(row.dataset.index), col: Number(cell.dataset.col) };
    this.#marks();
  }

  #onKey(event: KeyboardEvent): void {
    if ((event.target as HTMLElement).tagName === "INPUT") return;
    const columns = Math.max(1, this.#columns.length);
    const page = BigInt(Math.max(1, this.#visible - 1));
    let { index, col } = this.#active;
    switch (event.key) {
      case "ArrowDown":
        index += 1n;
        break;
      case "ArrowUp":
        index -= 1n;
        break;
      case "ArrowRight":
        col = Math.min(columns - 1, col + 1);
        break;
      case "ArrowLeft":
        col = Math.max(0, col - 1);
        break;
      case "PageDown":
        index += page;
        break;
      case "PageUp":
        index -= page;
        break;
      case "Home":
        if (event.ctrlKey) index = 1n;
        else col = 0;
        break;
      case "End":
        if (event.ctrlKey) index = endOf(this.#count) ?? index;
        else col = columns - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    index = clampIndex(index, this.#count);
    this.#active = { index, col };
    this.#reveal(index);
    this.#focusActive();
  }

  /** Scroll just enough that `index` is in view. */
  #reveal(index: bigint): void {
    const visible = BigInt(this.#visible);
    if (index < this.#top) this.setTop(index);
    else if (index >= this.#top + visible) this.setTop(index - visible + 1n);
  }

  #focusActive(): void {
    this.#schedule();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => this.#cellEl(this.#active.index, this.#active.col)?.focus({ preventScroll: true }));
    });
  }
}

let stylesInjected = false;

function ensureTableViewStyles(): void {
  if (stylesInjected || typeof document === "undefined") return;
  stylesInjected = true;
  const style = document.createElement("style");
  style.id = "table-view-box";
  style.textContent = CSS;
  document.head.append(style);
}

const CSS = `
table-view-box {
  display: block;
  position: relative;
  contain: strict;
  height: 22rem;
  margin: 0.5rem 0;
  border: 1px solid var(--notatio-border, var(--vp-c-divider, #d4d4d8));
  border-radius: 8px;
  background: var(--notatio-bg, var(--vp-c-bg, #fff));
  font-size: 0.85rem;
  overflow: hidden;
}
.tvb-viewport { position: absolute; inset: 0 0 2.2rem 0; overflow: auto; overscroll-behavior: contain; }
.tvb-space { position: relative; width: max(100%, var(--tvb-width, 100%)); }
.tvb-layer { position: sticky; top: 0; left: 0; overflow: clip; width: max(100%, var(--tvb-width, 100%)); }
.tvb-rows { will-change: transform; }
.tvb-parked { position: absolute; top: 0; left: 0; width: 100%; opacity: 0; pointer-events: none; }
.tvb-row {
  display: grid;
  grid-template-columns: var(--tvb-tracks, 5.5em 1fr);
  height: var(--tvb-row, 1.9em);
  align-items: center;
  border-bottom: 1px solid var(--vp-c-divider, #eee);
}
.tvb-row[aria-busy] .tvb-cell:not(.tvb-idx) { background: linear-gradient(90deg, transparent, var(--vp-c-bg-soft, #f0f0f2), transparent); background-size: 200% 100%; }
.tvb-row:hover { background: var(--vp-c-bg-soft, #f6f6f7); }
.tvb-header {
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--vp-c-bg, #fff);
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--vp-c-text-3, #888);
  user-select: none;
}
.tvb-cell {
  padding: 0 0.6em;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-family: var(--notatio-mono, ui-monospace, monospace);
  font-size: 0.82em;
  line-height: 1.2;
  max-height: 100%;
}
.tvb-header .tvb-cell { font-family: inherit; font-size: inherit; }
.tvb-cell:focus-visible { outline: 2px solid var(--vp-c-brand-1, #3451b2); outline-offset: -2px; }
.tvb-idx {
  position: sticky;
  left: 0;
  z-index: 1;
  grid-column: 1;
  background: inherit;
  background-color: var(--vp-c-bg, #fff);
  color: var(--vp-c-text-3, #888);
  font-size: 0.75em;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.tvb-num { text-align: right; font-variant-numeric: tabular-nums; }
.tvb-cell svg { height: 1.6em; width: auto; display: inline-block; vertical-align: middle; }
.tvb-sortable { cursor: pointer; text-decoration: underline dotted var(--vp-c-divider, #bbb); text-underline-offset: 3px; }
.tvb-sortable:hover, .tvb-sortable[aria-sort="ascending"], .tvb-sortable[aria-sort="descending"] { color: var(--vp-c-brand-1, #3451b2); }
.tvb-foot {
  position: absolute;
  inset: auto 0 0 0;
  height: 2.2rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0 0.7rem;
  border-top: 1px solid var(--vp-c-divider, #e5e5e5);
  background: var(--vp-c-bg-soft, #f6f6f7);
  color: var(--vp-c-text-2, #555);
  font-size: 0.78rem;
  white-space: nowrap;
}
.tvb-status { font-variant-numeric: tabular-nums; }
.tvb-note { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; color: var(--vp-c-text-3, #888); font-style: italic; }
.tvb-error { color: var(--vp-c-danger-1, #c0392b); font-style: normal; }
.tvb-jump { display: inline-flex; align-items: center; gap: 0.35rem; margin-left: auto; }
.tvb-input {
  width: 8.5rem;
  padding: 0.15rem 0.4rem;
  border: 1px solid var(--vp-c-divider, #d4d4d8);
  border-radius: 6px;
  background: var(--vp-c-bg, #fff);
  color: inherit;
  font: inherit;
  text-align: right;
}
.tvb-input[aria-invalid] { border-color: var(--vp-c-danger-1, #c0392b); }
.tvb-button {
  border: 1px solid var(--vp-c-divider, #d4d4d8);
  border-radius: 6px;
  background: var(--vp-c-bg, #fff);
  color: var(--vp-c-text-2, #555);
  font: inherit;
  padding: 0.1rem 0.5rem;
  cursor: pointer;
}
.tvb-button[disabled] { opacity: 0.4; cursor: default; }
.tvb-pager { display: inline-flex; align-items: center; gap: 0.4rem; }
.tvb-live { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
table-view-box[pagination] .tvb-viewport { overflow: hidden; }
`;

if (!customElements.get("table-view-box")) customElements.define("table-view-box", TableViewBox);

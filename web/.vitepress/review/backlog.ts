// Pure parser/rewriter for the review backlog markdown file (see AGENTS.md /
// the review-mode spec). No fs access here -- callers (the dev-server plugin,
// tests) pass raw text in and get raw text back, so this stays unit-testable
// without touching disk.
//
// The rewriter is surgical: given a raw string and a patch for one item's id,
// it edits only that item's checkbox character and/or Feedback body in place.
// Everything else -- including items nobody asked to touch -- is left
// byte-for-byte identical, because we never re-serialize the whole document.

export type ItemStatus = "open" | "reviewed" | "needs-work";

export interface Bullet {
  key: string;
  value: string;
}

export interface BacklogItem {
  id: string;
  title: string;
  status: ItemStatus;
  link?: string;
  pr?: string;
  check?: string;
  note?: string;
  /** Every bullet in source order, known and unknown keys alike. */
  bullets: Bullet[];
  feedback: string;
}

export interface Backlog {
  intro: string;
  items: BacklogItem[];
}

export interface ItemPatch {
  status?: ItemStatus;
  feedback?: string;
}

const STATUS_TO_CHAR: Record<ItemStatus, string> = {
  open: " ",
  reviewed: "x",
  "needs-work": "!",
};

function charToStatus(ch: string): ItemStatus {
  if (ch === "x" || ch === "X") return "reviewed";
  if (ch === "!") return "needs-work";
  return "open";
}

// `### [ ] Title {#id}` -- tolerant of trailing spaces and a trailing \r (CRLF files).
const HEADING_RE = /^### \[([ xX!])\] (.+?) \{#([A-Za-z0-9_-]+)\}[ \t]*\r?$/gm;
const FEEDBACK_HEADING_RE = /^#### Feedback[ \t]*\r?$/m;
const BULLET_RE = /^- ([A-Za-z][\w-]*):[ \t]?(.*?)\r?$/;

interface Block {
  id: string;
  title: string;
  statusChar: string;
  /** Absolute index, in the original raw text, of the status char inside `[…]`. */
  statusCharIndex: number;
  start: number;
  end: number;
  bullets: Bullet[];
  feedback: string;
  /** Absolute [start, end) of the Feedback body (after the heading's own line), if present. */
  feedbackRegion?: [number, number];
  /** Absolute index right after the bullet block, where a Feedback section can be inserted. */
  insertFeedbackAt: number;
}

function lineEndAfter(raw: string, idx: number): number {
  const nl = raw.indexOf("\n", idx);
  return nl === -1 ? raw.length : nl + 1;
}

function parseBlocks(raw: string): { intro: string; blocks: Block[] } {
  const headingMatches = [...raw.matchAll(HEADING_RE)];
  const intro = raw.slice(0, headingMatches[0]?.index ?? raw.length);
  const blocks: Block[] = [];

  for (let i = 0; i < headingMatches.length; i++) {
    const m = headingMatches[i]!;
    const start = m.index;
    const end = headingMatches[i + 1]?.index ?? raw.length;
    const headingLineEnd = start + m[0].length;
    const bracketOffset = m[0].indexOf("[");
    const statusCharIndex = start + bracketOffset + 1;

    let pos =
      headingLineEnd < raw.length && raw[headingLineEnd] === "\n"
        ? headingLineEnd + 1
        : headingLineEnd;

    // Bullets: contiguous `- key: value` lines right after the heading.
    const bullets: Bullet[] = [];
    for (;;) {
      if (pos >= end) break;
      const lineEnd = lineEndAfter(raw, pos);
      const line = raw.slice(pos, Math.min(lineEnd, end)).replace(/\r?\n?$/, "");
      const bm = BULLET_RE.exec(line);
      if (!bm) break;
      bullets.push({ key: bm[1]!, value: bm[2]! });
      pos = lineEnd;
    }
    const insertFeedbackAt = pos;

    // Feedback section: from `#### Feedback` (searched anywhere in the remainder
    // of the block) to the block's end.
    const rest = raw.slice(pos, end);
    const fm = FEEDBACK_HEADING_RE.exec(rest);
    let feedback = "";
    let feedbackRegion: [number, number] | undefined;
    if (fm) {
      const headingAbsEnd = pos + fm.index + fm[0].length;
      const bodyStart =
        headingAbsEnd < end && raw[headingAbsEnd] === "\n" ? headingAbsEnd + 1 : headingAbsEnd;
      feedbackRegion = [bodyStart, end];
      feedback = raw.slice(bodyStart, end).trim();
    }

    blocks.push({
      id: m[3]!,
      title: m[2]!.trim(),
      statusChar: m[1]!,
      statusCharIndex,
      start,
      end,
      bullets,
      feedback,
      feedbackRegion,
      insertFeedbackAt,
    });
  }

  return { intro, blocks };
}

function toItem(block: Block): BacklogItem {
  const known = new Set(["link", "pr", "check", "note"]);
  const item: BacklogItem = {
    id: block.id,
    title: block.title,
    status: charToStatus(block.statusChar),
    bullets: block.bullets,
    feedback: block.feedback,
  };
  for (const b of block.bullets) {
    if (known.has(b.key)) (item as unknown as Record<string, string>)[b.key] = b.value;
  }
  return item;
}

export function parseBacklog(raw: string): Backlog {
  const { intro, blocks } = parseBlocks(raw);
  return { intro, items: blocks.map(toItem) };
}

/**
 * Render a whole item as a fresh `### [ ] Title {#id}` block, bullets in source
 * order, then a `#### Feedback` section -- the same shape `applyItemPatch` expects
 * to find, so a block written by this and one hand-authored in REVIEW.md round-trip
 * identically through `parseBacklog`. Used to append brand-new (ad-hoc) items and to
 * build the "Copy feedback" clipboard payload.
 */
export function serializeItem(item: BacklogItem): string {
  const heading = `### [${STATUS_TO_CHAR[item.status]}] ${item.title} {#${item.id}}\n`;
  const bulletLines = item.bullets.map((b) => `- ${b.key}: ${b.value}\n`).join("");
  const feedback = item.feedback.trim();
  const feedbackSection = `\n#### Feedback\n${feedback ? `\n${feedback}\n\n` : "\n"}`;
  return heading + bulletLines + feedbackSection;
}

/**
 * Patch an existing item, or append a brand-new one (an ad-hoc item created from a
 * modifier-click) if `item.id` isn't in the file yet. Existing items are still
 * touched surgically via `applyItemPatch`; only a genuinely new id causes an append,
 * and that append never rewrites anything already in the file.
 */
export function upsertItem(raw: string, item: BacklogItem): { raw: string; item: BacklogItem } {
  const { blocks } = parseBlocks(raw);
  if (blocks.some((b) => b.id === item.id)) {
    return applyItemPatch(raw, item.id, { status: item.status, feedback: item.feedback })!;
  }
  const sep =
    raw.length === 0 ? "" : raw.endsWith("\n\n") ? "" : raw.endsWith("\n") ? "\n" : "\n\n";
  const out = `${raw}${sep}${serializeItem(item)}`;
  const reparsed = parseBlocks(out).blocks.find((b) => b.id === item.id)!;
  return { raw: out, item: toItem(reparsed) };
}

/**
 * Apply a patch (status and/or feedback) to one item, identified by id.
 * Returns the rewritten raw text and the item's fresh state, or `undefined`
 * if no item with that id exists (callers should treat that as a 409: the
 * item was removed from under the request).
 */
export function applyItemPatch(
  raw: string,
  id: string,
  patch: ItemPatch,
): { raw: string; item: BacklogItem } | undefined {
  const { blocks } = parseBlocks(raw);
  const block = blocks.find((b) => b.id === id);
  if (!block) return undefined;

  let statusChar = block.statusChar;
  if (patch.status !== undefined) statusChar = STATUS_TO_CHAR[patch.status];

  let out = raw;
  if (statusChar !== block.statusChar) {
    out = out.slice(0, block.statusCharIndex) + statusChar + out.slice(block.statusCharIndex + 1);
  }

  if (patch.feedback !== undefined) {
    const trimmed = patch.feedback.trim();
    const region = trimmed.length > 0 ? `\n${trimmed}\n\n` : "\n";
    if (block.feedbackRegion) {
      const [rs, re] = block.feedbackRegion;
      out = out.slice(0, rs) + region + out.slice(re);
    } else {
      const insertion = `\n#### Feedback\n${region}`;
      out = out.slice(0, block.insertFeedbackAt) + insertion + out.slice(block.insertFeedbackAt);
    }
  }

  const reparsed = parseBlocks(out).blocks.find((b) => b.id === id)!;
  return { raw: out, item: toItem(reparsed) };
}

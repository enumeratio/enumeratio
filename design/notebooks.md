# Design: the worksheet and the notebook, and keeping them

Status: **proposed** (2026-09-25). Stage 0 has landed: `/worksheet/` and `/notebook/` exist
as routes, the worksheet is live, nothing is saved. Everything after §5's stage 0 is design.

## 1. Two surfaces, not one

There are two things people mean by "a notebook", and they want different machinery.

|                   | **worksheet** (Desmos)                       | **notebook** (Wolfram, Jupyter)                   |
| ----------------- | -------------------------------------------- | ------------------------------------------------- |
| a cell is         | a definition: a name and what it is          | an event: something you asked, and what came back |
| order means       | nothing — cells are scheduled by dependency  | time — `In[3]` ran after `In[2]`                  |
| editing a cell    | recomputes everything downstream, live       | reruns that cell; later cells go stale            |
| refer to a result | by name only                                 | by name, or by number: `Out(2)`, `Out(-1)`        |
| side effects      | none worth having (a random draw redraws)    | kept — a draw is part of the record               |
| prose             | beside the cells, at most a caption          | first-class: text, sections, headings             |
| what it's for     | turning something over by hand: knobs, views | working something out, and leaving the working    |
| saved as          | its definitions (the output is re-derivable) | inputs _and_ outputs (the output is history)      |

The worksheet is the one that exists. `<notatio-worksheet>` is cells plus a shared screen:
a binding to a plain number gets a slider, a cell with a free axis variable gets drawn,
and there is no control or plot syntax because both fall out of the cells. The notebook
exists only as a transcript at a terminal: the CLI's REPL keeps `In[n]`/`Out[n]`, and
`<notatio-terminal>` runs that in a page — the right evaluation model in the wrong shape.

The web gets **both**, each at its own route, named for what it is:

- **`/worksheet/`** — the reactive, Desmos-like surface.
- **`/notebook/`** — the transcript: ordered cells, prose between them, `Out(n)` references.

### Why these names, and one that is wrong today

`Notebook` is a Wolfram symbol and it means the transcript. The component-naming rule
(`component-naming.md` §3) says a component that represents a symbol takes that symbol's
name — so `<notatio-notebook>`, which is today a reactive, name-only, reorderable list of
cells with **no** transcript, is squatting on the name the transcript needs. It is the
worksheet without a screen: same `<notatio-dynamic-module tracked-symbols="all">`, same
`:=` cells, same drag-to-reorder, minus the knobs and views.

So the proposal is:

1. The reactive surface is the **worksheet**, always. The current `<notatio-notebook>`
   becomes a worksheet with no screen (`<notatio-worksheet screen="none">`, or simply a
   worksheet none of whose cells draws — which already has no screen).
2. That frees `notatio-notebook` for the transcript, which is what the symbol means.

Per component-naming §6 the rename is folded into the work that next touches the file —
here, stage 4 below, when the transcript element is written — not done in passing. Until
then the playground's notebook page keeps its name and the two routes say which is which.

(The worksheet page's own note said the notebook "keeps an `In[n]`/`Out[n]` transcript".
It does not — both elements are reactive. That note is corrected in this change.)

## 2. The routes

VitePress renders static pages, so a route is a page, not a server: one page per surface
holds every document of that kind, and which document is open lives in the URL.

| URL                     | shows                                                           |
| ----------------------- | --------------------------------------------------------------- |
| `/worksheet/`           | a scratch worksheet (today: the only thing it does)             |
| `/worksheet/#w=<id>`    | a saved worksheet, by its local id (stage 2)                    |
| `/worksheet/#s=<data>`  | a worksheet carried whole in the URL — a link, no server (§4.4) |
| `/worksheets/`          | your saved worksheets, newest first (stage 2)                   |
| `/notebook/`, `#n=<id>` | the same, for notebooks (stage 4)                               |

A hash, not a query string: it never reaches a server, so nothing about a document leaves
the machine by being opened, and a static host needs no rewrite rules for it.

The worksheet page uses `layout: page` — no sidebar, no outline — because the screen
wants the width. The home page's primary action opens it.

## 3. The document

### 3.1 A saved worksheet is its seed

`<notatio-worksheet>` already reads its cells from `seed`: a JSON array whose entries are
a source string, or an object `{value, locked, bind, domain, integer}`. That is almost a
file format already, and making it _the_ file format means there is one shape to test, one
parser, and a saved worksheet can be pasted into a page as a `seed` with no conversion.

```json
{
  "kind": "worksheet",
  "version": 1,
  "title": "The polylogarithm's order",
  "cells": ["s := 2", "PolyLog(s, z)", { "value": "Zeta(s, z)", "hidden": true }]
}
```

What the seed cannot say yet, and a saved worksheet must:

- **visibility** — the toggle beside a drawable cell (`hidden: true`);
- **a projection override** — a cell told to draw other than its variables imply;
- **the screen's height and fold**, if the reader changed them.

View settings do _not_ need a field: they are already cells (`$\mathsf{extent}$ := 1.2`).
That is the test for any new field — if it can be a cell, it is a cell.

Sources stay **notatio** in the file, whatever `in-form` the page used, because notatio is
what the cells hold internally and what reads back identically in five years.

### 3.2 A saved notebook keeps its outputs

A transcript's outputs are not re-derivable — `RandomInteger(10)` drew what it drew, and a
notebook that silently redraws on open is lying about its own history. So a notebook stores
each input cell's source **and** its last output (MathJSON, the interchange form), plus the
cells that are not inputs at all: text (Markdown with `$…$` islands, which the site already
renders), and section headings. Opening a notebook shows the stored outputs; running it is
something you ask for. This is Jupyter's and Wolfram's shape, and for the same reason.

## 4. Keeping them, on your machine

No accounts and no server: a document lives in the browser that made it, durably, and
works with the network off. Sharing across machines is later (§4.5) — but the format and
the storage seam are chosen now so it slots in without a migration.

### 4.1 Where: IndexedDB, behind a four-method interface

```ts
interface DocumentStore {
  list(kind: "worksheet" | "notebook"): Promise<DocumentSummary[]>;
  get(id: string): Promise<StoredDocument | undefined>;
  put(doc: StoredDocument): Promise<void>; // rejects on a stale `rev`
  delete(id: string): Promise<void>;
}
```

- **IndexedDB** is the store: structured, asynchronous, available everywhere the elements
  run, and large enough (a worksheet is a few kilobytes; a notebook with pictures in its
  outputs, megabytes). One object store, keyed by id, indexed by `kind` and `modified`.
- **Not `localStorage`**: synchronous, small, strings only, and the first thing cleared.
  The review mode's `localStorage` source is fine for what it is; this is not that.
- **Not OPFS** for now: better for large binary blobs, but a worse fit for small records
  listed by date, and it buys nothing until notebooks carry big images. The interface
  above hides the choice, so it can change.
- **`navigator.storage.persist()`** on first save. Without it a browser may evict the
  whole origin under storage pressure; with it, eviction needs the user's say. The page
  says which one it got — "saved in this browser" and "saved in this browser, and it may
  be cleared" are different promises.

The store is the **page's**, not the element's. `<notatio-worksheet>` stays
storage-agnostic, the way it is theme-agnostic: it takes a document and reports changes;
something else decides where they go. That is what lets the same element sit in a guide
(never saved), on `/worksheet/` (saved to IndexedDB) and later somewhere synced.

### 4.2 When: every change, debounced

The element emits a change event carrying the document (§3.1 shape); the page writes it
after a short quiet period (~500 ms) and on `pagehide`. There is no save button, as there
is none in Desmos — a document you have to remember to save is one you lose. Undo is the
element's concern, not the store's.

### 4.3 More than one tab

Two tabs can have the same worksheet open. Each write carries the `rev` it was based on;
a write against a stale `rev` is refused, and a `BroadcastChannel` tells the other tabs a
document changed so they reload it rather than overwrite it. The simple rule: the tab you
are typing in wins, and a tab that was not being edited follows along. A true conflict
(both edited) keeps both, the second as a copy — never a silent loss.

### 4.4 Out of the browser: files and links

"Durable on your machine" should not mean "durable in one browser profile". Two exits,
both serverless:

- **Export / import a file** — the §3 JSON, as `<title>.worksheet.json`. Where the File
  System Access API exists, a document can be bound to a real file and saved back to it.
- **A link that carries the document** — the §3 JSON, compressed
  (`CompressionStream("deflate-raw")`) and base64url-encoded into `#s=`. A worksheet is
  small enough that this is a practical share link today, with no server at all; opening
  one makes a local copy. This is the cheapest form of "share across machines", and it is
  worth having even after a real one exists.

### 4.5 Offline, and later, sync

- **Offline** needs a service worker that precaches the worksheet page and the chunks it
  loads (the engine, the elements, MathLive's fonts). Everything already evaluates
  client-side, so once cached the page works with no network. VitePress ships no service
  worker; a small hand-written one scoped to `/worksheet/` and `/notebook/` is enough and
  keeps the rest of the site's caching as it is.
- **Sync** is out of scope, but cells already have stable ids (the elements key their DOM
  on them), which is exactly what a CRDT (Automerge, Yjs) keys on. A synced store is a
  second `DocumentStore`, and the §3 JSON is its snapshot format.

## 5. Stages

0. **Routes, live, unsaved.** `/worksheet/` renders a full-width worksheet with a starter
   seed; `/notebook/` says what the notebook will be and shows the transcript that exists
   today (the in-browser REPL). _(this change)_
1. **The element reports its document.** `<notatio-worksheet>`: a `notatio-change` event
   carrying the §3.1 document; a `document` property to read it; `hidden` and projection
   overrides in the seed; re-seeding when `seed` changes after first render (today it only
   seeds an empty sheet).
2. **Saved locally.** The IndexedDB `DocumentStore`, autosave, `persist()`, the
   `/worksheets/` list, `#w=<id>` routing, the multi-tab rule.
3. **Out of the browser.** Export/import, `#s=` links.
4. **The notebook.** The transcript element takes the `notatio-notebook` name (§1); text and
   section cells; stored outputs; the same store with `kind: "notebook"`. The reactive
   `<notatio-notebook>` folds into the worksheet in the same change.
5. **Offline.** The service worker.

Sync is not a stage yet.

## 6. Open questions

- **Titles.** A worksheet's title: typed, or the first cell's name? Desmos makes you type
  one; an untitled sheet named for its first binding is friendlier and never wrong.
- **One store per origin.** `enumeratio.dev` and each `<sha7>.enumeratio.pages.dev` preview
  are different origins, so a preview never sees your saved worksheets. That is the right
  default (a preview should not write into your real documents); an import from a file or
  an `#s=` link is how to try a document against a preview.
- **Does a notebook re-run on open?** Proposed: no (§3.2). But a notebook whose engine has
  moved on since it was saved should say so, the way the reference pages pin examples.
- **Is `/worksheets/` a page, or a menu on `/worksheet/`?** Desmos puts the list in a
  drawer on the graph itself, which keeps you one click from both.

# Review mode

A sidebar on the docs dev server for working through the review backlog: what landed, where to
look, and a place to leave feedback that coordinator sessions pick up.

## The backlog

`<git common dir>/lanes/REVIEW.md` — in the main checkout that's `.git/lanes/REVIEW.md`. It lives
inside `.git` on purpose: untracked, and one file shared by every worktree. That also hides it
from editors and file trees; open it directly (`code .git/lanes/REVIEW.md`) or through the panel.
`REVIEW_FILE=<path>` points the dev server at another file.

Each item:

```text
### [ ] Title {#anchor}
- link: https://enumeratio.dev/<page>#<target>
- pr: #123 · area · …
- check: what to look at, and what it should show
- note: optional

#### Feedback

Your notes go here.
```

`[ ]` open, `[x]` reviewed, `[!]` needs work. Coordinators add items at the top; the panel and
hand edits both patch items in place, so either is fine.

## Reviewing

1. `cd web && pnpm run dev` (from any worktree), then open `/review`. The panel opens on the
   last item you had selected, or the first open one. On any other page, the **☰ Review** button
   bottom-right opens it; it starts collapsed on every page load.
2. Pick an item (click, or `j` / `k`): the site navigates to its `link`, anchor included, and
   outlines the target. Links on `enumeratio.dev` or a `<sha7>.enumeratio.pages.dev` preview
   open locally, so what you see is this checkout — an item whose PR hasn't merged 404s here;
   use its preview instead. Other hosts get an "Open in new tab" link.
3. Type in **Feedback**; it autosaves into the item's `#### Feedback` section.
4. Tick the checkbox for reviewed, or ⚑ for needs work (`1` open, `2` reviewed, `3` needs work
   when not typing). Filters and search narrow the list.
5. Something without an item: Alt+Cmd-click (Alt+Ctrl elsewhere) any element with an id — an
   example, a heading, a section — to open or create an ad-hoc item for it.

Edits go to localStorage first and flush to the file when the dev server answers, so a stopped
server doesn't lose them. Off localhost (a `VITE_REVIEW=1` build) there's no file: **Copy
feedback** puts every item with feedback on the clipboard in the same markdown shape.
`?review=off` hides review mode in this browser; `?review` brings it back.

## How feedback gets acted on

Coordinator sessions read the `#### Feedback` sections and `[!]` items, and fix or follow up in
PRs. There's no notification: to get something handled now, point a session at the item's
`#anchor`.

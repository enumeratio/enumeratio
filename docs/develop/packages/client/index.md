# @enumeratio/client

The TypeScript **read-through client** over the pure-SQL core ([`@enumeratio/data`](/develop/packages/data/)). Point it at a
PGlite database, `construct` a collection, then enumerate, count, rank/unrank, project statistics, group into
distributions and triangles, follow maps, render representations, and value-address elements — all lazily, all as SQL
against the core. The [CLI](/develop/packages/cli/), the [explorer](/explore/collection/), and the [components](/develop/packages/components/)
(client-backed web elements) are thin drivers over this one API.

## Wiring a database

The math API is decoupled from where PGlite runs: an entry calls `provideDb(factory)` **once** to register how the
`Db` is built, and every call lazily boots it on first query. There are three provider modes — pick by environment and
how heavy the queries are.

| Mode | Where PGlite runs | Use it for |
|------|-------------------|------------|
| `makeDb()` | main thread, in-process | node one-shots (the CLI, oracle tests); a small embedded browser widget with its own row cap |
| `makeWorkerDb()` | a Web Worker (browser) / `worker_threads` worker (node) | **the browser default** — real enumeration never blocks the UI; node gets a per-query watchdog |
| `makeServiceWorkerDb()` | a SharedWorker engine + ServiceWorker controller (browser only) | one shared, observable calculation surface across all same-origin tabs |

**Prefer the worker-backed provider in the browser.** A big enumeration on the main thread freezes the page — and a
per-page main-thread `makeDb()` is the double-boot anti-pattern issue #40 moved the docs theme off of. Set the worker
provider once, globally:

```ts
import { provideDb, makeWorkerDb, construct } from '@enumeratio/client'

provideDb(() => makeWorkerDb())   // off-thread; the pglite Db boots on the first query

const p = construct('permutations', { size: 4 })
await p.card()                               // 24
await p.serialize(0, 3)                      // ['1234', '1243', '1324']
await p.serialize(0, 3, { repr: 'cycle' })   // cycle notation
await p.window(0, 3, { stats: ['inversions'], maps: ['cycle_type'] })
await p.at('@2413')                          // value-address by serialization
await p.glyphSvg(0)                          // the element's page-space SVG, from the db (null if none)
```

The package resolves per-environment: `@enumeratio/client` gives you the **node** loaders (`makeDb`, `makeWorkerDb`,
`setQueryTimeout`); the same import under a browser bundler resolves to the **browser** entry, which adds
`makeServiceWorkerDb` (and `SessionDb` / `SessionEvent` / `Presence`). `makeDb` and `makeWorkerDb` exist in both.

::: tip provider lifecycle
`provideDb` only stores the factory; the DB is a process-lifetime singleton booted lazily and cached. `close()` tears
it down (and clears the cache, so the next query re-boots). The client assumes the schema doesn't change under it.
:::

The node worker provider carries a **watchdog**: a query that outlives the timeout is rejected and its worker
terminated (a non-terminating enumeration can't be stopped otherwise), respawning on the next query. Tune it with
`setQueryTimeout(ms)` (`0` disables). It's a no-op in the browser.

## The `Handle`

`construct(collection, args)` (or `new Handle(collection, args)`) returns a lazy handle. Every method is `async` — the
DB may be off-thread. Nothing runs until you call one.

**Family parameters** are supplied by name and bound **positionally**: `size` is parameter 1, then the collection's
grade chain in order. A parameter is either a **point** (`{ size: 4 }`) or a `[lo, hi]` **range** (`{ size: [3, 5] }`),
which spans a union of fibers. `construct('permutations', 4)` is shorthand for `{ size: 4 }`. `withGrade(axis, value)`
returns a sibling handle with one parameter re-fixed.

### Counting and enumerating

- `card()` — `|collection|`; `null` means infinite (an unbounded or open handle).
- `serialize(first?, count?, opts?)` — the canonical serializations of ranks `[first, first+count)`.
- `window(first, count, opts?)` — a page of `Result` rows: `element` plus `__rank`, `__address`, `__ordinality`, and
  any projected stats/maps (see options below).
- `all(opts?)` / `take(n, opts?)` — the whole finite fiber / the first `n`.
- `elements(opts?)` — an async generator that pages the canonical stream lazily (a finite handle ends itself; an
  unbounded one runs until you `break`).
- `at(address, opts?)` — one element by a bare **rank** (`'5'`) or a **serialization** (prefix `@` to force it:
  `'@2413'`). Returns `null` if the address names no element.
- `rankOf(serialization)` — the canonical rank of a value-addressed element (`null` if unknown).

`Result` carries two positions: `__rank` is the element's **canonical** 0-based position (the true rank, ignoring any
filter — the address for unrank / deep-links), while `__ordinality` is its 1-based position **within the current
result set**. They coincide (ord = rank + 1) when unfiltered and in canonical order, and diverge under a `where` or a
custom `orderBy`.

### `WindowOpts`

```ts
type WindowOpts = {
  stats?: string[]     // stat ids to project as columns
  maps?: string[]      // map ids to project as codomain-image columns ("map:<id>")
  through?: string[]   // a composed-map chain, projected as one image column
  data?: boolean       // include __data: the carrier composite as JSON (the element AS DATA)
  glyph?: boolean      // include __svg: the db-emitted page-space SVG (carriers with a glyph_svg overload)
  where?: string       // raw-SQL row predicate over the output aliases
  orderBy?: string     // raw-SQL sort over the output aliases (name the canonical order `address`)
  repr?: string        // representation (canonical | a named -R repr | 'ambient'); format/medium/alphabet reserved
}
```

`where` / `orderBy` are **raw SQL fragments** spliced into the elements query — a dev-tool escape hatch over the
user's own local PGlite (no injection concern), referencing the projected output aliases (stat ids, quoting hyphenated
ones as `"tag-count"`; `element`; `__rank`; `map:<id>`). Present, either one materializes and sorts the **whole**
fiber before the window is cut, so they require a **bounded** handle — `window()` throws on an infinite one, and the
caller must gate the UI to bounded collections.

### Statistics, distributions, triangles

- `stats()` / `maps()` — the collection's registered statistics and outgoing maps (own + carrier-inherited).
- `groupBy(statId, { summarize? })` — one SQL `GROUP BY`: per value of the statistic, its count (the Pascal / Mahonian
  / Stirling triangle cell) plus min/max/sum of the other statistics.
- `distribution(statId)` — the histogram over the finite collection, plus total / support / mode / mean.
- `triangle(statId)` — that distribution split **per fiber** over a size range: the Mahonian / Eulerian / Stirling /
  Narayana triangle as data (one `TriangleRow` per fiber, tagged with its parameters).

### The whole-view query

`window()`'s bigger sibling models a whole collection page as **one SELECT** (https://github.com/enumeratio/enumeratio/wiki/Query-Model): projection
+ `WHERE` + `GROUP BY`/`HAVING` + `ORDER BY`. Bounded collections only.

- `select(config, window?)` — the projected, filtered, sorted rows (the table's rows _are_ this).
- `group(config)` — one row per `groupBy` value with its element count (the triangle / distribution).
- `viewCount(config)` — how many rows the view returns, without fetching them (so a table can size itself).
- `viewSql(config, window?)` — the underlying SQL (also the naive reference the self-cert harness diffs against).

### Fibers vs elements

A fully-pointed handle is one fiber; a range or an unbound parameter spans many.

- `fibers()` — one `Fiber` per family-parameter address, each with its resolved params, a concrete sub-`Handle` to
  enumerate, and its cardinality.
- `fiberCount()` / `gradeCounts()` / `aggregate('sum' | 'max' | 'min')` — how many fibers, their per-fiber counts (the
  Stirling / binomial row), and a reduction over them.
- Default `for await` follows the rule: a multi-fiber handle yields its **fibers** (drill in via `.collection`); a
  single-fiber handle yields its **elements**.

### Maps

- `imageThrough(address, mapId)` — read one element through a single map, returning the image in the map's codomain.
- `compose(address, mapIds)` — read it through a **composition** of maps, left-to-right (each codomain feeds the next
  domain).

### Glyphs

- `rendersSvg()` — whether the carrier declares a `glyph_svg` overload (so the db can emit an SVG figure).
- `glyphSvg(rank)` — the page-space SVG for one element (`null` when the carrier has no glyph — the caller falls back
  to a built-in or to text). The `glyph: true` window option projects the same as a `__svg` column.

## Session mode

`makeServiceWorkerDb()` (browser only) returns a `SessionDb`: a normal `Db` (so `provideDb()` works unchanged) plus a
control/observability surface over a **shared** engine — one PGlite in a SharedWorker, serving every same-origin tab,
fronted by a versioned ServiceWorker controller. Beyond `query`/`close` it adds:

- `on(handler)` — subscribe to the live `SessionEvent` stream (activity from all tabs, liveness, notifications).
- `notify(note)` — fan a notification out to every tab (and, via the controller, possibly an OS notification).
- `flush()` — ask the controller to replace itself now.
- `presence` — a liveness snapshot (phase, connected tab count, transport).

It degrades gracefully: no SharedWorker (Vite dev shim, no Android support) falls back to a per-tab dedicated worker;
no ServiceWorker just drops the notification/flush plane. See https://github.com/enumeratio/enumeratio/wiki/Service-Worker-And-Session.

## Catalog & module functions

Beyond handles, the module exposes the catalog as data — `collections()`, `collectionMeta()`, `describe(id)`,
`summary()`, `catalog()`, `gradeChain(id)`, `carriers()`, `svgCarriers()` — and the registries behind it: `traits()` /
`collectionTraits()`, `tags()` / `collectionTags()`, `categories()` / `collectionCategories()`, `constructions()`,
`species()`, `references()`, `mapGraph()`, the polytope readers (`polytopeCollections()`, `polytope()`,
`permutationVectors()`, `associahedron()`), and the per-ring `evaluateExpression(type, expr, ground?)` calculator with
its `algebraTypes()` / `expressionExamples()`.

Two escape hatches over the live DB: `extendDb(sql)` applies SQL to the running connection (the "representations as
data" seam — define a `glyph_svg` overload or a view and it's usable immediately, no rebuild), and `setDebug(true)`
(or `?debug` / `localStorage['enumeratio:debug']='1'`) logs a failed query's SQL + Postgres context before rethrowing.

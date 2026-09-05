# Adding a collection

This guide walks through adding a new combinatorial collection to the [`@enumeratio/data`](/develop/packages/data/) core,
end to end. It targets the current schema (`base_*`) and shows one real collection — `words` — as a worked example.

## The model in one breath

You **declare a collection as data** — a carrier type, an optional grade chain, and a few catalog rows — and you
**hand-author one floor engine** (an iterator that emits a fiber's elements in canonical order). Then you call
`base_realize()`, and the generator emits the entire public surface for you: the handle / fiber / element types and
`cardinality`, `elements`, `unrank`, `fibers`, `contains`, the `<@` / `@>` operators, `render()`, `next` / `prev`,
`random_element`, and more.

Everything downstream — the client, CLI, components, explorer — reads that generated surface plus the data-driven
catalog. You never write those functions by hand; you write the math, once.

::: tip The one required thing
Only the **ordered floor engine** (`fiber_elements`) is mandatory. Count, direct-index (`fiber_unrank`), and
membership (`contains_in_fiber`) are **opt-in accelerations** — absent them, the generator derives the same answers
by scanning the floor. Add them when you have a closed form; skip them otherwise.
:::

## The three moving parts

| Part | What it is | You write |
|------|-----------|-----------|
| **Carrier** | The composite (or scalar) type of a single element — the raw math object (a `word`, a `permutation`, a `numeric`). Shared across sibling collections. | A `CREATE TYPE` + a `notation()` renderer (unless the carrier already exists). |
| **Fiber** | `<coll>_fiber` — the typed grade address. One named `natural_number` axis per grade, or `(unit unit)` for an ungraded singleton. The collection **owns** it. | A `CREATE TYPE <coll>_fiber`. |
| **Floor engine** | The per-fiber iterator: given a fiber and a paging limit, emit its elements in canonical order. Optionally a count, a direct unrank, and a membership test. | `fiber_elements` (+ optional `fiber_count`, `fiber_unrank`, `contains_in_fiber`). |

A **handle** is a fiber (or a *range* of fibers) with each grade axis bound to a point or a sub-range — e.g.
`words(3, 2)` binds both axes to points, `words(1, 3)` binds `size` to the range `1..3`. The generator builds the
handle type from the fiber type automatically (each `natural_number` axis becomes a `natural_range`).

## Anatomy of a collection file

Each collection is one `sqlsrc/<name>.sql` file. Order on disk is irrelevant — files apply in dependency order
driven by the `-- requires:` header (`sqlsrc-order.ts` toposorts them). The skeleton:

```sql
-- requires: realizer, utilities            -- (+ any carrier/predicate files you reuse)
-- <name> — a one-paragraph description: what the elements are, the count sequence, the canonical order.

-- ── carrier ──
CREATE TYPE <carrier> AS (...);             -- skip if reusing an existing carrier
CREATE FUNCTION notation(c <carrier>) RETURNS text ...;   -- the canonical text form

-- ── fiber + floor engine ──
CREATE TYPE <name>_fiber AS (<axis> natural_number, ...);
CREATE FUNCTION fiber_elements(f <name>_fiber, element_limit int) RETURNS SETOF <carrier> ...;   -- REQUIRED
CREATE FUNCTION fiber_count(f <name>_fiber) RETURNS numeric ...;               -- optional accel
CREATE FUNCTION contains_in_fiber(f <name>_fiber, v <carrier>) RETURNS boolean ...;   -- optional
CREATE FUNCTION fiber_unrank(f <name>_fiber, rank rank_index) RETURNS <carrier> ...;  -- optional accel

-- ── declare as DATA + realize ──
INSERT INTO base_collection VALUES ('<name>', '<carrier>');
INSERT INTO base_grade VALUES ('<name>', 1, '<axis>', <lo_expr>, <hi_expr>), ...;
CREATE FUNCTION fiber_symbol(f <name>_fiber) RETURNS text ...;   -- optional ambient-set symbol
SELECT base_realize('<name>');

-- ── living examples ──
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES ...;
```

### The carrier

A `CREATE TYPE` composite wrapping the element's data, plus a `notation()` that renders it to its canonical text.
`base_realize` registers a `::text` cast from that `notation()`, so `value::text` becomes the canonical form
everywhere. If a suitable carrier already exists (`permutation`, `composition`, `binary_word`, plain `numeric`, …),
reuse it — the carrier is shared by all its sibling collections, and its `notation`, glyphs, maps, and stats come
along for free.

### The fiber and the grade chain

Grades form a fixed **chain**. Each `base_grade` row names an axis and gives optional `lo_expr` / `hi_expr`
bounds, written over the *earlier* axes by positional placeholder (`g1` = the pos-1 axis). A handle left unbound
on an axis unfolds it over `[lo, hi]`:

```sql
INSERT INTO base_grade VALUES
  ('words', 1, 'size', NULL, NULL),      -- size: unbounded
  ('words', 2, 'base', '1', 'g1');       -- base: ranges 1..size (g1 = size)
```

So `words(4)` unfolds `base = 1..4`; `words(4, 2)` binds the single rankable fiber `[size=4, base=2]`. An
**ungraded** collection (an infinite number set, a single family) has no `base_grade` rows and a
`(unit unit)` fiber — exactly one fiber, addressed by the empty array.

### The floor engine

`fiber_elements(f, element_limit)` is the heart: emit the fiber's elements **in canonical (rank) order**, capped at
`element_limit` (a paging limit, not the fiber's size). Emission order *is* the within-fiber rank, so `ordinality`
is just the row number. This is the only function you must write.

The three optional accelerations, each keyed on the same fiber type:

- **`fiber_count(f)` → `numeric`** — the fiber's cardinality by closed form. Absent, the generator counts the
  floor (finite) or returns `∞` (a collection declared `unbounded`). Present, `cardinality()` is O(1).
- **`fiber_unrank(f, rank)` → `<carrier>`** — the rank-th element *directly*, no scan. Present, the generator emits
  `element_at`, `random_element`, `range`/`unfold`, and fast `next`/`prev`. This is the `indexable` capability.
- **`contains_in_fiber(f, v)` → `boolean`** — membership by predicate. Present, the generator emits
  `contains(handle, v)`, `member_of`, and the `v <@ coll` / `coll @> v` operators.

### `fiber_symbol` and realize

Optionally define `fiber_symbol(<coll>_fiber)` → the ambient set's symbol (`[2]³`, `S₄`, `C(5,3)`). If present,
`base_realize` wires the membership notation `"<element> ∈ <symbol>"` via `wire_set_notation`. Then:

```sql
SELECT base_realize('words');
```

That single call reads `base_collection` + `base_grade` + your floor engine and generates the full surface.

## What `base_realize` emits

From the fiber type and whichever engine functions you provided, the generator creates:

- **Types** — `<coll>` (the handle, one `natural_range` per axis), `<coll>_element` = `(fiber, rank, value)`.
- **Constructors** — `<coll>(g1, g2, …)` (each axis a point *or*, left NULL, its full range); a `(lo, hi)`
  range constructor for a single-axis collection; and readable `::text` casts (`words(size=4, base=2)`).
- **Fibers & addressing** — `fibers(handle)`, `fiber_address` (the ω-ordinal address), `address`, `next`/`prev`
  over fibers (a generic, data-driven grade odometer — no per-collection code).
- **Enumeration** — `elements(fiber)` and `elements(handle)` (globally ordered by fiber address then rank),
  `unrank(handle, r)`, `ordinality`, `omega_ordinality`.
- **Counting** — `cardinality(fiber)` and `cardinality(handle)` (accel if present, else scan, else `∞`).
- **Direct access** *(iff `fiber_unrank`)* — `element_at`, `random_element`, `range`/`unfold`, fast
  `next_in_fiber`/`prev_in_fiber` and global `next`/`prev`.
- **Membership** *(iff `contains_in_fiber`)* — `contains(handle, v)`, `member_of`, `<@`, `@>`.
- **Rendering** — `render(element)`, `render_value`, and the `notation`-derived `::text` cast; set-builder and
  eval notations where the carrier supports them.
- **Materialization** — `carriers(handle)` / `unnest(handle)` for a finite, closed handle.

## Worked example: `words`

The `words` collection — all length-`size` tuples over an alphabet of `base` letters (the mixed-radix numerals) —
is a complete, self-contained collection that exercises every optional accel. Here is the whole file, in order.

**Carrier.** A word is a 1-based letter array; its notation is the comma-joined letters:

```sql
-- requires: realizer, utilities
CREATE TYPE word AS (letters int[]);                                  -- 1-based letters; {1,1,2} over base>=2
CREATE FUNCTION notation(w word) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT array_to_string((w).letters, ',') $$;
```

**Fiber + floor.** Two axes, `size` then `base`. The floor builds words letter-by-letter (each letter in
`[1, base]`) and emits them in lexicographic order:

```sql
CREATE TYPE words_fiber AS (size natural_number, base natural_number);   -- typed fiber; axes: size, base
CREATE FUNCTION fiber_elements(f words_fiber, element_limit int) RETURNS SETOF word LANGUAGE sql STABLE AS $$
  WITH RECURSIVE build AS (
    SELECT ARRAY[]::int[] AS letters, (f).size::int AS remaining
    UNION ALL
    SELECT letters || a, remaining - 1
      FROM build, LATERAL generate_series(1, (f).base::int) a
     WHERE remaining > 0
  )
  SELECT ROW(letters)::word FROM build
   WHERE remaining = 0
   ORDER BY letters
   LIMIT element_limit $$;
```

**Accelerations.** Count is `base^size` (exact); membership checks length and letter bounds; direct unrank reads
`rank` as a `size`-digit base-`base` numeral (each digit lifted to a 1-based letter):

```sql
CREATE FUNCTION fiber_count(f words_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT pow_int((f).base::int, (f).size::int) $$;                    -- base^size (exact; 0^0 = 1, the empty word)
CREATE FUNCTION contains_in_fiber(f words_fiber, v word) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((v).letters, 1), 0) = (f).size::int
     AND coalesce((SELECT bool_and(l BETWEEN 1 AND (f).base::int) FROM unnest((v).letters) l), true) $$;
CREATE FUNCTION fiber_unrank(f words_fiber, rank rank_index) RETURNS word LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(ARRAY(
    SELECT (1 + (rank / pow_int((f).base::int, i)::bigint) % (f).base::int)::int
      FROM generate_series((f).size::int - 1, 0, -1) i))::word $$;
```

**Declare + realize.** Two grade rows (`base` defaults to `1..size`), an ambient-set symbol, then `base_realize`:

```sql
INSERT INTO base_collection VALUES ('words', 'word');
INSERT INTO base_grade VALUES
  ('words', 1, 'size', NULL, NULL),
  ('words', 2, 'base', '1', 'g1');                                    -- base ranges 1..size by default
CREATE FUNCTION fiber_symbol(f words_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT '[' || (f).base::int || ']' || to_unicode_superscript((f).size) $$;
SELECT base_realize('words');
```

That is the whole collection. The generator now answers, with no further code:

```sql
SELECT cardinality(words(4, 3));                            -- 81 = 3^4 (accel)
SELECT notation((unrank(words(2, 2), 2)).value);           -- '2,1' (rank 2 in lex order)
SELECT ROW(ARRAY[1,0,1])::binary_word <@ binary_words(3);  -- membership via the operator
```

## Deriving a collection by restriction

Most collections are not built from scratch — they **restrict** an existing one by a predicate. `base_restrict`
records the parent edge, shares the parent's carrier and grade chain, filters the parent's floor (the realizer
re-ranks the survivors), and sets `contains` = parent-contains **and** the predicate. You write only the predicate:

```sql
-- fib_strings — binary words with no two consecutive 1s. A restriction of binary_words.
CREATE FUNCTION is_fib_string(w binary_word) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT NOT EXISTS (SELECT 1 FROM generate_series(1, coalesce(array_length((w).bits,1),0) - 1) i
                     WHERE (w).bits[i] = 1 AND (w).bits[i+1] = 1) $$;
SELECT base_restrict('fib_strings', 'binary_words', 'is_fib_string');
CREATE FUNCTION fiber_symbol(f fib_strings_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT 'Fib(' || (f).n::int || ')' $$;
SELECT wire_set_notation('fib_strings');   -- the child's fiber type exists only AFTER restrict
```

Note the child's fiber type is created *by* `base_restrict`, so a `fiber_symbol` for it is defined **after** the
restrict call, followed by an explicit `wire_set_notation`. For an **unbounded** parent (an infinite floor like
`natural_numbers`, which has no `fiber_count`), pass a `scan_factor` — the child over-scans the parent's floor to
`element_limit * scan_factor` and filters that window, so the predicate's density must survive the bound.

`base_restrict` records the family tree in `base_collection_parent` (closed transitively by
`base_collection_ancestry`), so the specialization is itself queryable data.

## Membership without a predicate

Some floors are sequences where a hand-written membership test is awkward. Two opt-in markers let `base_realize`
synthesize `contains_in_fiber` from `fiber_unrank` — declare them **before** `base_realize`:

- **`base_monotonic_sequence`** — the floor is non-decreasing, so the generator scans terms until one meets the
  value (∈) or passes it (∉). Used by `catalan_numbers`, `fibonacci`, and friends.
- **`base_bounded_membership(collection, value_ceiling, scan_terms)`** — a non-monotonic sequence whose membership
  is only semi-decidable: a bounded scan answers `true` on a hit, `false` for values `≤ value_ceiling`, and `NULL`
  (unknown) above it. Never a false negative.

A collection where membership is genuinely *not a question* (an internal descriptor catalog) declares
`base_no_membership(collection, reason)` — documentary, and a guard so nothing is synthesized.

## Metadata and living examples

Two more pieces, both pure data:

- **Title + description.** Add a row to the `collection-meta.sql` seed (→ `base_collection_meta`, surfaced by
  `base_catalog`). Kept out of the per-collection file so ids stay the source of truth for identity:

  ```sql
  ('words', 'Words', 'Length-n tuples over a b-letter alphabet — the mixed-radix numerals.'),
  ```

- **Examples that double as tests.** Every collection file ends with `base_example` rows — a `suite` (equal to the
  collection id by convention, which links the example as a catalog facet), a `title`, `expected`, and the `sql`.
  `kind = 'eq'` asserts the query returns `expected`; `kind = 'ok'` asserts it merely runs. These are the
  living regression suite *and* the documentation:

  ```sql
  INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
    ('words','words of length 4 over base 3 (anchor)','eq','81','3^4 via the accel',$q$
      SELECT cardinality(words(4,3))::text $q$),
    ('words','words(2,2) enumerated in lex order','eq','1,1,1,2,2,1,2,2','the realized floor for fiber [2,2]',$q$
      SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(words(2,2)) e $q$);
  ```

Write anchor counts (a known count sequence for several small parameters), a small enumeration in canonical order,
a `contains` / `<@` case, and an `unrank` case. These pin the behavior and demonstrate the collection at once.

Optional registries layer on the same way — one row each: `base_stat` (a per-element statistic), `base_repr` (an
alternate rendering), `base_map` (a morphism to another collection), `base_glyph` (an SVG figure kind). All are data.

## Verifying

The example suite *is* the test suite. Apply the whole core into a bare PGlite and run every example:

```bash
cd packages/data
node --import tsx run.mts
```

While iterating on a single new file, apply it last in a rolled-back transaction on top of the built core:

```bash
node --import tsx run.mts sqlsrc/words.sql
```

From the repo root, `pnpm test:core` runs the same suite; `pnpm test` also typechecks the stack and builds the
explorer + docs. A green example run means the collection realizes cleanly and every asserted value holds.

## Checklist

1. Pick or write the **carrier** (+ `notation`). Reuse an existing one when you can.
2. Define the **`<coll>_fiber`** type and the **`base_grade`** chain (or none, for an ungraded singleton).
3. Write **`fiber_elements`** (required) in canonical order.
4. Add whatever accels you have: **`fiber_count`**, **`fiber_unrank`**, **`contains_in_fiber`** — or a membership
   marker (`base_monotonic_sequence` / `base_bounded_membership`).
5. `INSERT INTO base_collection`, add the grade rows, optionally define **`fiber_symbol`**, then
   **`SELECT base_realize('<name>')`** — or, for a derived collection, **`SELECT base_restrict(...)`**.
6. Add a **`collection-meta.sql`** row and a handful of **`base_example`** assertions.
7. Set the **`-- requires:`** header to the files you depend on (`realizer` always; plus carrier/predicate files).
8. Run `node --import tsx run.mts` until green.

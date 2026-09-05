# enumeratio-cli

Enumerate a combinatorial collection from the terminal and stream its elements to stdout. A thin driver over
[`enumeratio-client`](../enumeratio-client) — so it doubles as an end-to-end check of the whole node stack
(pglite WASM → SQL engine) and hosts the sage oracle tests.

```
enumeratio <collection> [arg=value ...] [options]
```

Output **streams** in rank windows with backpressure, so pipes just work — `enumeratio permutations size=8 | head`
needs no limit. Enumeration runs pglite in-process; to cap a runaway, Ctrl-C or wrap with the shell `timeout`.

## Enumerating

```bash
enumeratio permutations size=4                 # one element per line, canonical order
enumeratio set_partitions size=6 parts_count=3 # a grade arg fixes a secondary axis
enumeratio permutations size=8 | head          # streams; pipe-friendly
enumeratio integer_partitions size=20 --count  # just |collection(...)|  ->  627
```

An argument is `name=value`: `size=N` is the primary dimension, any other key is a grade axis bound to a value.
Nothing is required — an infinite collection simply streams until the reader stops.

## Discovering what's there

`list` enumerates the realized collections; `list <collection>` shows one collection's catalog shape:

```bash
enumeratio list
enumeratio list set_partitions
```

```
set_partitions
  axes     size, parts_count, largest_block_size, singletons_count
  fibers   [size]  [size, parts_count]
  stats    largest_block_size, parts_count, singletons_count, size
  reprs    parts*
```

`table` shows every collection at once as an aligned grid — axes plus counts for fibers / stats / reprs / maps,
and the OEIS id:

```bash
enumeratio table
```

```
collection            title                 axes                                    fibers  stats  reprs  maps  oeis
────────────────────  ────────────────────  ──────────────────────────────────────  ──────  ─────  ─────  ────  ───────
arrangements          Arrangements          size, length                                 2      2      1     2  A000522
integer_partitions    Integer Partitions    size, parts_count, distinct_parts_count…     2      4      1     1  A000041
permutations          Permutations          size, inversions_count, cycles_count…        3      6      2     8  A000142
…
```

## Statistics & projection

`--stats` projects every statistic as TSV columns (with a header); `--json` emits newline-delimited JSON:

```bash
enumeratio subsets size=5 --stats
enumeratio permutations size=4 --json --range 0:3
```

`--fields` limits the projection to the named stat ids — **the DB computes only those columns**. It implies
`--stats`, so you don't need both:

```bash
# only the two stats you asked for
enumeratio permutations size=4 --fields inversions_count,descents_count
```

```
#	element	inversions_count	descents_count
0	1,2,3,4	0	0
1	1,2,4,3	1	1
2	1,3,2,4	1	1
…
```

```bash
enumeratio permutations size=5 --fields cycles_count --json --range 0:100
```

An unknown field errors with the available list. The stat ids come from `list <collection>` (the `stats` line).

## Representations

Serialize elements in a named representation / format / medium, and relabel the atoms with a named alphabet:

```bash
enumeratio permutations size=4 --repr cycle                       # (1)(2)(3)(4), (1)(2)(3 4), …
enumeratio words size=3 base=2 --repr letters --format digits --alphabet binary
```

- `-R, --repr NAME` — a named representation (see the `reprs` line of `list <collection>`)
- `-F, --format NAME` — a format of that repr (its canonical one by default)
- `-M, --medium NAME` — `ascii` (default), `unicode`, or `latex`
- `-A, --alphabet NAME` — a named alphabet (`latin`, `greek`, `binary`, `suits`, `numeric`)

## Slicing

`--range` takes a rank window over the canonical sort:

```bash
enumeratio permutations size=5 --range 0:3   # ranks [0, 3)
enumeratio permutations size=5 --range 100:  # rank 100 to the end
enumeratio permutations size=5 --range :10   # first 10
enumeratio permutations size=5 --range 7     # the single element at rank 7
```

## Cross-checking

`examples` prints verified constructions spelled three ways — for this CLI, the client, and sage:

```bash
enumeratio examples                # every case
enumeratio examples permutations   # just one collection
```

```
permutations(size: 5)
  enumeratio  permutations size=5
  client      permutations({ size: 5 })
  sage        Permutations(5)
```

## Options

| Option | |
| --- | --- |
| `-c, --count` | print `\|collection(...)\|` and exit |
| `-s, --stats` | project every statistic as TSV columns (with a header) |
| `--json` | project as newline-delimited JSON |
| `--fields A,B,…` | project only the named stat ids (implies `--stats`) |
| `-r, --range A:B` | ranks `[A, B)`; `A:` to the end, `:B` from 0, `A` a single element |
| `-R, --repr` / `-F, --format` / `-M, --medium` / `-A, --alphabet` | the rendering axes (see above) |
| `-h, --help` | usage |

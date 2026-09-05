# @enumeratio/cli

Enumerate a combinatorial collection from the terminal and stream its elements to stdout — a thin driver over
[`enumeratio-client`](/develop/packages/client/) (the pure-SQL core in PGlite), and the home of the sage oracle tests.

```bash
enumeratio permutations size=4                  # one element per line, canonical order
enumeratio arrangements size=5 length=2         # a chain grade fixes a secondary axis
enumeratio permutations size=8 | head           # streams with backpressure — pipe-friendly
enumeratio integer_partitions size=20 --count   # just |collection(...)|  ->  627
```

Prefer to poke at it without installing? The [Playground](/develop/packages/cli/playground) runs this same grammar against an
in-browser database, with clickable examples.

An argument is `name=value`: `size=N` is the primary dimension, any other key names a grade in the collection's
chain (`arrangements`' `length`, `words`' `base`, `subsets`' `k`). Output **streams** in rank windows, so pipes
just work with no limit; enumeration runs PGlite in-process (Ctrl-C, or wrap with the shell `timeout`, to cap a runaway).

## Discovering what's there

```bash
enumeratio list                 # the realized collections
enumeratio list set_partitions  # one collection's catalog shape (axes, stats, reprs)
enumeratio table                # every collection at once, as an aligned grid
```

## Distributions and triangles

`-g <stat>` gives a statistic's distribution (count per value, plus a total/mode/mean summary); `--triangle <stat>`
splits that distribution per fiber, so a size range prints the classic combinatorial triangle:

```bash
enumeratio permutations size=4 -g inversions          # the Mahonian distribution + summary
enumeratio permutations size=1:6 --triangle inversions # the Mahonian triangle over sizes 1..6
enumeratio set_partitions size=1:5 --triangle blocks   # Stirling of the second kind
```

## Maps and composition

`maps` shows the map graph — every map as a `source → codomain` edge — and `-m`/`--through` apply maps to the
elements you enumerate. `--through` **composes** a chain across collections (each map's codomain feeds the next):

```bash
enumeratio maps                                        # the whole map graph
enumeratio maps permutations                           # just the edges out of permutations
enumeratio permutations size=3 -m to_lehmer_code,descent_set  # each map's image as a column
enumeratio permutations size=3 --through rsk_insertion,shape  # permutation → RSK tableau → its shape
```

`--at ADDR` inspects a single element — a rank, or an `@serialization` — as a card of its rank, every statistic,
and every map image:

```bash
enumeratio permutations size=4 --at @2413   # 2413's inversions, cycle type, RSK tableau, Lehmer code, …
```

Other options: `--range lo:hi` slices the canonical order, `--repr <name>` picks an alternate rendering,
`--count` / `--stats` / `--json` / `--fields A,B` shape the output. The [explorer](/explore/collection/) is the same client
behind a UI.

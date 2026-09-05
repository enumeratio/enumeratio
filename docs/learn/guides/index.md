# Start here

A guided walk through the kinds of objects enumeratio counts, ranks, and draws — no combinatorics background
assumed. Everything below runs live, right in this page: there's a real database in your browser, and every
example is a real query against it, not a screenshot.

## What a collection is

Take **"the permutations of size 4"** — every way to arrange the numbers 1–4 in a row. That's a **collection**:
a fixed, numbered list of mathematical objects. Three ideas do all the work:

- **element** — one member of the list. `2413` (read the digits left to right) is one permutation of size 4.
- **rank** — an element's position in a fixed order, counting from 0. Ranks let you *address* an element instead
  of describing it.
- **notation** — how an element is written out. `2413` is a permutation's notation; other collections render
  differently (a partition of 6 might print as `4+2`).

Here it is live — the element at each rank, 0 through 3, of `permutations(4)`:

```html
<enumeratio-notation collection="permutations" n="4" rank="0"></enumeratio-notation>
```

<p>
rank 0 = <enumeratio-notation collection="permutations" n="4" rank="0"></enumeratio-notation> &nbsp;·&nbsp;
rank 1 = <enumeratio-notation collection="permutations" n="4" rank="1"></enumeratio-notation> &nbsp;·&nbsp;
rank 2 = <enumeratio-notation collection="permutations" n="4" rank="2"></enumeratio-notation> &nbsp;·&nbsp;
rank 3 = <enumeratio-notation collection="permutations" n="4" rank="3"></enumeratio-notation>
</p>

Some collections also have a **figure** — a picture of the element, drawn straight from the same database.
Permutations draw as a grid marking, for each position, which value sits there:

<p>
<enumeratio-figure collection="permutations" n="4" rank="0"></enumeratio-figure>
<enumeratio-figure collection="permutations" n="4" rank="1"></enumeratio-figure>
<enumeratio-figure collection="permutations" n="4" rank="21"></enumeratio-figure>
</p>

And every collection has a **cardinality** — how many elements it holds in total. `permutations(4)` has
$4! = 24$ of them (check it yourself: `enumeratio permutations size=4 --count` on the [CLI](/develop/packages/cli/), or
open it in the [explorer](/explore/collection/permutations) and read the count off the header). That's the whole
vocabulary — element, rank, notation, figure, cardinality — and it's the *same* five ideas for every collection
in the library, whatever the objects are.

## A taste of the library

<ClientOnly>
  <LiveCollections />
</ClientOnly>

Click any chip to jump straight into its explorer page. There's a lot here — this tour covers six families in
depth; [Where next](/learn/guides/where-next) maps the rest.

## Not just lists — some collections carry algebra

A few collections are also *rings or fields*: their elements support `+`, `−`, `·`. `<enumeratio-expression>`
evaluates an expression in a carrier's own algebra — edit it:

<p>
<enumeratio-expression collection="rational_numbers" expr="1/2 + 1/3"></enumeratio-expression>
</p>

That's a side road — the [expression page](/develop/packages/components/expression) has the full tour of it (ordinals,
cardinals, Gaussian integers, modular arithmetic). This tour stays on the combinatorial side: objects you count,
rank, and draw, not compute with.

## The chapters

1. **[Permutations](/learn/guides/permutations)** — arrangements, restrictions like derangements and involutions, and a
   first statistic.
2. **[Subsets & partitions](/learn/guides/subsets-and-partitions)** — the same $n$ objects, sliced four different ways.
3. **[Words & compositions](/learn/guides/words-and-compositions)** — strings and ordered sums, and the idea of a
   *bijection* made concrete.
4. **[Stars and bars](/learn/guides/stars-and-bars)** — one classic counting trick, and the collection it counts.
5. **[Lattice paths & trees](/learn/guides/lattice-paths-and-trees)** — Dyck paths, binary trees, and the Catalan
   numbers that count them both.
6. **[Where next](/learn/guides/where-next)** — the map back out to the full atlas, the deep math essays, and the rest
   of the tooling.

Read them in order — each one is short, and they build on each other. Or skip around; every chapter stands on
its own with links back to whatever it leans on. For the bigger argument behind why the library is built this
way at all, see [the vision](/develop/).

## Beyond the tour

**[Explorations](/learn/explorations/)** — deep-dive essays for a reader who already has the tour's vocabulary:
polytopes, Young tableaux, set partitions, bijections, and the library's connections to computer science and
number theory. Read more like workbooks than a linear tour — each stands alone; [Where
next](/learn/guides/where-next) walks through all six.

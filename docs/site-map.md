# enumeratio.dev: the site map

> **Draft 2, 2026-11-20.** Nothing here is built; the map is iterated before anything is. Changes from draft 1 follow its review: singular PascalCase names, one `/collection/` area, parameters inside the collection's own segment, an element's address always in the same position, rank addresses behind `@`, properties and substructure as a path after the element, `/input/` in place of expression redirects.
>
> Decided (2026-11-20): a new repository (`enumeratio/enumeratio`); a clean slate at enumeratio.dev; every implementation in Epsil on compute-engine, drawn with notatio; the earlier codebases are mined, not revived; no npm publishing yet.

enumeratio.dev is the home of individual mathematical objects: one address per object, meant to last. It is about the mathematics and is agnostic about what computes it. notatio.app is the notebook over compute-engine and Epsil.

Earlier work this draws on: the precursor project (its route map, its address telescope, its separator conventions), the archived SQL project (its routing design, 280 collections, the explorer), and notatio's records (89 carriers, 245 collections, about 1,400 statistics and 200 maps).

## 1. Rules

1. **Every path is read the same way.** Position decides meaning, and no level is ever skipped because of what came before. This was the main lesson of the earlier projects.
2. **A path names an object; the query string configures the view of it; a fragment points into the page.** Two URLs with the same path are the same object. Nothing that changes *which* object is meant ever goes in the query string or the fragment.
3. **One canonical spelling**, and liberal reading: other spellings resolve and redirect to it (§5).
4. **Names are the code's names.** A collection, a statistic, a map or a property is written in PascalCase exactly as its head is written in Epsil, singular. The first segment of a path is a lowercase word.
5. **Published means permanent** (§6).

## 2. Grammar

```
/collection/<Collection>/<element>/<Property>/<Property>…
     1           2           3          4 and on
```

| Position | What it is | Examples |
| --- | --- | --- |
| 1 | The area: a lowercase word from a short closed list (§3). | `collection`, `stat`, `map` |
| 2 | A collection, with any parameters bound inside the segment. | `DyckPath`, `DyckPath;n=4`, `SetPartition;n=4;blocks=2` |
| 3 | One element of it, by value or by rank. | `11010010`, `@7`, `@lex:7` |
| 4… | A chain of properties, each applied to the result of the one before. | `Area`, `Blocks/2`, `Numeral;base=60` |

Every prefix is a page: `/collection`, `/collection/DyckPath`, `/collection/DyckPath;n=4`, `/collection/DyckPath/11010010`, `/collection/DyckPath/11010010/Area`.

### 2.1 The collection segment

`Name` then zero or more `;parameter=value`, the parameter names being the collection's declared ones.

- **Named, not positional.** `SetPartition;n=4;blocks=2`, not `SetPartition_4,2`. A name is self-describing; any subset of the parameters can be bound (`;blocks=2` alone is every set partition into two blocks); and a collection can gain a parameter later without changing the meaning of any existing URL. Positional forms cannot do the last two, and the last one matters most for permanence.
- **A bound parameter is a restriction like any other.** `DyckPath;n=4` is the sub-collection of size 4. Parameters are not only grades: `PrimePair;gap=2`, `PolygonalNumber;sides=5`, `Residue;modulus=12`, `QuadraticInteger;d=-5`, `TorusKnot;p=2;q=3`.
- **Canonical order** is the declared order of the parameters; any order is read.
- **Only point values go in the path.** A range or a grouped parameter is a view over many sub-collections, so it is query string: `/collection/KSubset;n=5?group_by=k` is a row of Pascal's triangle. (The archived project reached the same split.)
- This is the matrix-parameter form (RFC 3986 §3.3 leaves `;` and `=` to the scheme for exactly this), and it is where the archived explorer ended up. `~` and `_` were tried before it.

### 2.2 The element segment

Always position 3, always one segment, one of two forms:

- **By value**: the element written in its canonical form. `11010010`, `2_1_4_3`, `1,3`, `5040`, `3+2i`, `3_1`.
- **By rank**: `@7` is the element at position 7 in the collection's default order, `@lex:7` in a named order. The collection segment says which collection the rank is in, so a rank address is only as stable as the parameters bound there.

A value may carry the name of its notation in front, `cycle:(1_2)(3_4)`, when it is not written in the collection's default notation.

**An element's canonical address is in its unrestricted collection.** `/collection/DyckPath/11010010` is the object. `/collection/DyckPath;n=4/11010010` is the same object seen inside a sub-collection: it resolves only if the element belongs there, shows it in that context (its rank there, its neighbours), and names the first as canonical. The same holds for a named sub-collection: `/collection/TwinPrime/17` and `/collection/Prime/17` are views of `/collection/Natural/17`. A rank address redirects to the value address.

### 2.3 Properties and substructure

After the element, each segment is a property applied to what the path has reached so far. A property is anything the collection declares on its elements:

| Kind | Example | Result |
| --- | --- | --- |
| a statistic | `/collection/DyckPath/11010010/Area` | a number: the fact "the area of this path is 2" as a resource |
| a part | `/collection/SetPartition/1,3!2!4/Blocks` | the blocks, in order |
| an index into a result | `/collection/SetPartition/1,3!2!4/Blocks/2` | the second block |
| a map | `/collection/Permutation/3_1_4_2/Inverse` | an element of another collection; the page shows it and links to its own address |
| a representation | `/collection/Natural/3811/Numeral;base=60` | 3811 written in base 60 |
| a derived object | `/collection/Natural/360/Factorization` | 2³·3²·5 as an element of `IntegerFactorization` |

- A property takes parameters the same way a collection does: `Numeral;base=60`.
- An integer segment after a list-valued result indexes it, from 1.
- A chain can continue through a map: `…/Permutation/3_1_4_2/Inverse/CycleType`. This is how one reads through a map into another collection.
- This is `At(Blocks(x), 2)` and `CycleType(Inverse(x))` in Epsil, read left to right.

**Substructure is a path, not a fragment.** A fragment is never sent to the server and cannot be cited as an object. Fragments are for places in a page (`#Area`, an example's id).

### 2.4 The query string

Only the view: which properties a page shows and in what order (`?show=Area,Bounce,Peaks`), which notation or figure (`?as=cycle`), sorting, filtering and grouping of a collection's table (`?order_by=Area&where=Peaks>2&group_by=Height`), the window into a large collection. Each kind of object has its own defaults (a natural number leads with its factorization, a knot with its diagram and its prime decomposition, a permutation with its one-line form and cycles); the query string is how a reader changes them, and a configured view is a shareable URL.

### 2.5 Writing an element

One set of separators for every collection, each with one meaning (the precursor's convention, with one change):

| Mark | Meaning | Example |
| --- | --- | --- |
| `,` | members where order does not matter | a subset `1,3`; the members of a block |
| `_` | items in order | a permutation `2_1_4_3`; a signed one `1_-3_2`; a knot `3_1` |
| `!` | between blocks or rows | a set partition `1,3!2!4`; a matrix `1_2!3_4` |
| `-` | a negative sign, nothing else | `-3` |
| `.` | a decimal point, nothing else | `3.25` |
| `:` | names a notation or an order | `cycle:…`, `@lex:7` |
| `/` inside a value | never | a fraction is `22_7` under `Rational`, or its own notation |

- **The change: `_` for ordered items where the precursor used `'`.** An apostrophe is legal in a URL, but phones and word processors turn it into a curly quote, shells and code need it escaped, and some linkifiers stop at it. For an address meant to be pasted and cited, that is too fragile. `'` is still read.
- **Short form.** Where every item is a single digit, the items may be run together: `2143` for `2_1_4_3`. It is read only for collections where it cannot be mistaken for something else (a permutation, a word over digits), never where a multi-digit item is possible on its own (an integer partition: is `421` three parts or one?). The separated form is canonical.
- `;` is left to parameters. Continued fractions and matrices, which are traditionally written with it, use `!`.

## 3. Areas

| Path | What it is |
| --- | --- |
| `/collection/…` | Every object (§2). Numbers, numerals, structures, sequences as sets, knots, polytopes, groups and algebras are all collections. |
| `/stat/<Name>` | A statistic as a concept: its definition, the collections it is defined on, its FindStat identity. `/stat/Area/DyckPath;n=4` narrows it to a collection: its distribution there. `/stat/St000012` redirects to the name. |
| `/map/<Name>` | A map as a concept: source, target, what it preserves. `/map/Mp00023` redirects. |
| `/sequence/<A-number>` | An OEIS number, redirecting to the collection or statistic that realizes it. |
| `/input/<expression>` | Evaluates an Epsil expression. If the result is a catalogued object the page says so and links to its address; it does not redirect. |
| `/atlas` | The whole route space, generated from the route file (§6), with each route's status. |
| `/about`, `/contribute` | What the site is; how to suggest or reserve a route. |

The value of a statistic on an element has one address, under the element: `/stat/Inversions/Permutation/1_3_2_5_4` redirects to `/collection/Permutation/1_3_2_5_4/Inversions`.

There are no areas by discipline. If an area is ever added it is one more lowercase word in this table.

## 4. What is in `/collection/`

● data exists in notatio today · ◐ only in the earlier projects · ○ new.

**Numbers.** `Natural`, `Integer`, `Rational`, `Fraction`, `GaussianInteger`, `GaussianRational`, `QuadraticInteger;d=`, `AlgebraicInteger`, `Residue;modulus=`, `AdicInteger;p=`, `ProfiniteInteger`, `Adele`, `ContinuedFraction`, `EgyptianFraction`, `Quaternion`, `Multicomplex` ●; `EisensteinInteger` ○; `Ordinal`, `Cardinal`, `Float` ◐.

**Numbers by what they are made of.** `Natural/360/Factorization` leads to `IntegerFactorization`, where a number is its primes and their exponents. The named sets of integers are then conditions on the exponents, and each is a sub-collection of `Natural` whose page states that condition: `Prime` (one exponent, equal to 1), `PrimePower` (one exponent), `Semiprime`, `Squarefree` (exponents 0 or 1), `Square` (all even), `KFree;k=`, `Powerful`, `Sphenic`, `Smooth;bound=`, `Rough;bound=`; a `Rational` is the same with integer exponents. `TwinPrime` is `PrimePair;gap=2`. About 60 more by divisors, digits and recurrences (`Perfect`, `Abundant`, `Carmichael`, `Harshad`, `Kaprekar`, `Fibonacci`, `Catalan`, `Polygonal;sides=`, …) ●.

**Numerals.** A numeral is reached two ways. As a property of a number: `Natural/3811/Numeral;base=60`. As an object in its own right, a string of digits: `PositionalNumeral;base=60/1_3_31`. Systems: positional, balanced, bijective, negative base, mixed radix (`;radices=2,3,5`), factorial, primorial, residue (`;moduli=3,5,7`), Zeckendorf, Ostrowski, combinatorial, Roman, hypernumerary, adic ●; complex bases, Witt ◐.

**Combinatorial structures** ● (74 object types): `Word`, `Arrangement`, `Subset`, `KSubset`, `Multiset`, `SignedSubset`; `Permutation` and its kin (`Derangement`, `Involution`, `BaxterPermutation`, `PermutationAvoiding;pattern=231`, `SignedPermutation`, `ColoredPermutation`, `AffinePermutation`, …); `Endofunction`, `Surjection`, `ParkingFunction`; `IntegerPartition` and kin; `IntegerComposition` and kin; `SetPartition`, `SetComposition`, `PerfectMatching`; `BinaryWord`, `Necklace`, `LyndonWord`, `GrayCode`; `DyckPath`, `MotzkinPath`, `SchroederPath`, `DelannoyPath`; `BinaryTree`, `OrderedTree`, `LabeledTree`, `RootedForest`; `LabeledGraph`, `Tournament`, `Poset`; `StandardTableau`, `SemistandardTableau`, `GelfandTsetlinPattern`, `AlternatingSignMatrix`, `RookPlacement`; `CartanType`.

**Polytopes** ◐. A polytope is the collection of its faces: `Permutahedron;n=4` is the truncated octahedron, `Permutahedron;n=4;dimension=2` its 14 polygons, and a face's address is the structure that labels it, `Permutahedron;n=4/1,3!2!4`. `Associahedron`, `Cyclohedron`, `Simplex`, `CrossPolytope`, `Hypercube`. The property `Label` takes a face to that structure's own page (a set composition, a dissection, a subset, a signed subset). Which projection is drawn is a view.

**Knots.** `Knot/3_1` ○ (the table is new data), `Knot;crossings=7`, `TorusKnot;p=2;q=3`, `PretzelKnot`, `TwistKnot` ●, `Link` ○, `Braid;strands=3/1_-2_1_-2` ●. Properties: `JonesPolynomial`, `AlexanderPolynomial`, `Genus`, `Factorization` (into prime knots), `BraidWord`.

**Groups and algebras** ●. `SymmetricGroup;n=4` is a collection whose elements are permutations, so its element addresses are views of `Permutation` elements. `CyclicGroup`, `DihedralGroup`, `AlternatingGroup`, `BraidGroup`, `ModularGroup`; `PartitionAlgebra`, `BrauerAlgebra`, `TemperleyLiebAlgebra`, `HeckeAlgebra`, `IncidenceAlgebra`, `PathAlgebra`.

**Tables of numbers** ◐. Not a separate kind: a number triangle is a collection with two parameters viewed with one of them grouped (`KSubset;n=5?group_by=k`), and its entry is a count (`/collection/KSubset;n=5;k=2/…` has 10 members).

## 5. Reading other spellings

One function reduces a name to a key (drop `-` and `_`, lowercase), and one table per name lists its aliases. No rule per URL.

| Request | Canonical | How |
| --- | --- | --- |
| `/collections/…`, `/Collection/…` | `/collection/…` | the area is lowercased; a plural redirects |
| `/collection/dyck-path`, `dyck_path`, `dyckpath` | `/collection/DyckPath` | the key |
| `/collection/DyckPaths`, `dyck-paths` | `/collection/DyckPath` | plural: a default rule (a trailing `s`), with the exceptions listed on the collection's own record |
| `/collection/TwinPrimes`, an old name after a rename | the current name | alias on the record |
| `/collection/DyckPath;4`, `DyckPath_4`, `DyckPath(4)` | `/collection/DyckPath;n=4` | a bare value binds the first parameter |
| `/collection/Permutation/2'1'4'3`, `2,1,4,3`, `[2,1,4,3]`, `2143` | `…/2_1_4_3` | the collection's reader accepts the usual ways of writing an element |
| `/stat/St000012`, `/map/Mp00023`, `/sequence/A000108` | the named page | an outside identifier |

Names (positions 1, 2 and each property) are normalized this way. An element's value is read by its collection, since case and punctuation can carry meaning there.

## 6. The route file and the promise

One file in the repository lists every route. Each row: the pattern, what it is, the Epsil expression behind it, its aliases and outside identifiers, a status, who asked for it and when.

| Status | Meaning | Promise |
| --- | --- | --- |
| **proposed** | Suggested. Listed in the atlas, not served. | none |
| **reserved** | The name is held for a stated object, by a named person, until a date. Serves a short page saying so. | the name is not given to something else while the reservation runs |
| **stub** | Serves the definition and links, without live content. | permanent |
| **live** | The full page. | permanent |

- A reservation lapses after a year unless it is renewed or has become a stub; a lapsed row stays in the file, marked, so the history of a name is never lost.
- Suggesting or reserving a route is adding a row: a pull request, or an issue form that writes one.
- A row that has been `stub` or `live` is never deleted. A test fails the build when one neither resolves nor redirects. That test is the whole of what "permanent" means mechanically.
- A collection's row covers every sub-collection, element and property under it.

## 7. Pages

- **A collection**: its definition in a sentence and in Epsil, its parameters with a picker, its count for each size, its statistics and maps, its sub-collections and the collections it sits inside, a table of members for a bound size (the archived explorer's table: choose columns, filter, group, sort).
- **An element**: its figures and notations, the value of every statistic, its image under every map with a link, its neighbours in each order. What is shown first depends on the kind of object, and the query string changes it.
- **A property value**: the value, how it was computed, and the element it belongs to.
- **Computation happens in the page.** The site loads notatio's kernel, so an object renders and recomputes where it is. A link out to a notatio.app notebook is an extra, not the mechanism.
- Small sizes are built ahead of time; everything else is computed on arrival, so every valid address resolves even though there are infinitely many.

## 8. Still open

1. **`_` or `'` for ordered items** (§2.5). The draft argues for `_`; `'` is what the precursor used.
2. **Parameter names.** `n` everywhere for the main size, or the collection's own word (`semilength`, `vertices`)? The draft assumes the short declared name, `n`, with the long word as an alias.
3. **Where a restriction is a parameter and where it is a name.** `PermutationAvoiding;pattern=231` and `PrimePair;gap=2` read well as parameters; `Derangement` and `Involution` are names. A rule is needed for which a new one becomes.
4. **Family-level facts with no element** (the counting sequence of `DyckPath`, its generating function). The draft gives them no path of their own: they are on the collection's page. If they need addresses, position 3 needs a word for "no element", and that is a cost to rule 1.
5. **Sequences in their own right.** `/sequence/` is only OEIS aliases here. A sequence that is not the member list or the count of any collection has no home yet.
6. **Short form** (§2.5): worth having, or one more thing to get wrong?
7. **The first slice to build**, once the map is agreed.

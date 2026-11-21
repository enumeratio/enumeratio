# enumeratio.dev: the site map

> **Draft 3.4, 2026-11-21.** A first pass is being built from this draft (§9). The structure of an address (what each position means) is settled enough to build on; the exact characters (separators, parameter words) are provisional and are expected to change as the site is used. Nothing is promised permanent until the site is announced (§6).
>
> Decided (2026-11-20): a new repository (`enumeratio/enumeratio`); a clean slate at enumeratio.dev; every implementation in Epsil on compute-engine, drawn with notatio; the earlier codebases are mined, not revived; no npm publishing yet; a parameter is written with the collection's own word, with `n` read as an alias for its size.

enumeratio.dev is the home of individual mathematical objects: one address per object, meant to last. It is about the mathematics and is agnostic about what computes it. notatio.app is the notebook over compute-engine and Epsil.

Earlier work this draws on: the precursor project (its route map, its address telescope, its separator conventions), the archived SQL project (its routing design, 280 collections, the explorer), and notatio's records (89 carriers, 245 collections, about 1,400 statistics and 200 maps).

## 1. Rules

1. **Every path is read the same way.** Position decides meaning, and no level is ever skipped because of what came before. This was the main lesson of the earlier projects.
2. **A path names an object; the query string configures the view of it; a fragment points into the page.** Two URLs with the same path are the same object. Nothing that changes *which* object is meant ever goes in the query string or the fragment.
3. **One canonical spelling**, and liberal reading: other spellings resolve and redirect to it (§5).
4. **Names are the code's names.** A collection, a statistic, a map or a property is written in PascalCase exactly as its head is written in Epsil, singular. A collection's name is the noun for one member: `Prime`, `Derangement`, `PerfectNumber` (an adjective alone, `Perfect`, is an alias). The first segment of a path is a lowercase word.
5. **Published means permanent** (§6).

## 2. Grammar

```
/collection/<Collection>/<element>/<Property>/<Property>…
     1           2           3          4 and on
```

| Position | What it is | Examples |
| --- | --- | --- |
| 1 | The area: a lowercase word from a short closed list (§3). | `collection`, `stat`, `map` |
| 2 | A collection, with any parameters bound inside the segment. | `DyckPath`, `DyckPath;semilength=4`, `SetPartition;size=4;blocks=2` |
| 3 | One element of it, by value or by rank. | `11010010`, `@7`, `@lex:7` |
| 4… | A chain of properties, each applied to the result of the one before. | `Area`, `Blocks/2`, `IntegerDigits;base=60` |

Every prefix is a page: `/collection`, `/collection/DyckPath`, `/collection/DyckPath;semilength=4`, `/collection/DyckPath/11010010`, `/collection/DyckPath/11010010/Area`.

### 2.1 The collection segment

`Name` then zero or more `;parameter=value`.

- **Named, not positional.** `SetPartition;size=4;blocks=2`, not `SetPartition_4,2`. A name is self-describing; any subset of the parameters can be bound (`;blocks=2` alone is every set partition into two blocks); and a collection can gain a parameter later without changing the meaning of any existing URL. Positional forms cannot do the last two, and the last one matters most for permanence.
- **The parameter's name is the collection's own word**: `DyckPath;semilength=4`, `Permutation;size=4`, `LabeledGraph;vertices=5`, `Word;length=3;alphabet=2`. Where the literature's own word is a letter, the letter is the word (`Subset;n=5;k=2`, `TorusKnot;p=2;q=3`).
- **`n` is read everywhere** as an alias for a collection's size parameter, and a bare value binds it: `DyckPath;n=4` and `DyckPath;4` redirect to `DyckPath;semilength=4`.
- **A bound parameter is a restriction like any other.** Parameters are not only sizes: `PrimePair;gap=2`, `PolygonalNumber;sides=5`, `Residue;modulus=12`, `QuadraticInteger;d=-5`.
- **Canonical order** is the declared order of the parameters; any order is read.
- **A parameter's value** is written by the same rules as an element (§2.5). The first pass reads integers only.
- **Only point values go in the path.** A range or a grouped parameter is a view over many sub-collections, so it is query string: `/collection/Subset;n=5?group_by=k` is a row of Pascal's triangle. (The archived project reached the same split.)
- This is the matrix-parameter form (RFC 3986 §3.3 leaves `;` and `=` to the scheme for exactly this), and it is where the archived explorer ended up. `~` and `_` were tried before it.

**A restriction as a parameter, or as a name** (provisional; no firm rule is agreed). A restriction is a parameter when its condition takes a value and each value gives a different collection (`PermutationAvoiding;pattern=231`, `PrimePair;gap=2`). It is a name when the literature has a noun for it (`Derangement`, `Involution`, `Prime`). Where both hold at one point (`TwinPrime` is `PrimePair;gap=2`), the noun is the address and the parametric point redirects to it. A name that only says a parameter exists is not a collection of its own: `KSubset` is `Subset`, read with its `k`, and redirects there.

### 2.2 The element segment

Always position 3, always one segment, one of two forms:

- **By value**: the element written in its canonical form. `11010010`, `2_1_4_3`, `1,3`, `5040`, `3+2i`, `3_1`.
- **By rank**: `@7` is the element at position 7 in the collection's default order, `@lex:7` in a named order. The collection segment says which collection the rank is in, so a rank address is only as stable as the parameters bound there.

A value may carry the name of its notation in front, `cycle:(1_2)(3_4)`, when it is not written in the collection's default notation. The names of notations and orders are lowercase words. A notation-prefixed value is read and moved to the value in the default notation, which is the one canonical spelling; showing an element in another notation is a view (`?as=cycle`). A value itself never contains `:`, never begins with `@`, and is never `.` or `..`.

**An element's canonical address is in its unrestricted collection.** A parameter the element can be measured for (its size, its number of blocks) is never part of that address; a parameter the element cannot be written without (the `n` a subset is taken from, a residue's modulus, a numeral's base) always is: `/collection/Subset;n=5/1,3`, and `;k=2` is a view of it. `/collection/DyckPath/11010010` is the object. `/collection/DyckPath;semilength=4/11010010` is the same object seen inside a sub-collection: it resolves only if the element belongs there, shows it in that context (its rank there, its neighbours), and names the first as canonical. The same holds for a named sub-collection: `/collection/TwinPrime/17` and `/collection/Prime/17` are views of `/collection/Natural/17`. A rank address redirects to the value address. A value that is not a member has no canonical address (§5).

### 2.3 Properties and substructure

After the element, each segment is a property applied to what the path has reached so far. A property's name means the statistic or map the catalogue records under that name for the collection; only when there is none is it a head applied to the element. A property is anything the collection declares on its elements:

| Kind | Example | Result |
| --- | --- | --- |
| a statistic | `/collection/DyckPath/11010010/Area` | a number: the fact "the area of this path is 2" as a resource |
| a part | `/collection/SetPartition/1,3!2!4/Blocks` | the blocks, in order |
| an index into a result | `/collection/SetPartition/1,3!2!4/Blocks/2` | the second block |
| a map | `/collection/Permutation/3_1_4_2/Inverse` | an element of another collection; the page shows it and links to its own address |
| a representation | `/collection/Natural/3811/IntegerDigits;base=60` | the digits of 3811 in base 60 |
| a derived object | `/collection/Natural/360/Factorization` | 2³·3²·5 as an element of `IntegerFactorization` |

- A property takes parameters the same way a collection does: `IntegerDigits;base=60`.
- An integer segment after a list-valued result indexes it, from 1.
- A chain can continue through a map: `…/Permutation/3_1_4_2/Inverse/CycleType`. This is how one reads through a map into another collection.
- This is `At(Blocks(x), 2)` and `CycleType(Inverse(x))` in Epsil, read left to right.

**Substructure is a path, not a fragment.** A fragment is never sent to the server and cannot be cited as an object. Fragments are for places in a page (`#Area`, an example's id).

### 2.4 The query string

Only the view: which properties a page shows and in what order (`?show=Area,Bounce,Peaks`), which notation or figure (`?as=cycle`), sorting, filtering and grouping of a collection's table (`?order_by=Area&where=Peaks>2&group_by=Height`), the window into a large collection (`?from=41`). Each kind of object has its own defaults (a natural number leads with its factorization, a knot with its diagram and its prime decomposition, a permutation with its one-line form and cycles); the query string is how a reader changes them, and a configured view is a shareable URL.

### 2.5 Writing an element

One set of separators for every collection, each with one meaning (the precursor's convention, with one change). The characters are provisional; what must hold is that each has one meaning everywhere.

| Mark | Meaning | Example |
| --- | --- | --- |
| `,` | members where order does not matter | a subset `1,3`; the members of a block |
| `_` | items in order | a permutation `2_1_4_3`; a signed one `1_-3_2`; a knot `3_1` |
| `!` | between blocks or rows | a set partition `1,3!2!4`; a matrix `1_2!3_4` |
| `-` | a negative sign, nothing else | `-3` |
| `.` | a decimal point, nothing else | `3.25` |
| `:` | names a notation or an order | `cycle:…`, `@lex:7` |
| `/` inside a value | never | a fraction is `22_7` under `Rational`, or its own notation |

- **`_` for ordered items, where the precursor used `'`.** An apostrophe is legal in a URL, but phones and word processors turn it into a curly quote, shells and code need it escaped, and some linkifiers stop at it. `_` needs no escaping and a double click selects the whole address. `'` is still read.
- **Short form.** Where every item is a single digit, the items may be run together: `2143` for `2_1_4_3`. It is read only for collections where it cannot be mistaken for something else (a permutation), never where a multi-digit item is possible on its own: under `IntegerPartition`, `421` is the one part 421. The separated form is canonical.
- **A word over a fixed alphabet of single characters** (a Dyck path, a binary word) is written run together, and that is its canonical form: `11010010`.
- **Members where order does not matter are written sorted** (members ascending, blocks by least member); any order is read.
- `;` is left to parameters. Continued fractions and matrices, which are traditionally written with it, use `!`.

## 3. Areas

| Path | What it is |
| --- | --- |
| `/collection/…` | Every object (§2). Numbers, numerals, structures, sequences as sets, knots, polytopes, groups and algebras are all collections. |
| `/stat/<Name>` | A statistic as a concept: its definition, the collections it is defined on, its FindStat identity. `/stat/Area/DyckPath;semilength=4` narrows it to a collection: its distribution there. After the name the path is read as in §2 (collection, element, properties). `/stat/St000012` redirects to the name. |
| `/map/<Name>` | A map as a concept: source, target, what it preserves. `/map/Mp00023` redirects. |
| `/sequence/<A-number>` | An OEIS number (one segment, written `A000108`), redirecting to the collection or statistic that realizes it. |
| `/input/<expression>` | Evaluates an Epsil expression. If the result is a catalogued object the page says so and links to its address; it does not redirect. |
| `/atlas` | The whole route space, generated from the route file (§6), with each route's status. |
| `/about`, `/contribute` | What the site is; how to suggest or reserve a route. |

The value of a statistic on an element has one address, under the element: `/stat/Inversions/Permutation/1_3_2_5_4` redirects to `/collection/Permutation/1_3_2_5_4/Inversions`.

There are no areas by discipline. If an area is ever added it is one more lowercase word in this table.

## 4. What is in `/collection/`

● data exists in notatio today · ◐ only in the earlier projects · ○ new.

**Numbers.** `Natural` (from 0), `Integer`, `Rational`, `Fraction`, `GaussianInteger`, `GaussianRational`, `QuadraticInteger;d=`, `AlgebraicInteger`, `Residue;modulus=`, `AdicInteger;p=`, `ProfiniteInteger`, `Adele`, `ContinuedFraction`, `EgyptianFraction`, `Quaternion`, `Multicomplex` ●; `EisensteinInteger` ○; `Ordinal`, `Cardinal`, `Float` ◐.

**Numbers by what they are made of.** `Natural/360/Factorization` leads to `IntegerFactorization`, where a number is its primes and their exponents. The named sets of integers are then conditions on the exponents, and each is a sub-collection of `Natural` whose page states that condition: `Prime` (one exponent, equal to 1), `PrimePower` (one exponent), `Semiprime`, `SquarefreeNumber` (exponents 0 or 1), `Square` (all even), `KFreeNumber;k=`, `PowerfulNumber`, `SphenicNumber`, `SmoothNumber;bound=`, `RoughNumber;bound=`; a `Rational` is the same with integer exponents. `TwinPrime` is `PrimePair;gap=2`. About 60 more by divisors, digits and recurrences (`PerfectNumber`, `AbundantNumber`, `CarmichaelNumber`, `HarshadNumber`, `KaprekarNumber`, `FibonacciNumber`, `CatalanNumber`, `PolygonalNumber;sides=`, …) ●.

**Numerals.** A numeral is reached two ways. As a property of a number: `Natural/3811/IntegerDigits;base=60`. As an object in its own right, a string of digits: `PositionalNumeral;base=60/1_3_31`. Systems: positional, balanced, bijective, negative base, mixed radix (`;radices=2,3,5`), factorial, primorial, residue (`;moduli=3,5,7`), Zeckendorf, Ostrowski, combinatorial, Roman, hypernumerary, adic ●; complex bases, Witt ◐.

**Combinatorial structures** ● (74 object types): `Word`, `Arrangement`, `Subset`, `Multiset`, `SignedSubset`; `Permutation` and its kin (`Derangement`, `Involution`, `BaxterPermutation`, `PermutationAvoiding;pattern=231`, `SignedPermutation`, `ColoredPermutation`, `AffinePermutation`, …); `Endofunction`, `Surjection`, `ParkingFunction`; `IntegerPartition` and kin; `IntegerComposition` and kin; `SetPartition`, `SetComposition`, `PerfectMatching`; `BinaryWord`, `Necklace`, `LyndonWord`, `GrayCode`; `DyckPath`, `MotzkinPath`, `SchroederPath`, `DelannoyPath`; `BinaryTree`, `OrderedTree`, `LabeledTree`, `RootedForest`; `LabeledGraph`, `Tournament`, `Poset`; `StandardTableau`, `SemistandardTableau`, `GelfandTsetlinPattern`, `AlternatingSignMatrix`, `RookPlacement`; `CartanType`.

**Polytopes** ◐. A polytope is the collection of its faces: `Permutahedron;n=4` is the truncated octahedron, `Permutahedron;n=4;dimension=2` its 14 polygons, and a face's address is the structure that labels it, `Permutahedron;n=4/1,3!2!4`. `Associahedron`, `Cyclohedron`, `Simplex`, `CrossPolytope`, `Hypercube`. The property `Label` takes a face to that structure's own page (a set composition, a dissection, a subset, a signed subset). Which projection is drawn is a view.

**Knots.** `Knot/3_1` ○ (the table is new data), `Knot;crossings=7`, `TorusKnot;p=2;q=3`, `PretzelKnot`, `TwistKnot` ●, `Link` ○, `Braid;strands=3/1_-2_1_-2` ●. Properties: `JonesPolynomial`, `AlexanderPolynomial`, `Genus`, `Factorization` (into prime knots), `BraidWord`.

**Groups and algebras** ●. `SymmetricGroup;n=4` is a collection whose elements are permutations, so its element addresses are views of `Permutation` elements. `CyclicGroup`, `DihedralGroup`, `AlternatingGroup`, `BraidGroup`, `ModularGroup`; `PartitionAlgebra`, `BrauerAlgebra`, `TemperleyLiebAlgebra`, `HeckeAlgebra`, `IncidenceAlgebra`, `PathAlgebra`.

**Tables of numbers** ◐. Not a separate kind: a number triangle is a collection with two parameters viewed with one of them grouped (`Subset;n=5?group_by=k`), and its entry is a count (`/collection/Subset;n=5;k=2` has 10 members).

## 5. Reading other spellings

One function reduces a name to a key (drop `-` and `_`, lowercase), and one table per name lists its aliases. No rule per URL.

| Request | Canonical | How |
| --- | --- | --- |
| `/collections/…`, `/Collection/…` | `/collection/…` | the area is lowercased; a plural redirects |
| `/collection/dyck-path`, `dyck_path`, `dyckpath` | `/collection/DyckPath` | the key |
| `/collection/DyckPaths`, `dyck-paths` | `/collection/DyckPath` | plural: a default rule (a trailing `s`), with the exceptions listed on the collection's own record |
| `/collection/TwinPrimes`, an old name after a rename | the current name | alias on the record |
| `/collection/DyckPath;n=4`, `DyckPath;4`, `DyckPath_4`, `DyckPath(4)` | `/collection/DyckPath;semilength=4` | `n` and a bare value bind the size parameter |
| `/collection/Permutation/2'1'4'3`, `2,1,4,3`, `[2,1,4,3]`, `2143` | `…/2_1_4_3` | the collection's reader accepts the usual ways of writing an element |
| `/stat/St000012`, `/map/Mp00023`, `/sequence/A000108` | the named page | an outside identifier |

Names (positions 1, 2 and each property) are normalized this way. An element's value is read by its collection, since case and punctuation can carry meaning there.

- A bare value is told from a name by its shape: `Name(4)`, `Name;4`, or `_` and digits at the end of a name. Where the collection has no size parameter it is an error, not a guess.
- The canonical form writes letters, digits and the marks of §2.5 as they are and percent-encodes everything else. A trailing slash, an empty segment or an encoded mark is read and moved to the canonical form.
- A page's canonical link is its path alone: the query string is a view of the same object.
- `/input/` writes every character a path segment may hold as it is (`/input/1+1`), and encodes only the rest.
- An address that cannot be read (an unknown area, a rank of 0, a value its collection refuses or that is not a member: `/collection/Prime/18`) has no canonical form: its page says what was wrong, carries no canonical link, and asks not to be indexed.

In the first pass the page itself moves a reader to the canonical address and states it in the page's canonical link. Redirects answered by the server (a permanent redirect for a name, a real not-found for an address that is none) follow.

## 6. The route file and the promise

One file in the repository lists every route. Each row: the name, its kind (a collection, or a sub-collection and the collection it sits within), the Epsil expression behind it and the constructor of one element, its parameters and their aliases, its aliases, its plural where the default rule is wrong, outside identifiers, a status, who asked for it and when.

| Status | Meaning | Promise |
| --- | --- | --- |
| **proposed** | Suggested. Listed in the atlas, not served. | none |
| **reserved** | The name is held for a stated object, by a named person, until a date. Serves a short page saying so. | the name is not given to something else while the reservation runs |
| **stub** | Serves the definition and links, without live content. | permanent |
| **live** | The full page. | permanent |

- **The promise starts when the site is announced.** Until then the route file says so, the atlas says so on its page, and a `stub` or `live` row may still be renamed. From that date a row that has been `stub` or `live` is never deleted, and a test fails the build when one neither resolves nor redirects. That test is the whole of what "permanent" means mechanically.
- A reservation lapses after a year unless it is renewed or has become a stub; a lapsed row stays in the file, marked, so the history of a name is never lost.
- Suggesting or reserving a route is adding a row: a pull request, or an issue form that writes one.
- A collection's row covers every sub-collection, element and property under it.

## 7. Pages

- **A collection**: its definition in a sentence and in Epsil, its parameters with a picker, its count for each size, its statistics and maps, its sub-collections and the collections it sits inside, a table of members for a bound size (the archived explorer's table: choose columns, filter, group, sort).
- **An element**: its figures and notations, the value of every statistic, its image under every map with a link, its neighbours in each order. What is shown first depends on the kind of object, and the query string changes it.
- **A property value**: the value, how it was computed, and the element it belongs to.
- **Computation happens in the page.** The site loads notatio's kernel, so an object renders and recomputes where it is. A link out to a notatio.app notebook is an extra, not the mechanism.
- Small sizes are built ahead of time; everything else is computed on arrival, so every valid address resolves even though there are infinitely many. (The first pass computes everything on arrival.)

## 8. Open, and how the first pass treats it

1. **Separators** (§2.5). `_` for ordered items is the working choice; all of the characters stay provisional.
2. **The rule for a restriction as a parameter or a name** (§2.1). The first pass follows the provisional rule there.
3. **Family-level facts with no element** (the counting sequence of `DyckPath`, its generating function). They are on the collection's page and have no path of their own. If they ever need addresses, position 3 needs a word for "no element", and that is a cost to rule 1.
4. **Sequences in their own right.** `/sequence/` is only OEIS aliases. A sequence that is not the member list or the count of any collection has no home yet.
5. **Short form** (§2.5). Read where unambiguous, never canonical.
6. **Which word each collection's parameters get.** The first pass chooses for its own collections; the rest are chosen as their rows are written.
7. **The empty element** (the empty permutation, the partition of 0, the empty subset) has no spelling yet. A lean: the separator alone, `_` for an ordered value and `,` for an unordered one. The first pass shows it and gives it no link.
8. **A plural noun as a property** (`Blocks`, `Peaks`, `Descents`): the things, or their number? Substructure addressing (`Blocks/2`) needs the things, with the number under its own name (`BlockCount`). The catalogue's names do not all follow this yet.

## 9. The first pass

Enough to follow every kind of address in §2 end to end, over a few collections that between them use every part of the grammar:

| Collection | What it exercises |
| --- | --- |
| `Natural`, with `Prime` inside it | numbers; a named sub-collection; `Factorization`; `IntegerDigits;base=` |
| `Permutation` | ordered items, the short form, maps (`Inverse`) and chains through them |
| `DyckPath` | a size the collection has its own word for; statistics; rank addresses |
| `SetPartition` | blocks, two parameters, substructure (`Blocks/2`) |
| `IntegerPartition` | a value where the short form is refused |
| `Subset` | unordered members; two letter-named parameters, one of them part of an element's address; a grouped view (a row of Pascal's triangle) |

Everything else in §4 is listed in the atlas as `proposed`. Also in the first pass: `/stat/<Name>` and `/map/<Name>` for the statistics and maps of those collections, `/sequence/` for their OEIS numbers, `/input/`, `/atlas`, `/about`, `/contribute`.

── elements · bare ─────────────────────────────────────────────────────────────────────────────────
WITH r AS (
  SELECT size(e) AS size, rank(e) AS rank, array_to_string(address(e), '.') AS address, notation(omega_ordinality(e)) AS omega, render(e) AS element, perm_descents((e).value) AS descents, perm_inversions((e).value) AS inversions, perm_cycle_count((e).value) AS cycles
  FROM elements(permutations(4), 2147483647) e)
SELECT row_number() OVER (ORDER BY size, rank) AS ordinality, *
FROM r
ORDER BY size, rank

── elements · restriction ──────────────────────────────────────────────────────────────────────────
WITH r AS (
  SELECT size(e) AS size, rank(e) AS rank, array_to_string(address(e), '.') AS address, notation(omega_ordinality(e)) AS omega, render(e) AS element, perm_descents((e).value) AS descents, perm_inversions((e).value) AS inversions, perm_cycle_count((e).value) AS cycles
  FROM elements(permutations(4), 2147483647) e)
SELECT row_number() OVER (ORDER BY size, rank) AS ordinality, *
FROM r
WHERE descents >= 2
ORDER BY size, rank

── elements · between + in ─────────────────────────────────────────────────────────────────────────
WITH r AS (
  SELECT size(e) AS size, rank(e) AS rank, array_to_string(address(e), '.') AS address, notation(omega_ordinality(e)) AS omega, render(e) AS element, perm_descents((e).value) AS descents, perm_inversions((e).value) AS inversions, perm_cycle_count((e).value) AS cycles
  FROM elements(permutations(4), 2147483647) e)
SELECT row_number() OVER (ORDER BY size, rank) AS ordinality, *
FROM r
WHERE descents BETWEEN 1 AND 2 AND inversions IN (1, 2, 3)
ORDER BY size, rank

── elements · stat sort ────────────────────────────────────────────────────────────────────────────
WITH r AS (
  SELECT size(e) AS size, rank(e) AS rank, array_to_string(address(e), '.') AS address, notation(omega_ordinality(e)) AS omega, render(e) AS element, perm_inversions((e).value) AS inversions, perm_descents((e).value) AS descents, perm_cycle_count((e).value) AS cycles
  FROM elements(permutations(4), 2147483647) e)
SELECT row_number() OVER (ORDER BY inversions DESC, rank) AS ordinality, *
FROM r
ORDER BY inversions DESC, rank
OFFSET 0 LIMIT 6

── elements · window ───────────────────────────────────────────────────────────────────────────────
WITH r AS (
  SELECT size(e) AS size, rank(e) AS rank, array_to_string(address(e), '.') AS address, notation(omega_ordinality(e)) AS omega, render(e) AS element, perm_descents((e).value) AS descents, perm_inversions((e).value) AS inversions, perm_cycle_count((e).value) AS cycles
  FROM elements(ROW(natural_range(0, 4, '[]'))::permutations, 2147483647) e)
SELECT row_number() OVER (ORDER BY size, rank) AS ordinality, *
FROM r
ORDER BY size, rank
OFFSET 5 LIMIT 7

── elements · open frontier ────────────────────────────────────────────────────────────────────────
WITH r AS (
  SELECT size(e) AS size, rank(e) AS rank, array_to_string(address(e), '.') AS address, notation(omega_ordinality(e)) AS omega, render(e) AS element, perm_descents((e).value) AS descents, perm_inversions((e).value) AS inversions, perm_cycle_count((e).value) AS cycles
  FROM elements(permutations(), 12) e)
SELECT row_number() OVER (ORDER BY size, rank) AS ordinality, *
FROM r
ORDER BY size, rank
OFFSET 8 LIMIT 4

── elements · stat id collision ────────────────────────────────────────────────────────────────────
WITH r AS (
  SELECT n(e) AS n, rank(e) AS rank, array_to_string(address(e), '.') AS address, notation(omega_ordinality(e)) AS omega, render(e) AS element, cardinality((e).value) AS rank_stat
  FROM elements(subsets(3), 2147483647) e)
SELECT row_number() OVER (ORDER BY n, rank) AS ordinality, *
FROM r
WHERE rank_stat = 2
ORDER BY n, rank

── elements · select list ──────────────────────────────────────────────────────────────────────────
WITH r AS (
  SELECT size(e) AS size, rank(e) AS rank, array_to_string(address(e), '.') AS address, notation(omega_ordinality(e)) AS omega, render(e) AS element, perm_descents((e).value) AS descents, render_value(perm_inverse((e).value)) AS "map:inverse"
  FROM elements(permutations(4), 2147483647) e)
SELECT row_number() OVER (ORDER BY size, rank) AS ordinality, *
FROM r
ORDER BY size, rank

── elements · glyph deferred ───────────────────────────────────────────────────────────────────────
WITH r AS (
  SELECT size(e) AS size, rank(e) AS rank, array_to_string(address(e), '.') AS address, notation(omega_ordinality(e)) AS omega, render(e) AS element
  FROM elements(permutations(4), 2147483647) e)
SELECT row_number() OVER (ORDER BY size, rank) AS ordinality, *
FROM r
ORDER BY size, rank

── elements · eager glyph ──────────────────────────────────────────────────────────────────────────
WITH r AS (
  SELECT size(e) AS size, rank(e) AS rank, array_to_string(address(e), '.') AS address, notation(omega_ordinality(e)) AS omega, render(e) AS element, glyph_svg((e).value) AS glyph
  FROM elements(permutations(4), 2147483647) e)
SELECT row_number() OVER (ORDER BY size, rank) AS ordinality, *
FROM r
ORDER BY size, rank

── fibers · band ───────────────────────────────────────────────────────────────────────────────────
WITH r AS (
  SELECT size(e) AS size, rank(e) AS rank, array_to_string(address(e), '.') AS address, notation(omega_ordinality(e)) AS omega, render(e) AS element
  FROM elements(ROW(natural_range(0, 6, '[]'))::permutations, 2147483647) e)
SELECT size, count(*) AS count
FROM r
GROUP BY size
ORDER BY size NULLS LAST

── fibers · prefix of two axes ─────────────────────────────────────────────────────────────────────
WITH r AS (
  SELECT n(e) AS n, k(e) AS k, rank(e) AS rank, array_to_string(address(e), '.') AS address, notation(omega_ordinality(e)) AS omega, render(e) AS element
  FROM elements(ROW(natural_range(0, 4, '[]'), natural_range(0, NULL, '[]'))::k_subsets, 2147483647) e)
SELECT n, count(*) AS count, NULL AS symbol
FROM r
GROUP BY n
ORDER BY n NULLS LAST

── fibers · key lens ───────────────────────────────────────────────────────────────────────────────
WITH r AS (
  SELECT n(e) AS n, k(e) AS k, rank(e) AS rank, array_to_string(address(e), '.') AS address, notation(omega_ordinality(e)) AS omega, render(e) AS element
  FROM elements(ROW(natural_range(0, 7, '[]'), natural_range(0, NULL, '[]'))::k_subsets, 2147483647) e)
SELECT n, k, count(*) AS count, fiber_symbol(ROW(n, k)::k_subsets_fiber) AS symbol
FROM r
GROUP BY n, k
HAVING k = 2
ORDER BY n NULLS LAST, k NULLS LAST

── fibers · measure lens ───────────────────────────────────────────────────────────────────────────
WITH r AS (
  SELECT size(e) AS size, rank(e) AS rank, array_to_string(address(e), '.') AS address, notation(omega_ordinality(e)) AS omega, render(e) AS element
  FROM elements(ROW(natural_range(0, 7, '[]'))::permutations, 2147483647) e)
SELECT size, count(*) AS count
FROM r
GROUP BY size
HAVING count(*) > 5
ORDER BY size NULLS LAST

── fibers · symbol column ──────────────────────────────────────────────────────────────────────────
WITH r AS (
  SELECT size(e) AS size, rank(e) AS rank, array_to_string(address(e), '.') AS address, notation(omega_ordinality(e)) AS omega, render(e) AS element
  FROM elements(ROW(natural_range(0, 5, '[]'))::permutations, 2147483647) e)
SELECT size, count(*) AS count, fiber_symbol(ROW(size)::permutations_fiber) AS symbol
FROM r
GROUP BY size
ORDER BY size NULLS LAST

── distribution · q-analog ─────────────────────────────────────────────────────────────────────────
WITH r AS (
  SELECT size(e) AS size, rank(e) AS rank, array_to_string(address(e), '.') AS address, notation(omega_ordinality(e)) AS omega, render(e) AS element, perm_inversions((e).value) AS inversions
  FROM elements(permutations(4), 2147483647) e)
SELECT inversions, count(*) AS count
FROM r
GROUP BY inversions
ORDER BY inversions NULLS LAST

── distribution · triangle ─────────────────────────────────────────────────────────────────────────
WITH r AS (
  SELECT size(e) AS size, rank(e) AS rank, array_to_string(address(e), '.') AS address, notation(omega_ordinality(e)) AS omega, render(e) AS element, perm_descents((e).value) AS descents
  FROM elements(ROW(natural_range(0, 4, '[]'))::permutations, 2147483647) e)
SELECT size, descents, count(*) AS count
FROM r
GROUP BY size, descents
ORDER BY size NULLS LAST, descents NULLS LAST

── distribution · dist cell ────────────────────────────────────────────────────────────────────────
WITH r AS (
  SELECT size(e) AS size, rank(e) AS rank, array_to_string(address(e), '.') AS address, notation(omega_ordinality(e)) AS omega, render(e) AS element, perm_descents((e).value) AS descents
  FROM elements(ROW(natural_range(0, 4, '[]'))::permutations, 2147483647) e)
SELECT size, count(*) AS count, (SELECT array_agg(c ORDER BY k)::text FROM (SELECT descents AS k, count(*) AS c FROM r r2 WHERE r2.size IS NOT DISTINCT FROM r.size GROUP BY 1) d) AS "dist:descents"
FROM r
GROUP BY size
ORDER BY size NULLS LAST

── distribution · pivot ────────────────────────────────────────────────────────────────────────────
WITH r AS (
  SELECT size(e) AS size, rank(e) AS rank, array_to_string(address(e), '.') AS address, notation(omega_ordinality(e)) AS omega, render(e) AS element, perm_descents((e).value) AS descents
  FROM elements(ROW(natural_range(0, 4, '[]'))::permutations, 2147483647) e)
SELECT size, count(*) AS count, count(*) FILTER (WHERE descents = 0)::text AS "descents=0", count(*) FILTER (WHERE descents = 1)::text AS "descents=1", count(*) FILTER (WHERE descents = 2)::text AS "descents=2", count(*) FILTER (WHERE descents = 3)::text AS "descents=3"
FROM r
GROUP BY size
ORDER BY size NULLS LAST

── distribution · meta ─────────────────────────────────────────────────────────────────────────────
WITH r AS (
  SELECT rank(e) AS rank, array_to_string(address(e), '.') AS address, notation(omega_ordinality(e)) AS omega, render(e) AS element, meta_collection_carrier((e).value) AS carrier
  FROM elements(collections(), 2147483647) e)
SELECT carrier, count(*) AS count
FROM r
GROUP BY carrier
HAVING count(*) >= 8
ORDER BY count DESC

── rollup ──────────────────────────────────────────────────────────────────────────────────────────
WITH r AS (
  SELECT n(e) AS n, k(e) AS k, rank(e) AS rank, array_to_string(address(e), '.') AS address, notation(omega_ordinality(e)) AS omega, render(e) AS element
  FROM elements(ROW(natural_range(0, 3, '[]'), natural_range(0, NULL, '[]'))::k_subsets, 2147483647) e)
SELECT n, k, count(*) AS count, grouping(n, k) AS level
FROM r
GROUP BY ROLLUP (n, k)
ORDER BY n NULLS LAST, k NULLS LAST

── rollup · registered + measure lens ──────────────────────────────────────────────────────────────
WITH r AS (
  SELECT size(e) AS size, rank(e) AS rank, array_to_string(address(e), '.') AS address, notation(omega_ordinality(e)) AS omega, render(e) AS element, perm_cycle_count((e).value) AS cycles
  FROM elements(ROW(natural_range(0, 5, '[]'))::permutations, 2147483647) e)
SELECT size, cycles, count(*) AS count, grouping(size, cycles) AS level
FROM r
GROUP BY ROLLUP (size, cycles)
HAVING count(*) > 1
ORDER BY size NULLS LAST, cycles NULLS LAST

── grouping sets · with footer ─────────────────────────────────────────────────────────────────────
WITH r AS (
  SELECT size(e) AS size, rank(e) AS rank, array_to_string(address(e), '.') AS address, notation(omega_ordinality(e)) AS omega, render(e) AS element, perm_descents((e).value) AS descents
  FROM elements(ROW(natural_range(0, 4, '[]'))::permutations, 2147483647) e)
SELECT size, descents, count(*) AS count, grouping(size, descents) AS level
FROM r
GROUP BY GROUPING SETS ((size, descents), ())
ORDER BY size NULLS LAST, descents NULLS LAST

── rowgroup ────────────────────────────────────────────────────────────────────────────────────────
WITH r AS (
  SELECT size(e) AS size, rank(e) AS rank, array_to_string(address(e), '.') AS address, notation(omega_ordinality(e)) AS omega, render(e) AS element
  FROM elements(ROW(natural_range(0, 3, '[]'))::permutations, 2147483647) e)
SELECT size, rank, element, count(*) AS count, grouping(size, rank, element) AS level
FROM r
GROUP BY GROUPING SETS ((size, rank, element), (size))
ORDER BY size NULLS LAST, rank NULLS LAST, element NULLS LAST

── rowgroup · key lens ─────────────────────────────────────────────────────────────────────────────
WITH r AS (
  SELECT n(e) AS n, k(e) AS k, rank(e) AS rank, array_to_string(address(e), '.') AS address, notation(omega_ordinality(e)) AS omega, render(e) AS element
  FROM elements(ROW(natural_range(0, 3, '[]'), natural_range(0, NULL, '[]'))::k_subsets, 2147483647) e)
SELECT n, k, rank, element, count(*) AS count, grouping(n, k, rank, element) AS level
FROM r
GROUP BY GROUPING SETS ((n, k, rank, element), (n))
HAVING n >= 2
ORDER BY n NULLS LAST, k NULLS LAST, rank NULLS LAST, element NULLS LAST

── over · count lifted onto elements ───────────────────────────────────────────────────────────────
WITH r AS (
  SELECT size(e) AS size, rank(e) AS rank, array_to_string(address(e), '.') AS address, notation(omega_ordinality(e)) AS omega, render(e) AS element
  FROM elements(ROW(natural_range(0, 4, '[]'))::permutations, 2147483647) e)
SELECT row_number() OVER (ORDER BY size, rank) AS ordinality, *, (count(*) OVER (PARTITION BY size))::text AS "over:count"
FROM r
ORDER BY size, rank

── kernel · GROUP BY orbit ─────────────────────────────────────────────────────────────────────────
WITH r AS (
  SELECT size(e) AS size, base(e) AS base, rank(e) AS rank, array_to_string(address(e), '.') AS address, notation(omega_ordinality(e)) AS omega, render(e) AS element, render_value(word_canonical_rotation((e).value)) AS "orbit:rotation"
  FROM elements(words(4, 2), 2147483647) e)
SELECT "orbit:rotation", count(*) AS count
FROM r
GROUP BY "orbit:rotation"
ORDER BY "orbit:rotation" NULLS LAST

── kernel · GROUP BY map ───────────────────────────────────────────────────────────────────────────
WITH r AS (
  SELECT size(e) AS size, rank(e) AS rank, array_to_string(address(e), '.') AS address, notation(omega_ordinality(e)) AS omega, render(e) AS element, render_value(perm_inverse((e).value)) AS "map:inverse"
  FROM elements(permutations(4), 2147483647) e)
SELECT "map:inverse", count(*) AS count
FROM r
GROUP BY "map:inverse"
ORDER BY "map:inverse" NULLS LAST

── order · graded cover relation ───────────────────────────────────────────────────────────────────
WITH RECURSIVE r AS (
  SELECT size(e) AS size, rank(e) AS rank, array_to_string(address(e), '.') AS address, notation(omega_ordinality(e)) AS omega, render(e) AS element, (e).value AS value, perm_descents((e).value) AS descents, perm_inversions((e).value) AS inversions, perm_cycle_count((e).value) AS cycles
  FROM elements(permutations(4), 2147483647) e),
  elts AS (SELECT (e).value AS v FROM elements(permutations(4), 2147483647) e),
  cover AS (SELECT e.v AS x, c AS y FROM elts e, LATERAL perm_weak_order_covers(e.v) c WHERE c IN (SELECT v FROM elts)),
  chain AS (SELECT v, 0 AS r FROM elts WHERE v NOT IN (SELECT y FROM cover)
            UNION SELECT cover.y, chain.r + 1 FROM chain JOIN cover ON cover.x = chain.v),
  "rank:weak_order" AS (SELECT v, max(r) AS r FROM chain GROUP BY v)
SELECT row_number() OVER (ORDER BY k.r ASC NULLS LAST, size, rank) AS ordinality, r.*, k.r AS "rank:weak_order"
FROM r LEFT JOIN "rank:weak_order" k ON k.v = r.value
ORDER BY k.r ASC NULLS LAST, size, rank

── facet · meta collection ─────────────────────────────────────────────────────────────────────────
WITH r AS (
  SELECT rank(e) AS rank, array_to_string(address(e), '.') AS address, notation(omega_ordinality(e)) AS omega, render(e) AS element, meta_collection_carrier((e).value) AS carrier, meta_collection_title((e).value) AS title, meta_collection_tags((e).value) AS tags
  FROM elements(collections(), 2147483647) e)
SELECT row_number() OVER (ORDER BY rank) AS ordinality, *
FROM r
WHERE carrier = 'permutation'
ORDER BY rank

── facet · tag membership ──────────────────────────────────────────────────────────────────────────
WITH r AS (
  SELECT rank(e) AS rank, array_to_string(address(e), '.') AS address, notation(omega_ordinality(e)) AS omega, render(e) AS element, meta_collection_title((e).value) AS title, meta_collection_carrier((e).value) AS carrier, meta_collection_tags((e).value) AS tags
  FROM elements(collections(), 2147483647) e)
SELECT row_number() OVER (ORDER BY rank) AS ordinality, *
FROM r
WHERE element IN (SELECT collection FROM base_collection_tag WHERE tag = 'classical')
ORDER BY rank

── restriction · fn predicate on the carrier ───────────────────────────────────────────────────────
WITH r AS (
  SELECT size(e) AS size, rank(e) AS rank, array_to_string(address(e), '.') AS address, notation(omega_ordinality(e)) AS omega, render(e) AS element, (e).value AS value, perm_descents((e).value) AS descents, perm_inversions((e).value) AS inversions, perm_cycle_count((e).value) AS cycles
  FROM elements(permutations(4), 2147483647) e)
SELECT row_number() OVER (ORDER BY size, rank) AS ordinality, *
FROM r
WHERE is_derangement(value)
ORDER BY size, rank

── kernel · token inside a LIKE pattern ────────────────────────────────────────────────────────────
WITH r AS (
  SELECT size(e) AS size, rank(e) AS rank, array_to_string(address(e), '.') AS address, notation(omega_ordinality(e)) AS omega, render(e) AS element, render_value(perm_inverse((e).value)) AS "map:inverse"
  FROM elements(permutations(4), 2147483647) e)
SELECT "map:inverse", count(*) AS count
FROM r
GROUP BY "map:inverse"
HAVING count(*) > 0
ORDER BY "map:inverse" NULLS LAST

── kernel · token inside a string literal, unparseable clause ──────────────────────────────────────
WITH r AS (
  SELECT size(e) AS size, base(e) AS base, rank(e) AS rank, array_to_string(address(e), '.') AS address, notation(omega_ordinality(e)) AS omega, render(e) AS element, render_value(word_canonical_rotation((e).value)) AS "orbit:rotation"
  FROM elements(words(4, 2), 2147483647) e)
SELECT "orbit:rotation", count(*) AS count
FROM r
GROUP BY "orbit:rotation"
HAVING count(*) > 0 AND 'orbit:rotation' <> ''
ORDER BY "orbit:rotation" NULLS LAST

── clause · an OR falls back to verbatim splicing ──────────────────────────────────────────────────
WITH r AS (
  SELECT size(e) AS size, rank(e) AS rank, array_to_string(address(e), '.') AS address, notation(omega_ordinality(e)) AS omega, render(e) AS element, perm_descents((e).value) AS descents, perm_inversions((e).value) AS inversions, perm_cycle_count((e).value) AS cycles
  FROM elements(permutations(4), 2147483647) e)
SELECT row_number() OVER (ORDER BY size, rank) AS ordinality, *
FROM r
WHERE descents >= 2 OR inversions < 3
ORDER BY size, rank

── clause · non-canonical spacing is canonicalized by composition ──────────────────────────────────
WITH r AS (
  SELECT size(e) AS size, rank(e) AS rank, array_to_string(address(e), '.') AS address, notation(omega_ordinality(e)) AS omega, render(e) AS element, perm_descents((e).value) AS descents, perm_inversions((e).value) AS inversions, perm_cycle_count((e).value) AS cycles
  FROM elements(permutations(4), 2147483647) e)
SELECT row_number() OVER (ORDER BY size, rank) AS ordinality, *
FROM r
WHERE descents >= 2
ORDER BY size, rank

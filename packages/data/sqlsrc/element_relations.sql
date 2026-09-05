-- requires: realizer, statistics, integer_partitions, symmetry_orbit_maps, k_ary_word_classes, words
-- base_element_relation — a relation on a collection's OWN elements (friction 1 in the catalog audit): a poset's
-- covers, a graph's adjacency, or a group action's orbits. Where base_map/base_relation hold SINGLE-valued
-- CROSS-collection bijections, this holds a MULTI-valued relation keyed on ONE collection, whose function returns
-- CARRIER values — so it can cross fibers (Young's lattice: a partition of n covers up to n+1 partitions of n+1,
-- all on the SAME `integer_partition` carrier, just in the next fiber). Design: docs/design/element-relations.md.
--
-- forward_fn(x carrier) RETURNS SETOF carrier — the covers / neighbours / orbit of x. A relation with no cheap
-- successor instead names related_fn(x, y carrier) RETURNS boolean (the pair predicate); at least one is required.
-- canonical_fn (equivalence only, OPTIONAL) names an idempotent representative map carrier→carrier for the orbit's
-- kernel; when absent the representative is DERIVED as the rank-least member of forward_fn(x) (proven below).
CREATE TABLE base_element_relation (
  collection  text NOT NULL REFERENCES base_collection,
  rel_id      text NOT NULL,
  kind        text NOT NULL CHECK (kind IN ('cover', 'adjacency', 'equivalence')),
  forward_fn  text,
  related_fn  text,
  canonical_fn text,
  title       text,
  findstat    text,
  PRIMARY KEY (collection, rel_id),
  CHECK (forward_fn IS NOT NULL OR related_fn IS NOT NULL),
  CHECK (canonical_fn IS NULL OR kind = 'equivalence'));

-- ── cover (same fiber): permutations, right weak order ────────────────────────────────────────────────────
-- The up-covers of p: swap the two VALUES at an ascent (positions i, i+1 with p(i) < p(i+1)). Each such swap adds
-- exactly one inversion, so the cover lands one rank up in the graded poset (rank = inversions). This is the weak
-- (permutohedral) order; its Hasse diagram on S_n is the permutahedron's 1-skeleton.
CREATE FUNCTION perm_weak_order_covers(p permutation) RETURNS SETOF permutation LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW((p).image[1:i-1] || (p).image[i+1] || (p).image[i] || (p).image[i+2:])::permutation
    FROM generate_subscripts((p).image, 1) i
   WHERE i < array_length((p).image, 1) AND (p).image[i] < (p).image[i+1] $$;

-- ── cover (crossing fibers): integer_partitions, Young's lattice ─────────────────────────────────────────────
-- The up-covers of λ: add one cell — increment a part that stays ≤ its predecessor, or append a new part of 1.
-- Every result has |cells| + 1 cells, so it lives in the n+1 fiber of the SAME collection: the cover crosses fibers
-- with no separate codomain, because the carrier is shared and the function returns carrier values.
CREATE FUNCTION partition_young_covers(p integer_partition) RETURNS SETOF integer_partition LANGUAGE sql IMMUTABLE AS $$
  WITH s AS (SELECT (p).parts AS a, coalesce(array_length((p).parts, 1), 0) AS n)
  SELECT ROW(a[1:i-1] || (a[i] + 1) || a[i+1:])::integer_partition
    FROM s, generate_series(1, n) i
   WHERE i = 1 OR a[i-1] > a[i]
  UNION ALL
  SELECT ROW((p).parts || 1)::integer_partition FROM s $$;

-- ── equivalence: words, cyclic rotation orbits (necklaces) ───────────────────────────────────────────────────
-- The orbit of w under the cyclic group: all n rotations (deduplicated for periodic words). The canonical
-- representative is the lex-least rotation — the existing necklace map word_canonical_rotation (symmetry_orbit_maps).
-- GROUP BY that representative IS the orbit kernel (#203) — Pólya's orbit count as a plain query.
CREATE FUNCTION word_rotation_orbit(w word) RETURNS SETOF word LANGUAGE sql IMMUTABLE AS $$
  SELECT DISTINCT ROW(CASE WHEN d = 0 THEN (w).letters ELSE (w).letters[d+1:] || (w).letters[1:d] END)::word
    FROM generate_series(0, coalesce(array_length((w).letters, 1), 0) - 1) d $$;

-- ── the registry rows ────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_element_relation (collection, rel_id, kind, forward_fn, canonical_fn, title, findstat) VALUES
  ('permutations', 'weak_order', 'cover', 'perm_weak_order_covers', NULL,
   'right weak (permutohedral) order — covers swap the values at an ascent, adding one inversion', NULL),
  ('integer_partitions', 'young', 'cover', 'partition_young_covers', NULL,
   'Young''s lattice — covers add one cell, landing in the size n+1 fiber', NULL),
  ('words', 'rotation', 'equivalence', 'word_rotation_orbit', 'word_canonical_rotation',
   'cyclic rotation orbits (necklaces); canonical representative = lex-least rotation', NULL);

-- ── examples ─────────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  -- registry shape (floor, not an exact count — later batches add more relations/kinds; #171 convention)
  ('element_relations', 'at least the prototype rows are registered: cover >=2, equivalence >=1',
   'eq', 'true', 'the prototype rows, as a floor so later batches can add more',$q$
    SELECT (count(*) FILTER (WHERE kind = 'cover') >= 2 AND count(*) FILTER (WHERE kind = 'equivalence') >= 1)::text
      FROM base_element_relation $q$),
  ('element_relations', 'canonical_fn is present only on equivalence rows (CHECK guards the pairing), and covers the prototype''s words/rotation',
   'eq', 'true', 'a floor, not an exact list — later equivalence batches (#237) add more canonical_fn-bearing rows (post-#171 convention)',$q$
    SELECT (bool_and(kind = 'equivalence') AND bool_or(collection = 'words' AND rel_id = 'rotation'))::text
      FROM base_element_relation WHERE canonical_fn IS NOT NULL $q$),

  -- COVER (same fiber): permutations weak order --------------------------------------------------------------
  ('element_relations', 'weak-order covers of 213 = {231}: swap the single ascent (position 2)',
   'eq', '231', 'up-covers of a concrete permutation',$q$
    SELECT string_agg(one_line(c), ',' ORDER BY one_line(c)) FROM perm_weak_order_covers(ROW(ARRAY[2,1,3])::permutation) c $q$),
  ('element_relations', 'every weak-order cover adds exactly one inversion (rank = inversions is graded), S_2..S_4',
   'eq', 'true', 'the poset is graded by inversions',$q$
    SELECT bool_and(perm_inversions(c) = perm_inversions((e).value) + 1)::text
      FROM generate_series(2,4) n, LATERAL elements(permutations(n)) e, LATERAL perm_weak_order_covers((e).value) c $q$),
  ('element_relations', 'total weak-order covers on S_n = n!·(n−1)/2 (the permutahedron edge count), n=2..4',
   'eq', 'true', 'verified by enumeration against the closed form',$q$
    SELECT bool_and(edges = (factorial(n) * (n-1) / 2))::text FROM (
      SELECT n, count(*) edges FROM generate_series(2,4) n, LATERAL elements(permutations(n)) e,
             LATERAL perm_weak_order_covers((e).value) c GROUP BY n) t $q$),
  ('element_relations', 'weak order has a UNIQUE maximum: exactly one element of S_n has no up-cover (the reverse), n=2..4',
   'eq', 'true', 'lattice top is unique',$q$
    SELECT bool_and(tops = 1)::text FROM (
      SELECT n, count(*) tops FROM generate_series(2,4) n, LATERAL elements(permutations(n)) e
       WHERE NOT EXISTS (SELECT 1 FROM perm_weak_order_covers((e).value)) GROUP BY n) t $q$),
  -- crux (c): the UNDIRECTED cover graph is the permutahedron's 1-skeleton, which base_polytope already draws.
  ('element_relations', 'the undirected weak-order cover graph on S_n is (n−1)-regular = the permutahedron skeleton, n=2..4',
   'eq', 'true', 'up-degree + down-degree = ascents + descents = n−1 at every vertex (base_polytope edge data)',$q$
    SELECT bool_and(deg = n - 1)::text FROM (
      SELECT n, (e).value v,
             (SELECT count(*) FROM perm_weak_order_covers((e).value))
           + (SELECT count(*) FROM elements(permutations(n)) u
               WHERE (e).value IN (SELECT c FROM perm_weak_order_covers((u).value) c)) deg
        FROM generate_series(2,4) n, LATERAL elements(permutations(n)) e) t $q$),
  -- crux (d): rank = inversions; the rank-generating function is the inversion (Mahonian) distribution = [n]_q!.
  ('element_relations', 'weak-order rank-GF over S_4 = the Mahonian row 1,3,5,6,5,3,1 (coeffs of the q-factorial [4]_q!)',
   'eq', '1,3,5,6,5,3,1', 'GROUP BY rank(weak_order) is the #203 distribution kernel; rank = inversions',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (
      SELECT perm_inversions((e).value) k, count(*) c FROM elements(permutations(4)) e GROUP BY 1) t $q$),

  -- COVER (crossing fibers): Young's lattice ------------------------------------------------------------------
  ('element_relations', 'Young covers of 2+1 = {2+1+1, 2+2, 3+1}: add one cell each way',
   'eq', '2+1+1,2+2,3+1', 'up-covers cross into the size-4 fiber',$q$
    SELECT string_agg(notation(c), ',' ORDER BY notation(c)) FROM partition_young_covers(ROW(ARRAY[2,1])::integer_partition) c $q$),
  ('element_relations', 'every Young cover lands in the n+1 fiber (sum of parts increases by one), n=0..7',
   'eq', 'true', 'the cross-fiber claim: covers of a size-n partition all have size n+1',$q$
    SELECT bool_and((SELECT coalesce(sum(x),0) FROM unnest((c).parts) x)
                  = (SELECT coalesce(sum(x),0) FROM unnest(((e).value).parts) x) + 1)::text
      FROM generate_series(0,7) n, LATERAL elements(integer_partitions(n)) e, LATERAL partition_young_covers((e).value) c $q$),
  ('element_relations', 'every Young cover is a VALID partition (non-increasing, positive parts), n=0..7',
   'eq', 'true', 'the successor stays in the carrier',$q$
    SELECT bool_and(contains(integer_partitions((SELECT sum(x)::int FROM unnest((c).parts) x)), c))::text
      FROM generate_series(0,7) n, LATERAL elements(integer_partitions(n)) e, LATERAL partition_young_covers((e).value) c $q$),
  ('element_relations', 'number of Young up-covers of λ = (distinct part sizes) + 1, n=0..7',
   'eq', 'true', 'addable-cell count identity',$q$
    SELECT bool_and(k = distinct_parts + 1)::text FROM (
      SELECT (e).value v, count(c.*) k, (SELECT count(DISTINCT x) FROM unnest(((e).value).parts) x) distinct_parts
        FROM generate_series(0,7) n, LATERAL elements(integer_partitions(n)) e, LATERAL partition_young_covers((e).value) c
       GROUP BY (e).value) t $q$),

  -- EQUIVALENCE: rotation orbits ------------------------------------------------------------------------------
  ('element_relations', 'rotation orbit of the word 1121 over base 2 = its 4 distinct rotations',
   'eq', '1112,1121,1211,2111', 'the orbit as a set of carrier values',$q$
    SELECT string_agg(array_to_string((o).letters,''), ',' ORDER BY array_to_string((o).letters,''))
      FROM word_rotation_orbit(ROW(ARRAY[1,1,2,1])::word) o $q$),
  ('element_relations', 'the orbit is a well-defined class: every member shares one canonical representative, words(4,2)',
   'eq', 'true', 'orbit:<rel> is the kernel of the representative map',$q$
    SELECT bool_and(word_canonical_rotation(o) = word_canonical_rotation((e).value))::text
      FROM elements(words(4,2)) e, LATERAL word_rotation_orbit((e).value) o $q$),
  ('element_relations', 'the DERIVED representative (rank-least orbit member) equals the declared canonical_fn, words(4,2)',
   'eq', 'true', 'canonical_fn is optional — absent, the rep is the least member of forward_fn(x)',$q$
    SELECT bool_and(
      word_canonical_rotation((e).value) =
      (SELECT o FROM word_rotation_orbit((e).value) o ORDER BY (o).letters LIMIT 1))::text
      FROM elements(words(4,2)) e $q$),
  ('element_relations', 'orbit count over words(n,2) = the necklace count (one canonical rep per orbit), n=1..6',
   'eq', 'true', 'GROUP BY orbit:rotation = the Pólya count = the registered necklace restriction',$q$
    SELECT bool_and(reps = necklaces)::text FROM (
      SELECT n,
             (SELECT count(DISTINCT word_canonical_rotation((e).value)) FROM elements(words(n,2)) e) reps,
             (SELECT count(*) FROM elements(words(n,2)) e WHERE is_word_necklace((e).value)) necklaces
        FROM generate_series(1,6) n) t $q$);

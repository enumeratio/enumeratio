-- requires: permutations, statistics, element_relations, references
-- permutations — element-relations batch 1 of #237 (the "Permutations" group): strong Bruhat order (cover),
-- cyclic-shift adjacency, and the weak-order rank / rank-GF confirmation (design crux (d)). Additions here are
-- disjoint from element_relations.sql — that file stays the model's grounding prototype; this file is the first
-- data batch built on top of it. See docs/design/element-relations.md.

-- ── cover: permutations, strong Bruhat order ─────────────────────────────────────────────────────────────────
-- Standard combinatorial cover test (Björner–Brenti, Prop 2.2.7): x ⋖ y in Bruhat order iff y is obtained from x
-- by transposing a pair of positions i < j with x(i) < x(j), where no k strictly between i and j carries a value
-- strictly between x(i) and x(j) — the "no value in between" condition. Unlike weak order (adjacent transpositions
-- only, j = i+1), Bruhat allows any i < j, so it is the COARSER order: every weak-order cover is a Bruhat-order
-- cover too (asserted below), but Bruhat has more of them. Both are graded by inversions — a Bruhat cover also
-- adds exactly one inversion.
CREATE FUNCTION perm_bruhat_covers(p permutation) RETURNS SETOF permutation LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW((p).image[1:i-1] || (p).image[j] || (p).image[i+1:j-1] || (p).image[i] || (p).image[j+1:])::permutation
    FROM generate_subscripts((p).image, 1) i, generate_subscripts((p).image, 1) j
   WHERE i < j AND (p).image[i] < (p).image[j]
     AND NOT EXISTS (SELECT 1 FROM generate_series(i+1, j-1) k
                       WHERE (p).image[i] < (p).image[k] AND (p).image[k] < (p).image[j]) $$;

-- ── adjacency: permutations, cyclic-shift ────────────────────────────────────────────────────────────────────
-- x ~ its cyclic shift: rotate the one-line word by one position, either direction (first entry to the end, or
-- last entry to the front). The two directions are mutual inverses, so the relation is symmetric by construction
-- (y = left-shift(x) implies x = right-shift(y)). Distinct values in an n-permutation force a full n-cycle under
-- iterated rotation (n ≥ 3: degree 2, one undirected edge set of size n! over S_n — the (n−1)! circular
-- arrangements each contributing an n-cycle of edges); n ≤ 2 degenerates (the two shifts coincide).
CREATE FUNCTION perm_cyclic_shift_neighbors(p permutation) RETURNS SETOF permutation LANGUAGE sql IMMUTABLE AS $$
  WITH s AS (SELECT (p).image AS a, coalesce(array_length((p).image, 1), 0) AS n)
  SELECT DISTINCT ROW(x)::permutation FROM s, LATERAL (VALUES
    (a[2:n] || a[1:1]),      -- shift left: first entry rotates to the end
    (a[n:n] || a[1:n-1])     -- shift right: last entry rotates to the front
  ) AS t(x) $$;

-- ── the registry rows ────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_element_relation (collection, rel_id, kind, forward_fn, canonical_fn, title, findstat) VALUES
  ('permutations', 'strong_bruhat', 'cover', 'perm_bruhat_covers', NULL,
   'strong Bruhat order — covers transpose positions i<j with no value strictly between x(i),x(j) sitting between them; coarser than weak order', NULL),
  ('permutations', 'cyclic_shift', 'adjacency', 'perm_cyclic_shift_neighbors', NULL,
   'cyclic-shift adjacency — x is adjacent to its one-line rotations (first entry to the end, or last entry to the front)', NULL);

-- ── examples ─────────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES

  -- STRONG BRUHAT ORDER ----------------------------------------------------------------------------------------
  ('element_relations', 'Bruhat covers of 2134 = {2143, 2314, 3124}: not just the adjacent-transposition swap',
   'eq', '2143,2314,3124', 'a non-adjacent cover (positions 1,4: swap 2 and 4) alongside the adjacent ones',$q$
    SELECT string_agg(one_line(c), ',' ORDER BY one_line(c)) FROM perm_bruhat_covers(ROW(ARRAY[2,1,3,4])::permutation) c $q$),
  ('element_relations', 'every Bruhat cover adds exactly one inversion (graded by length, same rank as weak order), S_2..S_4',
   'eq', 'true', 'the poset is graded by inversions',$q$
    SELECT bool_and(perm_inversions(c) = perm_inversions((e).value) + 1)::text
      FROM generate_series(2,4) n, LATERAL elements(permutations(n)) e, LATERAL perm_bruhat_covers((e).value) c $q$),
  ('element_relations', 'every weak-order cover is also a Bruhat-order cover (weak order refines/sits inside Bruhat), S_2..S_4',
   'eq', 'true', 'weak order allows only adjacent transpositions; Bruhat allows any i<j meeting the no-value-between test',$q$
    SELECT bool_and(w IN (SELECT c FROM perm_bruhat_covers((e).value) c))::text
      FROM generate_series(2,4) n, LATERAL elements(permutations(n)) e, LATERAL perm_weak_order_covers((e).value) w $q$),
  ('element_relations', 'total Bruhat covers on S_n, n=1..4: 0,1,8,58 (strictly more than weak order''s n!(n-1)/2)',
   'eq', '0,1,8,58', 'brute-force cover count against the combinatorial definition',$q$
    SELECT string_agg((SELECT count(*) FROM elements(permutations(n)) e, LATERAL perm_bruhat_covers((e).value) c)::text, ',' ORDER BY n)
      FROM generate_series(1,4) n $q$),

  -- CYCLIC-SHIFT ADJACENCY --------------------------------------------------------------------------------------
  ('element_relations', 'cyclic-shift neighbours of 2413 = {3241, 4132}: rotate left / rotate right',
   'eq', '3241,4132', 'the two one-line rotations of a concrete permutation',$q$
    SELECT string_agg(one_line(c), ',' ORDER BY one_line(c)) FROM perm_cyclic_shift_neighbors(ROW(ARRAY[2,4,1,3])::permutation) c $q$),
  ('element_relations', 'cyclic-shift adjacency is symmetric: y a neighbour of x implies x a neighbour of y, S_3..S_4',
   'eq', 'true', 'the two rotation directions are mutual inverses',$q$
    SELECT bool_and((e).value IN (SELECT c2 FROM perm_cyclic_shift_neighbors(c) c2))::text
      FROM generate_series(3,4) n, LATERAL elements(permutations(n)) e, LATERAL perm_cyclic_shift_neighbors((e).value) c $q$),
  ('element_relations', 'every permutation has exactly 2 distinct cyclic-shift neighbours once n>=3 (degree-2, n<=2 degenerates)',
   'eq', 'true', 'distinct values force a full n-cycle under rotation for n>=3',$q$
    SELECT bool_and(deg = 2)::text FROM (
      SELECT (e).value v, count(*) deg FROM generate_series(3,4) n, LATERAL elements(permutations(n)) e,
             LATERAL perm_cyclic_shift_neighbors((e).value) c GROUP BY (e).value) t $q$),
  ('element_relations', 'undirected cyclic-shift edge count on S_n = n! for n=3,4 (n! / n circular arrangements, each an n-cycle of n edges)',
   'eq', '6,24', 'the (n-1)! orbits under rotation, each contributing n undirected edges',$q$
    SELECT string_agg(edges::text, ',' ORDER BY n) FROM (
      SELECT n, count(DISTINCT LEAST(one_line((e).value), one_line(c)) || '|' || GREATEST(one_line((e).value), one_line(c))) edges
        FROM generate_series(3,4) n, LATERAL elements(permutations(n)) e, LATERAL perm_cyclic_shift_neighbors((e).value) c
       GROUP BY n) t $q$),

  -- RANK / RANK-GF (crux d): weak order's rank IS the existing inversions stat, no new column ------------------
  ('element_relations', 'rank(weak_order) is the EXISTING inversions stat (crux d): a derived stat, not a new registry column',
   'eq', 'inversions|St000018', 'confirms the seed''s stat + FindStat cross-reference resolve, per the doc''s recommendation',$q$
    SELECT bs.stat_id || '|' || br.identity
      FROM base_stat bs JOIN base_reference br
        ON br.subject_kind = 'stat' AND br.subject = 'permutations.inversions' AND br.system = 'findstat'
     WHERE bs.collection = 'permutations' AND bs.value_fn = 'perm_inversions' $q$),
  ('element_relations', 'weak-order rank-GF over S_4 = the Mahonian row 1,3,5,6,5,3,1 (coeffs of the q-factorial [4]_q!)',
   'eq', '1,3,5,6,5,3,1', 'GROUP BY rank(weak_order) = GROUP BY inversions — the #203 distribution kernel over the rank stat',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (
      SELECT perm_inversions((e).value) k, count(*) c FROM elements(permutations(4)) e GROUP BY 1) t $q$);

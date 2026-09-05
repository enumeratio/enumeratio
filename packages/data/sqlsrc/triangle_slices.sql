-- requires: realizer
-- Number-triangle slicing, DATA-DRIVEN. A "number triangle" is any (n,k)-graded collection whose fiber
-- CARDINALITIES tabulate a triangular array T(n,k) — k_subsets → Pascal, set_partitions_into_k_blocks →
-- Stirling-2, narayana_numbers → Narayana, and so on. base_triangle names such a collection plus the two axis
-- names (the row axis n, the column axis k); the slice functions then read row / column / diagonal sequences off
-- the triangle uniformly, dispatching on the collection's own generated surface (fibers + cardinality). The slice
-- value is always the fiber cardinality, so slicing works the same regardless of what the elements are.

-- base_triangle: the number-triangle registry — one row per (n,k)-graded collection presented as a triangle, with
-- the row axis (grade 1) and column axis (grade 2) NAMES. Modelled after base_polytope (another cast of the element
-- data): the registry is the whole configuration, the generic functions below read it. No FK on `collection` so the
-- seed loads independent of collection load order (mirrors base_collection_meta / base_oeis).
-- `sequence` (nullable): the base number sequence a(n) recovered by the triangle's ROW-SUM Σ_k T(n,k) — the sense in
-- which a triangle is an ALIAS of a grade-axis configuration of that sequence (refract a(n) by the column axis k and
-- the fiber counts ARE the triangle; sum them back and you have a(n) again). cardinality(<coll>(n)) already sums the
-- fibers, so the identity is simply cardinality(<coll>(n)) = a(n); asserted below for every registered pair. NULL where
-- the row-sum sequence isn't its own realized collection yet (compositions' 2^{n−1}, etc.).
CREATE TABLE base_triangle (collection text PRIMARY KEY, row_axis text NOT NULL, col_axis text NOT NULL, title text, sequence text);

-- ── the "one-engine alias" (exploration, issue #43) ────────────────────────────────────────────────────────────────
-- The clean framing is: a triangle T(n,k) is just the base sequence a(n) refracted by the column axis k, so ideally you
-- author ONE engine and read both off it. In practice the alias only runs ONE way, and knowing which way is the point:
--   • Triangle ⟶ sequence (works today): the sequence IS the row-sums. Σ_k T(n,k) = cardinality(<triangle>(n)) = a(n).
--     triangle_rowsum already gives this for free; a homeless row-sum could even be realized as a thin view whose floor
--     is `cardinality(<triangle>(r))`, needing NO independent math. We deliberately DON'T do that for the registered
--     pairs: an independently-authored closed form (2^n by doubling; Fubini's binomial-convolution recurrence, reused
--     from set_compositions.fubini) makes `Σ_k T(n,k) = a(n)` a real accelerated-vs-naive oracle instead of a tautology.
--   • Sequence ⟶ triangle (NOT feasible yet): you can't recover the triangle from the bare sequence — the k-grading
--     lives in the triangle collection's ELEMENTS (a subset has a size k; a surjection has an image size k), not in the
--     numeric row-sum. Expressing k_subsets as `powers_of_two graded by k` would require the sequence's carrier to
--     carry that per-element statistic — i.e. to already BE the rich collection. So the rich (n,k)-graded collection
--     stays the single engine; the sequence is its downstream row-sum, and that's as unified as the current model gets.
-- Deferred: a genuine one-engine authoring path (grade a sequence by a derived per-element statistic) needs engine
-- support the numeric carrier lacks; revisit alongside the grouping/grade-axis tier, not here.

-- triangle_cells(coll, n_max): every cell (row_index, col_index, value) of the triangle for rows 0..n_max, where
-- value = the fiber cardinality. Reuses the collection's own constructor <coll>(n): binding the row axis to a point
-- leaves the column axis free over its declared [lo,hi], so fibers(<coll>(n)) yields exactly the valid k per row.
CREATE FUNCTION triangle_cells(coll text, n_max int)
  RETURNS TABLE(row_index numeric, col_index numeric, value cardinal) LANGUAGE plpgsql STABLE AS $$
  DECLARE t base_triangle%ROWTYPE;
  BEGIN
    SELECT * INTO t FROM base_triangle WHERE collection = coll;
    IF NOT FOUND THEN RAISE EXCEPTION 'no triangle registered for collection %', coll; END IF;
    RETURN QUERY EXECUTE format(
      'SELECT (f).%I::numeric, (f).%I::numeric, cardinality(f) '
      'FROM generate_series(0, $1) n, LATERAL fibers(%I(n::numeric)) f',
      t.row_axis, t.col_axis, coll) USING n_max;
  END $$;

-- triangle_row(coll, n): fix the row axis at n, vary the column axis — the n-th ROW of the triangle. Reads the
-- collection's own k-range for that n straight off fibers(<coll>(n)), so no upper bound is needed (k ≤ n).
CREATE FUNCTION triangle_row(coll text, n numeric)
  RETURNS TABLE(col_index numeric, value cardinal) LANGUAGE plpgsql STABLE AS $$
  DECLARE t base_triangle%ROWTYPE;
  BEGIN
    SELECT * INTO t FROM base_triangle WHERE collection = coll;
    IF NOT FOUND THEN RAISE EXCEPTION 'no triangle registered for collection %', coll; END IF;
    RETURN QUERY EXECUTE format(
      'SELECT (f).%I::numeric, cardinality(f) FROM fibers(%I($1)) f ORDER BY 1',
      t.col_axis, coll) USING n;
  END $$;

-- triangle_column(coll, k, n_max): fix the column axis at k, vary the row axis over 0..n_max — a COLUMN. The column
-- is unbounded below in n, so it takes an explicit n_max.
CREATE FUNCTION triangle_column(coll text, k numeric, n_max int)
  RETURNS TABLE(row_index numeric, value cardinal) LANGUAGE sql STABLE AS $$
  SELECT c.row_index, c.value FROM triangle_cells(coll, n_max) c WHERE c.col_index = k ORDER BY c.row_index $$;

-- triangle_diagonal(coll, d, n_max): fix n − k = d, vary over 0..n_max — a DIAGONAL (d = 0 is the k = n edge).
CREATE FUNCTION triangle_diagonal(coll text, d numeric, n_max int)
  RETURNS TABLE(row_index numeric, col_index numeric, value cardinal) LANGUAGE sql STABLE AS $$
  SELECT c.row_index, c.col_index, c.value FROM triangle_cells(coll, n_max) c
   WHERE c.row_index - c.col_index = d ORDER BY c.row_index $$;

-- triangle_rowsum(coll, n): Σ_k T(n,k) — the base sequence's n-th term, read off the triangle. Equals
-- cardinality(<coll>(n)) (which already sums the fibers); named for the sequence-recovery reading.
CREATE FUNCTION triangle_rowsum(coll text, n numeric) RETURNS cardinal LANGUAGE sql STABLE AS $$
  SELECT coalesce(sum(value::numeric), 0)::cardinal FROM triangle_row(coll, n) $$;

-- sequence_term(seq, n): the n-th term (0-based) of an ungraded number-sequence collection, via its realized floor —
-- the other side of the row-sum identity.
CREATE FUNCTION sequence_term(seq text, n int) RETURNS numeric LANGUAGE plpgsql STABLE AS $$
  DECLARE v numeric; BEGIN EXECUTE format('SELECT (unrank(%I(), %s)).value::numeric', seq, n) INTO v; RETURN v; END $$;

-- The seed: the (n,k)-graded collections whose fiber counts form a named number triangle. Every one carries the
-- exact [n,k] grade chain (row axis n, column axis k); Schröder is excluded (schroeder_paths is n-only, not (n,k)).
-- `sequence` is set where the row-sum is a realized number-sequence collection (Pascal → powers_of_two, Stirling-2 →
-- Bell, Narayana → Catalan, k-part → partition, surjections → Fubini); NULL where that sequence isn't its own
-- collection yet (compositions → 2^{n−1}, weak compositions, Gelfand–Tsetlin, …).
-- (surjections_onto_k/k_cycle_permutations/k_descent_permutations rows moved to
-- packs/permutations-plus/triangle_slices.permutations-plus.sql — #283 phase 3; base_triangle itself has no FK,
-- but the row-specific examples below call these collections' constructors directly)
INSERT INTO base_triangle (collection, row_axis, col_axis, title, sequence) VALUES
  ('k_subsets',                  'n', 'k', 'Pascal''s triangle — C(n,k)', 'powers_of_two'),
  ('set_partitions_into_k_blocks', 'n', 'k', 'Stirling numbers of the 2nd kind — S(n,k)', 'bell_numbers'),
  ('compositions_into_k_parts',    'n', 'k', 'Compositions of n into k parts — C(n−1,k−1)', NULL),
  ('weak_compositions_into_k_parts','n','k', 'Weak compositions of n into k parts — C(n+k−1,k−1)', NULL),
  ('narayana_numbers',             'n', 'k', 'Narayana numbers — N(n,k)', 'catalan_numbers'),
  ('gelfand_tsetlin',              'n', 'k', 'Gelfand–Tsetlin patterns by size and entry bound', NULL),
  ('k_dyck_paths',                 'n', 'k', 'k-Dyck paths by semilength and order', NULL);

-- living assertions: the slice machinery against known triangle rows / a column / a diagonal (suite is cross-cutting,
-- so these stay collection = NULL like the maps / boundary suites).
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('triangles','Pascal row n=4 = 1,4,6,4,1 (k_subsets)','eq','1,4,6,4,1','C(4,k) for k=0..4',$q$
    SELECT string_agg(value::text, ',' ORDER BY col_index) FROM triangle_row('k_subsets', 4) $q$),
  ('triangles','Stirling-2 row n=4 = 1,7,6,1 (set_partitions_into_k_blocks)','eq','1,7,6,1','S(4,k) for k=1..4',$q$
    SELECT string_agg(value::text, ',' ORDER BY col_index) FROM triangle_row('set_partitions_into_k_blocks', 4) $q$),
  ('triangles','Narayana row n=4 = 1,6,6,1 (narayana_numbers)','eq','1,6,6,1','N(4,k) for k=1..4, sums to Catalan 14',$q$
    SELECT string_agg(value::text, ',' ORDER BY col_index) FROM triangle_row('narayana_numbers', 4) $q$),
  ('triangles','Pascal column k=2 up to n=5 = 1,3,6,10','eq','1,3,6,10','C(n,2) for n=2..5',$q$
    SELECT string_agg(value::text, ',' ORDER BY row_index) FROM triangle_column('k_subsets', 2, 5) $q$),
  ('triangles','Pascal diagonal n−k=1 up to n=4 = 1,2,3,4','eq','1,2,3,4','C(n,n−1) for n=1..4',$q$
    SELECT string_agg(value::text, ',' ORDER BY row_index) FROM triangle_diagonal('k_subsets', 1, 4) $q$),
  -- the alias identity, data-driven off base_triangle: every triangle carrying a `sequence` has row-sums that recover
  -- it. Adding a (triangle, sequence) pair extends this check for free — a special case of accelerated==naive (the
  -- closed-form triangle counts, summed, must equal the closed-form sequence term).
  ('triangles','every registered triangle''s row-sum recovers its base sequence (n=1..6)','eq','all-match',
   'Σ_k T(n,k) = a(n) for each base_triangle row that names a sequence',$q$
    SELECT coalesce(string_agg(t.collection || '(' || bad.n || ')', ', '), 'all-match')
    FROM (SELECT collection, sequence FROM base_triangle WHERE sequence IS NOT NULL) t, LATERAL (
      SELECT n FROM generate_series(1, 6) n
      WHERE triangle_rowsum(t.collection, n)::numeric IS DISTINCT FROM sequence_term(t.sequence, n)
    ) bad $q$),
  ('triangles','Narayana row-sum is the Catalan sequence (1,2,5,14,42,132)','eq','1,2,5,14,42,132',
   'triangle_rowsum(narayana_numbers, n) = C(n)',$q$
    SELECT string_agg(triangle_rowsum('narayana_numbers', n)::text, ',' ORDER BY n) FROM generate_series(1,6) n $q$),
  ('triangles','Pascal row-sum is powers of two (Σ_k C(n,k) = 2^n, n=0..6)','eq','1,2,4,8,16,32,64',
   'triangle_rowsum(k_subsets, n) = 2^n, the newly-registered powers_of_two sequence',$q$
    SELECT string_agg(triangle_rowsum('k_subsets', n)::text, ',' ORDER BY n) FROM generate_series(0,6) n $q$);
  -- (the surjection-triangle/cycle-triangle/Eulerian-triangle row + row-sum examples moved to
  -- packs/permutations-plus/triangle_slices.permutations-plus.sql — #283 phase 3, same reason as their
  -- base_triangle rows above)

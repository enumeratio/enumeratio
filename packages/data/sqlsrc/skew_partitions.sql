-- requires: realizer, utilities
-- skew_partitions — REDUCED skew partitions λ/μ with n cells (a FindStat collection; sage SkewPartitions(n)). A skew
-- partition is a pair μ ⊆ λ; "reduced" = the skew diagram has no empty row and no empty column. Carried as the pair
-- (lam = λ, mu = μ), rendered λ/μ (e.g. 2,1/1). count = 1,1,3,9,28,87,… (no simple closed form — counted from the
-- floor). The floor builds each shape a row at a time as an interval [a_i, b_i] = [μ_i+1, λ_i]: a and b both weakly
-- decrease (λ, μ partitions), a_i ≤ b_i makes every row non-empty (row-reduced by construction), and a column-reduced
-- filter drops shapes with a gap column. row i contributes b_i − a_i + 1 cells; a shape is complete when they sum to n.

-- ── carrier ────────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE skew_partition AS (lam int[], mu int[]);                 -- outer λ and inner μ, both non-increasing, μ ⊆ λ
CREATE FUNCTION notation(s skew_partition) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT array_to_string((s).lam, ',') || '/' || array_to_string((s).mu, ',') $$;   -- λ/μ, e.g. 2,1/1 (μ empty ⇒ 2/)

-- column-reduced: every column 1..λ_1 (= max end col) is covered by some row's interval [a_i, b_i].
CREATE FUNCTION skew_col_reduced(a_starts int[], b_ends int[]) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM generate_series(1, coalesce(b_ends[1], 0)) j
     WHERE NOT EXISTS (SELECT 1 FROM generate_subscripts(b_ends,1) i WHERE a_starts[i] <= j AND j <= b_ends[i])) $$;

-- ── the engines a collection provides ──────────────────────────────────────────────────────────────────
CREATE TYPE skew_partitions_fiber AS (size natural_number);   -- typed fiber; axis: size
CREATE FUNCTION fiber_elements(f skew_partitions_fiber, element_limit int) RETURNS SETOF skew_partition LANGUAGE sql STABLE AS $$
  WITH RECURSIVE build AS (
    SELECT ARRAY[]::int[] AS a_starts, ARRAY[]::int[] AS b_ends, 0 AS cells
    UNION ALL
    SELECT b.a_starts || a, b.b_ends || bb, b.cells + (bb - a + 1)
      FROM build b,
           LATERAL generate_series(1, coalesce(b.b_ends[array_length(b.b_ends,1)], (f).size::int)) bb,   -- b ≤ prev b (λ non-incr)
           LATERAL generate_series(1, least(bb, coalesce(b.a_starts[array_length(b.a_starts,1)], (f).size::int))) a  -- a ≤ b and a ≤ prev a
     WHERE b.cells + (bb - a + 1) <= (f).size::int
  )
  SELECT ROW(b_ends, ARRAY(SELECT a_starts[i] - 1 FROM generate_subscripts(a_starts,1) i WHERE a_starts[i] - 1 > 0))::skew_partition
    FROM build
   WHERE cells = (f).size::int AND skew_col_reduced(a_starts, b_ends)
   ORDER BY b_ends, a_starts
   LIMIT element_limit $$;
CREATE FUNCTION contains_in_fiber(f skew_partitions_fiber, v skew_partition) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE lam int[] := (v).lam; mu int[] := (v).mu; nl int; a_starts int[] := '{}'; b_ends int[] := '{}'; i int;
  BEGIN
    nl := coalesce(array_length(lam,1), 0);
    IF coalesce(array_length(mu,1),0) > nl THEN RETURN false; END IF;                                   -- μ has more rows than λ
    IF coalesce((SELECT sum(x) FROM unnest(lam) x),0) - coalesce((SELECT sum(x) FROM unnest(mu) x),0) <> (f).size::int THEN RETURN false; END IF;
    FOR i IN 1..nl LOOP
      IF lam[i] < 1 OR (i > 1 AND lam[i] > lam[i-1]) THEN RETURN false; END IF;                          -- λ positive, non-increasing
      IF coalesce(mu[i],0) >= lam[i] THEN RETURN false; END IF;                                          -- row-reduced (⇒ μ_i < λ_i ≤ λ)
      IF i > 1 AND coalesce(mu[i],0) > coalesce(mu[i-1],0) THEN RETURN false; END IF;                    -- μ non-increasing
      a_starts := a_starts || (coalesce(mu[i],0) + 1); b_ends := b_ends || lam[i];
    END LOOP;
    RETURN skew_col_reduced(a_starts, b_ends);
  END $$;

-- ── declare as DATA + realize ──────────────────────────────────────────────────────────────────────────
INSERT INTO base_collection VALUES ('skew_partitions', 'skew_partition');
INSERT INTO base_grade VALUES ('skew_partitions', 1, 'size', NULL, NULL);
SELECT base_realize('skew_partitions');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('skew_partitions','anchor: |skew_partitions(n)| for n=0..5 is 1,1,3,9,28,87','eq','1,1,3,9,28,87','reduced skew shapes with n cells',$q$
    SELECT string_agg(cardinality(skew_partitions(n))::text, ',' ORDER BY n) FROM generate_series(0,5) n $q$),
  ('skew_partitions','the 3 reduced skew shapes with 2 cells','eq','1,1/,2/,2,1/1','the column, the row, the hook',$q$
    SELECT string_agg(render(e), ',' ORDER BY ordinality(e)) FROM elements(skew_partitions(2)) e $q$),
  ('skew_partitions','render λ/μ: (2,1)/(1) is 2,1/1','eq','2,1/1','outer 2,1 over inner 1',$q$
    SELECT notation(ROW(ARRAY[2,1], ARRAY[1])::skew_partition) $q$),
  ('skew_partitions','contains via <@: 2,1/1 ∈ skew_partitions(2); a non-reduced 3/1 (empty column) ∉','eq','true|false','the reduced condition',$q$
    SELECT (ROW(ARRAY[2,1], ARRAY[1])::skew_partition <@ skew_partitions(2))::text || '|' ||
           (ROW(ARRAY[3], ARRAY[1])::skew_partition <@ skew_partitions(2))::text $q$),
  ('skew_partitions','every element of skew_partitions(3) has exactly 3 cells (|λ| − |μ|)','eq','true','the defining invariant',$q$
    SELECT bool_and((SELECT coalesce(sum(x),0) FROM unnest(((e).value).lam) x) -
                    (SELECT coalesce(sum(x),0) FROM unnest(((e).value).mu) x) = 3)::text FROM elements(skew_partitions(3)) e $q$),
  ('skew_partitions','range constructor skew_partitions(0,3): fibers unfold to sizes 0,1,2,3','eq','0,1,2,3','the (lo,hi) range form',$q$
    SELECT string_agg((f).size::text, ',' ORDER BY (f).size) FROM fibers(skew_partitions(0,3)) f $q$);

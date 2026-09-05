-- requires: permutations, realizer, utilities
-- affine_permutations — the affine symmetric group Ã_{n−1} (level 0), the group whose permutohedron is the
-- tessellation of the finite one. An element is a window [a_1,…,a_n] of integers, distinct mod n, summing to
-- n(n+1)/2; it extends to a bijection Z→Z by a_{i+n} = a_i + n. Ã ≅ S_n ⋉ (root lattice): a_i = u(i) + n·c_i with
-- u ∈ S_n and c ∈ Z^n, Σc = 0 — the finite permutation u plus a lattice translation c (which tile of the
-- tessellation). Since Ã is INFINITE, this first pass bounds the translation to a box |c_i| ≤ r: two grades
-- (n, radius). r = 0 is exactly S_n; larger r reaches farther tiles. (A length-graded sibling can come later,
-- related to this one by a map.)

-- ── carrier ──────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE affine_permutation AS (affine_window int[]);
CREATE FUNCTION notation(w affine_permutation) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT '[' || array_to_string((w).affine_window, ',') || ']' $$;

-- # integer vectors in [-r,r]^n summing to 0 (the bounded root-lattice box), by a convolution DP.
CREATE FUNCTION affine_lattice_count(n int, r int) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE off int := n * r; dp numeric[]; ndp numeric[]; i int; s int; v int;
  BEGIN
    dp := array_fill(0::numeric, ARRAY[2 * n * r + 1]); dp[off + 1] := 1;           -- start: the empty sum = 0
    FOR i IN 1..n LOOP
      ndp := array_fill(0::numeric, ARRAY[2 * n * r + 1]);
      FOR s IN 1..(2 * n * r + 1) LOOP
        IF dp[s] <> 0 THEN FOR v IN -r..r LOOP
          IF s + v BETWEEN 1 AND 2 * n * r + 1 THEN ndp[s + v] := ndp[s + v] + dp[s]; END IF;
        END LOOP; END IF;
      END LOOP;
      dp := ndp;
    END LOOP;
    RETURN dp[off + 1];
  END $$;

-- ── the engines a collection provides ────────────────────────────────────────────────────────────────
-- every (finite permutation u ∈ S_n) × (lattice vector c ∈ [-r,r]^n, Σc = 0): window a_i = u(i) + n·c_i.
CREATE TYPE affine_permutations_fiber AS (n natural_number, radius natural_number);   -- typed fiber; axes: n, radius
CREATE FUNCTION fiber_elements(f affine_permutations_fiber, element_limit int) RETURNS SETOF affine_permutation LANGUAGE sql STABLE AS $$
  WITH RECURSIVE cbox(c, i, s) AS (
    SELECT ARRAY[]::int[], 0, 0
    UNION ALL
    SELECT cbox.c || v, cbox.i + 1, cbox.s + v
    FROM cbox, generate_series(-(f).radius::int, (f).radius::int) v
    WHERE cbox.i < (f).n::int)
  SELECT ROW(ARRAY(SELECT u.img[k] + (f).n::int * l.c[k] FROM generate_subscripts(u.img, 1) k))::affine_permutation
  FROM (SELECT ((e).value).image AS img FROM elements(permutations((f).n::int), 2147483647) e) u,   -- ALL of S_n, not element_limit: the
       (SELECT c FROM cbox WHERE i = (f).n::int AND s = 0) l                                         -- final ORDER BY re-sorts by window
  ORDER BY 1 LIMIT element_limit $$;   -- value (dominated by c, not u's rank), so truncating u before the cross product drops the wrong ones
CREATE FUNCTION fiber_count(f affine_permutations_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT factorial((f).n::int) * affine_lattice_count((f).n::int, (f).radius::int) $$;
CREATE FUNCTION contains_in_fiber(f affine_permutations_fiber, v affine_permutation) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((v).affine_window, 1), 0) = (f).n::int
     AND (SELECT coalesce(sum(x), 0) FROM unnest((v).affine_window) x) = (f).n::int * ((f).n::int + 1) / 2   -- level 0
     AND (SELECT count(DISTINCT ((x % (f).n::int) + (f).n::int) % (f).n::int) = (f).n::int FROM unnest((v).affine_window) x)  -- distinct mod n
     AND NOT EXISTS (SELECT 1 FROM unnest((v).affine_window) WITH ORDINALITY t(x, i)                          -- translation within the box
                     WHERE abs((x - (((x - 1) % (f).n::int + (f).n::int) % (f).n::int + 1)) / (f).n::int) > (f).radius::int) $$;

-- direct unrank: the floor's ORDER BY sorts by the window array a_1..a_n itself (lexicographic on the composite,
-- "dominated by c not u's rank" per the comment above) — NOT nested lex on u then c. But a_i = u(i) + n·c_i with
-- u(i) ∈ {1..n} always the residue-in-range representative, so (u(i), c_i) is recoverable from a_i alone and the
-- candidate set at each position is exactly {unused u-value} × {c ∈ [-r,r]}, sorted by the combined value
-- u+n·c (ties impossible: u ranges only over 1..n, strictly inside one c-step of size n). The key simplification:
-- completions from m remaining positions needing a given remaining Σc are INDEPENDENT of which u-values remain —
-- only their count m matters (any bijection remaining-positions→remaining-values contributes the same lattice
-- count) — so completions(m, need) = m! · L(m, need), L built once as the generalized convolution DP (a
-- straightforward extension of affine_lattice_count to an arbitrary target sum, kept per-row so every m ≤ n is
-- available during unrank).
CREATE FUNCTION fiber_unrank(f affine_permutations_fiber, rank rank_index) RETURNS affine_permutation LANGUAGE plpgsql IMMUTABLE AS $fu$
  DECLARE
    n int := (f).n::int; r int := (f).radius::int;
    off int := n * r; width int := 2 * n * r + 1;
    L numeric[]; m int; s int; v int; idx int; tot numeric;
    used boolean[] := array_fill(false, ARRAY[n]);
    win int[] := array_fill(0, ARRAY[n]);
    need int := 0;    -- required Σc over all REMAINING positions (starts 0: the whole window sums to n(n+1)/2)
    rnk numeric := rank; i int; mm1 int; needAfter int; cnt numeric; cand RECORD;
  BEGIN
    IF n = 0 THEN RETURN ROW(ARRAY[]::int[])::affine_permutation; END IF;
    L := array_fill(0::numeric, ARRAY[(n + 1) * width]);
    L[off + 1] := 1;                                          -- row m=0: only sum=0 is reachable
    FOR m IN 1..n LOOP
      FOR s IN 0..width - 1 LOOP
        tot := 0;
        FOR v IN -r..r LOOP
          idx := s - v;                                       -- previous-row sum index (new sum s came from old + v)
          IF idx >= 0 AND idx < width THEN tot := tot + L[(m - 1) * width + idx + 1]; END IF;
        END LOOP;
        L[m * width + s + 1] := tot;
      END LOOP;
    END LOOP;
    FOR i IN 1..n LOOP
      m := n - i + 1;                                         -- positions remaining, INCLUDING this one
      FOR cand IN
        SELECT u_val, c FROM generate_series(1, n) u_val, generate_series(-r, r) c
        WHERE NOT used[u_val] ORDER BY u_val + n * c
      LOOP
        mm1 := m - 1; needAfter := need - cand.c;
        cnt := factorial(mm1) * (CASE WHEN off + needAfter BETWEEN 0 AND width - 1
                                       THEN L[mm1 * width + off + needAfter + 1] ELSE 0 END);
        IF rnk < cnt THEN
          win[i] := cand.u_val + n * cand.c; used[cand.u_val] := true; need := needAfter; EXIT;
        ELSE
          rnk := rnk - cnt;
        END IF;
      END LOOP;
    END LOOP;
    RETURN ROW(win)::affine_permutation;
  END $fu$;

-- ── declare it as DATA + realize ─────────────────────────────────────────────────────────────────────
INSERT INTO base_collection VALUES ('affine_permutations', 'affine_permutation');
INSERT INTO base_grade VALUES ('affine_permutations', 1, 'n', NULL, NULL), ('affine_permutations', 2, 'radius', NULL, NULL);
SELECT base_realize('affine_permutations');

-- the finite part u ∈ S_n (residues) and the translation: the map back to the combinatorial representative, and a
-- stat for how far the element sits from the base tile.
CREATE FUNCTION affine_permutation_to_permutation(w affine_permutation) RETURNS permutation LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(ARRAY(SELECT ((x - 1) % coalesce(array_length((w).affine_window,1),1) + coalesce(array_length((w).affine_window,1),1)) % coalesce(array_length((w).affine_window,1),1) + 1
                   FROM unnest((w).affine_window) x))::permutation $$;
CREATE FUNCTION affine_permutation_translation(w affine_permutation) RETURNS int LANGUAGE sql IMMUTABLE AS $$   -- Σ|c_i|, the tile distance
  SELECT coalesce(sum(abs((x - (((x - 1) % n + n) % n + 1)) / n)), 0)::int
  FROM unnest((w).affine_window) x, (SELECT coalesce(array_length((w).affine_window,1),1) n) nn $$;
INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('affine_permutations','to_permutation','affine_permutation_to_permutation','permutations','Finite part (S_n)',NULL);
INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('affine_permutations','translation','affine_permutation_translation','Translation norm (tile distance)','natural_numbers');

-- ── examples ─────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('affine_permutations','radius 0 is exactly S_n: |affine_permutations(n,0)| = n! for n=1..4','eq','1,2,6,24','the finite symmetric group is the base tile',$q$
    SELECT string_agg(cardinality(affine_permutations(n,0))::text, ',' ORDER BY n) FROM generate_series(1,4) n $q$),
  ('affine_permutations','count = n! × #{c∈[-r,r]^n : Σc=0}: (3,1) = 6×7 = 42','eq','42','S_3 times the 7 lattice points in the unit box',$q$
    SELECT cardinality(affine_permutations(3,1))::text $q$),
  ('affine_permutations','the floor count matches the accel at (3,1)','eq','true','independent count',$q$
    SELECT ((SELECT count(*) FROM elements(affine_permutations(3,1)) e) = cardinality(affine_permutations(3,1)))::text $q$),
  ('affine_permutations','every window is distinct mod n and sums to n(n+1)/2 over (4,1)','eq','true','the level-0 affine conditions',$q$
    SELECT bool_and(
      (SELECT count(DISTINCT (x % 4)) FROM unnest(((e).value).affine_window) x) = 4
      AND (SELECT sum(x) FROM unnest(((e).value).affine_window) x) = 10)::text FROM elements(affine_permutations(4,1)) e $q$),
  ('affine_permutations','to_permutation recovers the finite part: window [4,-1,3] ↦ 123 (residues), translation 2','eq','123|2','u = residues in 1..n (c=(1,-1,0)); Σ|c| = tile distance',$q$
    SELECT one_line(affine_permutation_to_permutation(ROW(ARRAY[4,-1,3])::affine_permutation)) || '|' ||
           affine_permutation_translation(ROW(ARRAY[4,-1,3])::affine_permutation)::text $q$),
  ('affine_permutations','radius 0 elements are the fixed-point translation 0 (they ARE S_n)','eq','true','no translation at r=0',$q$
    SELECT bool_and(affine_permutation_translation((e).value) = 0)::text FROM elements(affine_permutations(3,0)) e $q$),
  ('affine_permutations','the finite part of every radius-1 element lands in permutations(3)','eq','true','to_permutation is a valid map into S_3',$q$
    SELECT bool_and(contains(permutations(3), affine_permutation_to_permutation((e).value)))::text FROM elements(affine_permutations(3,1)) e $q$),
  ('affine_permutations','past the elements() 5000-default: |affine_permutations(7,0)| = 7! = 5040, all reachable','eq','true','regression: the inner elements(permutations(n)) delegation must not truncate at the default cap (issue #165)',$q$
    SELECT ((SELECT count(*) FROM elements(affine_permutations(7,0), 6000) e) = cardinality(affine_permutations(7,0)))::text $q$),
  ('affine_permutations','fiber_unrank reproduces the floor element-for-element across 7 fibers (n,radius)','eq','true','multi-fiber element_at==sequential differential — selfcert cannot auto-drive the 2-axis fiber, so this is the accel oracle',$q$
    SELECT bool_and(ok)::text FROM (
      SELECT bool_and(
               render_value(fiber_unrank((SELECT f FROM fibers(affine_permutations(nk.n, nk.r)) f), t.ord::rank_index)) = t.expect
             ) AS ok
      FROM (VALUES (2,0),(3,0),(4,0),(2,1),(3,1),(4,1),(3,2)) AS nk(n,r),
      LATERAL (SELECT render(e) AS expect, (row_number() OVER (ORDER BY e) - 1) AS ord
               FROM elements(affine_permutations(nk.n, nk.r)) e) t
      GROUP BY nk.n, nk.r
    ) s $q$);

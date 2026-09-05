-- requires: realizer, utilities
-- alternating_sign_matrices — n×n matrices over {-1,0,1} whose row and column partial sums (top-to-bottom,
-- left-to-right) all stay in {0,1} and total 1 — equivalently, the nonzeros in every row and column alternate
-- +1,−1,…,+1 (a FindStat collection; sage AlternatingSignMatrices(n)). Carried as the FLATTENED matrix (row-major;
-- n = √length), rendered rows-slash-separated (e.g. 1,0,0/0,1,0/0,0,1). count = the ASM numbers A(n) = ∏_{k<n}
-- (3k+1)!/(n+k)! = 1,1,2,7,42,429,… (A005130). The floor builds the matrix entry by entry: at each cell v ∈ {-1,0,1}
-- must keep both its column's running sum and its row's running prefix in {0,1}, each row totals 1, and every column
-- totals 1 at the end.

-- ── carrier ────────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE alternating_sign_matrix AS (matrix int[]);              -- the n×n matrix flattened row-major
CREATE FUNCTION notation(a alternating_sign_matrix) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE m int[] := (a).matrix; len int := coalesce(array_length(m,1),0); n int := floor(sqrt(len))::int; i int; out text := '';
  BEGIN
    FOR i IN 0..n-1 LOOP out := out || CASE WHEN i > 0 THEN '/' ELSE '' END || array_to_string(m[i*n+1 : i*n+n], ','); END LOOP;
    RETURN out;
  END $$;

-- the ASM numbers A(n) = ∏_{k=0}^{n-1} (3k+1)! / (n+k)!  (A005130)
CREATE FUNCTION asm_number(n int) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE num numeric := 1; den numeric := 1; k int;
  BEGIN
    FOR k IN 0..n-1 LOOP num := num * factorial(3*k+1); den := den * factorial(n+k); END LOOP;
    RETURN round(num / den);
  END $$;

-- ── the engines a collection provides ──────────────────────────────────────────────────────────────────
CREATE TYPE alternating_sign_matrices_fiber AS (size natural_number);   -- typed fiber; axis: size
CREATE FUNCTION fiber_elements(f alternating_sign_matrices_fiber, element_limit int) RETURNS SETOF alternating_sign_matrix LANGUAGE sql STABLE AS $$
  WITH RECURSIVE build AS (
    SELECT ARRAY[]::int[] AS flat, ARRAY(SELECT 0 FROM generate_series(1, (f).size::int)) AS p, 0 AS s   -- p = column partial sums, s = row prefix
    UNION ALL
    SELECT b.flat || v,
           b.p[1:cc.c] || (b.p[cc.c + 1] + v) || b.p[cc.c + 2:],                                      -- bump column cc.c (0-based)
           CASE WHEN cc.c = (f).size::int - 1 THEN 0 ELSE b.s + v END                                 -- reset the row prefix at row end
      FROM build b,
           LATERAL (SELECT coalesce(array_length(b.flat,1),0) % (f).size::int AS c) cc,
           LATERAL generate_series(-1, 1) v
     WHERE coalesce(array_length(b.flat,1),0) < (f).size::int * (f).size::int
       AND (b.p[cc.c + 1] + v) IN (0, 1)                                                              -- column partial sum stays 0/1
       AND (b.s + v) IN (0, 1)                                                                        -- row prefix stays 0/1
       AND (cc.c <> (f).size::int - 1 OR (b.s + v) = 1)                                               -- each row totals 1
  )
  SELECT ROW(flat)::alternating_sign_matrix FROM build
   WHERE coalesce(array_length(flat,1),0) = (f).size::int * (f).size::int
     AND NOT EXISTS (SELECT 1 FROM unnest(p) x WHERE x <> 1)                                          -- every column totals 1
   ORDER BY flat
   LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f alternating_sign_matrices_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT asm_number((f).size::int) $$;
CREATE FUNCTION contains_in_fiber(f alternating_sign_matrices_fiber, v alternating_sign_matrix) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE n int := (f).size::int; m int[] := (v).matrix; i int; j int; pref int;
  BEGIN
    IF coalesce(array_length(m,1),0) <> n*n THEN RETURN false; END IF;
    IF EXISTS (SELECT 1 FROM unnest(m) x WHERE x NOT IN (-1,0,1)) THEN RETURN false; END IF;
    FOR i IN 0..n-1 LOOP                                                                              -- rows: prefix in {0,1}, total 1
      pref := 0;
      FOR j IN 1..n LOOP pref := pref + m[i*n+j]; IF pref NOT IN (0,1) THEN RETURN false; END IF; END LOOP;
      IF pref <> 1 THEN RETURN false; END IF;
    END LOOP;
    FOR j IN 1..n LOOP                                                                                -- columns: prefix in {0,1}, total 1
      pref := 0;
      FOR i IN 0..n-1 LOOP pref := pref + m[i*n+j]; IF pref NOT IN (0,1) THEN RETURN false; END IF; END LOOP;
      IF pref <> 1 THEN RETURN false; END IF;
    END LOOP;
    RETURN true;
  END $$;

-- direct unrank: the ASM ↔ monotone-triangle bijection reframed as a bitmask transfer DP. Row r's "active-column
-- set" S_r (columns whose running partial sum has reached 1) grows by exactly one net column per row — S_0 = ∅,
-- S_n = {1..n} — and given S_{r-1}, S_r the row's actual entries are FULLY DETERMINED: v_j = [j∈S_r] − [j∈S_{r-1}]
-- (both 0/1, so v_j ∈ {-1,0,1} automatically). The row-prefix-in-{0,1} / column-partial-sum-in-{0,1} floor
-- constraints reduce to one clean check on the two sets: for every column-prefix length j, the CUMULATIVE
-- popcounts must satisfy popcount(S_r∩[1,j]) − popcount(S_{r-1}∩[1,j]) ∈ {0,1} (it's literally the row's own
-- running prefix sum). completions(S) = # ways to finish rows from state S to S_n; unranking a row tries every
-- valid S_r extending the current S in ASCENDING order of the induced row vector (v, matching the floor's
-- generate_series(-1,1) then final ORDER BY flat) and descends via completions(S_r).
CREATE FUNCTION fiber_unrank(f alternating_sign_matrices_fiber, rank rank_index) RETURNS alternating_sign_matrix LANGUAGE plpgsql IMMUTABLE AS $fu$
  DECLARE
    n int := (f).size::int; nmasks int; full_mask int;
    pc numeric[]; dp numeric[];       -- pc[m+1] = popcount(m); dp[m+1] = completions remaining from state m
    m int; s int; t int; r int; rnk numeric := rank;
    cur int := 0; flat int[] := '{}'; cand RECORD;
  BEGIN
    IF n = 0 THEN RETURN ROW(ARRAY[]::int[])::alternating_sign_matrix; END IF;
    nmasks := 1 << n; full_mask := nmasks - 1;
    pc := array_fill(0::numeric, ARRAY[nmasks]);
    FOR m IN 1..nmasks - 1 LOOP pc[m + 1] := pc[(m >> 1) + 1] + (m & 1); END LOOP;
    dp := array_fill(0::numeric, ARRAY[nmasks]);
    dp[full_mask + 1] := 1;
    FOR r IN REVERSE (n - 1)..0 LOOP
      FOR s IN 0..nmasks - 1 LOOP
        IF pc[s + 1] <> r THEN CONTINUE; END IF;
        dp[s + 1] := (
          SELECT coalesce(sum(dp[t2 + 1]), 0) FROM generate_series(0, nmasks - 1) t2
          WHERE pc[t2 + 1] = r + 1
            AND NOT EXISTS (SELECT 1 FROM generate_series(1, n - 1) jj
                            WHERE (pc[(t2 & ((1 << jj) - 1)) + 1] - pc[(s & ((1 << jj) - 1)) + 1]) NOT IN (0, 1)));
      END LOOP;
    END LOOP;
    FOR r IN 1..n LOOP
      FOR cand IN
        SELECT t2, ARRAY(SELECT ((t2 >> (jj - 1)) & 1) - ((cur >> (jj - 1)) & 1) FROM generate_series(1, n) jj) AS vrow
        FROM generate_series(0, nmasks - 1) t2
        WHERE pc[t2 + 1] = r
          AND NOT EXISTS (SELECT 1 FROM generate_series(1, n - 1) jj
                          WHERE (pc[(t2 & ((1 << jj) - 1)) + 1] - pc[(cur & ((1 << jj) - 1)) + 1]) NOT IN (0, 1))
        ORDER BY (ARRAY(SELECT ((t2 >> (jj - 1)) & 1) - ((cur >> (jj - 1)) & 1) FROM generate_series(1, n) jj))
      LOOP
        IF rnk < dp[cand.t2 + 1] THEN
          flat := flat || cand.vrow; cur := cand.t2; EXIT;
        ELSE
          rnk := rnk - dp[cand.t2 + 1];
        END IF;
      END LOOP;
    END LOOP;
    RETURN ROW(flat)::alternating_sign_matrix;
  END $fu$;

-- ── declare as DATA + realize ──────────────────────────────────────────────────────────────────────────
INSERT INTO base_collection VALUES ('alternating_sign_matrices', 'alternating_sign_matrix');
INSERT INTO base_grade VALUES ('alternating_sign_matrices', 1, 'size', NULL, NULL);
SELECT base_realize('alternating_sign_matrices');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('alternating_sign_matrices','anchor: |alternating_sign_matrices(n)| for n=0..5 is 1,1,2,7,42,429','eq','1,1,2,7,42,429','the ASM numbers A(n) = ∏(3k+1)!/(n+k)! (A005130)',$q$
    SELECT string_agg(cardinality(alternating_sign_matrices(n))::text, ',' ORDER BY n) FROM generate_series(0,5) n $q$),
  ('alternating_sign_matrices','the 2 ASMs of order 2 are the permutation matrices','eq','0,1/1,0,1,0/0,1','no -1 is possible at n=2',$q$
    SELECT string_agg(render(e), ',' ORDER BY ordinality(e)) FROM elements(alternating_sign_matrices(2)) e $q$),
  ('alternating_sign_matrices','order 3 has exactly one matrix with a -1 (the unique non-permutation ASM)','eq','1','the 7th ASM of order 3',$q$
    SELECT count(*)::text FROM elements(alternating_sign_matrices(3)) e WHERE EXISTS (SELECT 1 FROM unnest(((e).value).matrix) x WHERE x = -1) $q$),
  ('alternating_sign_matrices','the sole -1 ASM of order 3 is 0,1,0/1,-1,1/0,1,0','eq','0,1,0/1,-1,1/0,1,0','the diamond',$q$
    SELECT render(unrank(alternating_sign_matrices(3), 3)) $q$),
  ('alternating_sign_matrices','every column of every ASM(3) sums to 1','eq','true','the defining column condition',$q$
    SELECT bool_and(colsum = 1)::text FROM elements(alternating_sign_matrices(3)) e,
      LATERAL (SELECT (((e).value).matrix[j] + ((e).value).matrix[j+3] + ((e).value).matrix[j+6]) colsum FROM generate_series(1,3) j) c $q$),
  ('alternating_sign_matrices','contains via <@: the diamond ∈ ASM(3); a bad matrix (row sum ≠ 1) ∉','eq','true|false','entries {-1,0,1}, partial sums 0/1, totals 1',$q$
    SELECT (ROW(ARRAY[0,1,0,1,-1,1,0,1,0])::alternating_sign_matrix <@ alternating_sign_matrices(3))::text || '|' ||
           (ROW(ARRAY[1,1,0,0,0,1,0,0,1])::alternating_sign_matrix <@ alternating_sign_matrices(3))::text $q$),
  ('alternating_sign_matrices','range constructor alternating_sign_matrices(0,3): fibers unfold to sizes 0,1,2,3','eq','0,1,2,3','the (lo,hi) range form',$q$
    SELECT string_agg((f).size::text, ',' ORDER BY (f).size) FROM fibers(alternating_sign_matrices(0,3)) f $q$),
  ('alternating_sign_matrices','fiber_unrank(alternating_sign_matrices(4), 0..N-1) reproduces the floor element-for-element, in order','eq','true','the bitmask transfer-DP unrank against the actual flattened-matrix-lex enumeration order',$q$
    SELECT bool_and(render_value(fiber_unrank((SELECT f FROM fibers(alternating_sign_matrices(4)) f), ord::rank_index)) = expect)::text
    FROM (SELECT render(e) AS expect, (row_number() OVER (ORDER BY e) - 1) AS ord FROM elements(alternating_sign_matrices(4)) e) t $q$);

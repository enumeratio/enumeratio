-- requires: permutations, lehmer_codes, statistics, realizer, utilities
-- symmetric_group — the permutations carrier READ AS A GROUP: same underlying set as `permutations` (n! group
-- elements), but a DISTINCT canonical representation AND a DISTINCT canonical order — #401 slice 2.
--   representation: disjoint CYCLE NOTATION (encoding lifted from the closed #387/#398 spike — see to_cycles /
--   to_permutation / notation below — unchanged from that branch).
--   order: by COXETER LENGTH (= inversions of the one-line word), ascending; ties broken lexicographically on the
--   one-line word. This is the whole point of slice 2 — it is NOT the order permutations uses (plain lex), so
--   symmetric_group is a sibling (base_sibling_borrow, #409) rather than an order-iso twin like lehmer_codes.

-- ── carrier (unchanged from #387/#398) ───────────────────────────────────────────────────────────────────────
-- flat encoding of the disjoint-cycle decomposition: cycles in increasing order of their minimal element, each
-- cycle listed starting at that minimum in image order, separated by a 0 sentinel (element values are 1..n, so 0
-- is unambiguous — same trick lehmer_codes uses for its implied trailing 0). Fixed points appear as singleton
-- cycles, so the encoding alone (no external n) determines the permutation.
CREATE TYPE permutation_cycles AS (cycles int[]);

CREATE FUNCTION to_cycles(p permutation) RETURNS permutation_cycles LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE img int[] := (p).image; n int := coalesce(array_length(img,1),0); visited boolean[] := array_fill(false, ARRAY[n]);
          out int[] := '{}'; i int; j int; first boolean := true;
  BEGIN
    FOR i IN 1..n LOOP                                        -- i unvisited ⇒ i is the MINIMUM of its cycle (any
      IF NOT visited[i] THEN                                  -- smaller cycle-mate would already have flagged it)
        IF NOT first THEN out := out || 0; END IF; first := false;
        j := i;
        LOOP visited[j] := true; out := out || j; j := img[j]; EXIT WHEN j = i; END LOOP;
      END IF;
    END LOOP;
    RETURN ROW(out)::permutation_cycles;
  END $$;
CREATE FUNCTION to_permutation(v permutation_cycles) RETURNS permutation LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE codes int[] := (v).cycles || 0; n int := (SELECT count(*) FROM unnest((v).cycles) e WHERE e <> 0);
          img int[] := array_fill(0, ARRAY[n]); cyc int[] := '{}'; x int; k int;
  BEGIN
    FOREACH x IN ARRAY codes LOOP                              -- trailing 0 (appended above) flushes the last cycle
      IF x = 0 THEN
        IF array_length(cyc,1) > 0 THEN
          FOR k IN 1..array_length(cyc,1) LOOP img[cyc[k]] := cyc[(k % array_length(cyc,1)) + 1]; END LOOP;
        END IF;
        cyc := '{}';
      ELSE cyc := cyc || x; END IF;
    END LOOP;
    RETURN ROW(img)::permutation;
  END $$;
CREATE FUNCTION notation(v permutation_cycles) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE codes int[] := (v).cycles || 0; cyc int[] := '{}'; out text := ''; x int;
  BEGIN
    FOREACH x IN ARRAY codes LOOP
      IF x = 0 THEN
        IF array_length(cyc,1) > 0 THEN out := out || '(' || array_to_string(cyc,' ') || ')'; END IF;
        cyc := '{}';
      ELSE cyc := cyc || x; END IF;
    END LOOP;
    RETURN coalesce(nullif(out,''), '()');                     -- n=0: the empty product, S₀'s sole (identity) element
  END $$;

-- ── Coxeter-length rank/unrank (the new part — slice 2's actual math) ──────────────────────────────────────────
-- Mahonian numbers M(m,k) = #permutations of size m with k inversions = coefficients of the q-factorial
-- ∏_{i=1}^{m}(1+q+...+q^{i-1}). Returns a 2D array tbl[1..n+1][1..maxdeg+1]: row m+1 holds M(m,·) for m=0..n
-- (0-indexed size m at pg row m+1), so ANY suffix-count needed while decoding a length-n Lehmer code (which needs
-- M(remaining,·) for remaining = 0..n-1) is a single lookup into the same table — built once, reused for every
-- digit position instead of recomputed per-position.
CREATE FUNCTION symmetric_group_mahonian_table(n int) RETURNS numeric[] LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE maxdeg int := n*(n-1)/2; tbl numeric[] := array_fill(0::numeric, ARRAY[n+1, maxdeg+1]);
          m int; k int; d int; s numeric;
  BEGIN
    tbl[1][1] := 1;                                            -- m=0: the empty permutation, 0 inversions, count 1
    FOR m IN 1..n LOOP
      FOR k IN 0..maxdeg LOOP
        s := 0;
        FOR d IN 0..least(m-1, k) LOOP s := s + tbl[m][k-d+1]; END LOOP;   -- convolve row m-1 with (1+q+...+q^{m-1})
        tbl[m+1][k+1] := s;
      END LOOP;
    END LOOP;
    RETURN tbl;
  END $$;

-- unrank: given (n, r), find the Coxeter-length block k via cumulative M(n,·), then decode the within-block
-- offset j digit-by-digit as the j-th (lex-ascending) LENGTH-n Lehmer code with digit-sum k — lex on the Lehmer
-- code equals lex on the one-line word (both are the same standard factorial-number-system bijection, restricted
-- to a fixed-digit-sum slice preserves relative order), so this also gives the required lex tiebreak for free.
-- Standard fixed-sum bounded-digit unranking: at position p (bound 0..n-p), try digits d=0,1,… and subtract the
-- Mahonian count of completions M(n-p, s-d) from j until the running count exceeds j.
CREATE FUNCTION symmetric_group_unrank_by_coxeter(n int, r bigint) RETURNS permutation LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE tbl numeric[] := symmetric_group_mahonian_table(n); maxdeg int := n*(n-1)/2;
          k int := 0; j numeric := r; blockcount numeric; s int; code int[] := array_fill(0, ARRAY[n]);
          p int; remaining int; d int; cnt numeric;
  BEGIN
    IF n = 0 THEN RETURN ROW('{}'::int[])::permutation; END IF;   -- S₀: to_permutation(permutation_inversion) with
                                                                    -- an empty code can't distinguish n=0 from n=1
                                                                    -- (array_length of '{}' is NULL) — short-circuit
    WHILE k <= maxdeg LOOP                                     -- find the inversions-block containing rank r
      blockcount := tbl[n+1][k+1];                             -- (WHILE, not FOR — a `FOR k IN ..` loop variable
      EXIT WHEN j < blockcount;                                -- masks the outer `k` and reverts to it after the
      j := j - blockcount;                                     -- loop, so `k` would read back as 0 below; WHILE
      k := k + 1;                                               -- keeps this k the real accumulator)
    END LOOP;
    s := k;
    FOR p IN 1..n LOOP
      remaining := n - p;                                      -- positions left AFTER this one; bound on this digit
      FOR d IN 0..remaining LOOP
        cnt := CASE WHEN s - d >= 0 THEN tbl[remaining+1][s-d+1] ELSE 0 END;
        IF j < cnt THEN code[p] := d; s := s - d; EXIT; ELSE j := j - cnt; END IF;
      END LOOP;
    END LOOP;
    RETURN to_permutation(ROW(code[1:n-1])::permutation_inversion);   -- code[n] is always 0 (no positions left)
  END $$;

-- rank: the inverse — total inversions place the top-level block, then per-position "how many completions come
-- lexicographically before this digit" sums give the within-block offset. Mirrors unrank's structure exactly.
CREATE FUNCTION symmetric_group_coxeter_rank(p permutation) RETURNS bigint LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE n int := coalesce(array_length((p).image,1),0); code int[] := (to_inversion(p)).code || 0;
          tbl numeric[] := symmetric_group_mahonian_table(n); k int := 0; d int; s int; pos int; remaining int;
          rnk numeric := 0;
  BEGIN
    FOR pos IN 1..n LOOP k := k + code[pos]; END LOOP;         -- total inversions = the block
    FOR d IN 0..k-1 LOOP rnk := rnk + tbl[n+1][d+1]; END LOOP; -- all earlier blocks come first
    s := k;
    FOR pos IN 1..n LOOP
      remaining := n - pos;
      FOR d IN 0..code[pos]-1 LOOP
        IF s - d >= 0 THEN rnk := rnk + tbl[remaining+1][s-d+1]; END IF;
      END LOOP;
      s := s - code[pos];
    END LOOP;
    RETURN rnk::bigint;
  END $$;

-- ── the engines ───────────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE symmetric_group_fiber AS (size natural_number);   -- typed fiber; axis: size
-- NAIVE reference enumeration (independent of the DP above, for selfcert's accelerated==naive differential):
-- lex-enumerate every permutation, then sort by (inversions, one-line word) — a plain ORDER BY, no digit-DP.
CREATE FUNCTION fiber_elements(f symmetric_group_fiber, element_limit int) RETURNS SETOF permutation_cycles LANGUAGE sql STABLE AS $$
  SELECT to_cycles(p) FROM (
    SELECT permutation_unrank_lex((f).size::int, ord) p FROM generate_series(0, (factorial((f).size::int) - 1)::int) ord
  ) t
  ORDER BY perm_inversions(p), (p).image
  LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f symmetric_group_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$   -- same |Sₙ| = n! as permutations
  SELECT CASE WHEN (f).size::int <= 20 THEN factorial_bigint((f).size::int)::numeric ELSE factorial((f).size::int) END $$;
CREATE FUNCTION contains_in_fiber(f symmetric_group_fiber, v permutation_cycles) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((SELECT array_agg(x ORDER BY x) FROM unnest((v).cycles) x WHERE x <> 0), '{}'::int[])
       = ARRAY(SELECT generate_series(1, (f).size::int)) $$;    -- non-separator entries are exactly a permutation of [n]

CREATE FUNCTION fiber_symbol(f symmetric_group_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'S' || to_unicode_subscript((f).size) $$;   -- Sₙ, same symbol as permutations' fiber

-- direct unrank (capability layer 3): the DP above, transported to cycle notation.
CREATE FUNCTION fiber_unrank(f symmetric_group_fiber, rank rank_index) RETURNS permutation_cycles LANGUAGE sql IMMUTABLE AS $fu$
  SELECT to_cycles(symmetric_group_unrank_by_coxeter((f).size::int, rank::bigint)) $fu$;
INSERT INTO base_collection VALUES ('symmetric_group', 'permutation_cycles');
INSERT INTO base_grade VALUES ('symmetric_group', 1, 'size', NULL, NULL);
SELECT base_realize('symmetric_group');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('symmetric_group','notation: 231 (a 3-cycle) ↦ (1 2 3); 213 (one transposition + a fixed point) ↦ (1 2)(3)','eq','(1 2 3)|(1 2)(3)','to_cycles then notation',$q$
    SELECT notation(to_cycles(ROW(ARRAY[2,3,1])::permutation)) || '|' || notation(to_cycles(ROW(ARRAY[2,1,3])::permutation)) $q$),
  ('symmetric_group','identity of S₃ is rank 0 (Coxeter length 0), three fixed points: (1)(2)(3)','eq','(1)(2)(3)','the identity permutation, in cycle notation',$q$
    SELECT notation((unrank(symmetric_group(3), 0)).value) $q$),
  ('symmetric_group','the REVERSE permutation is the LAST element (max Coxeter length = C(n,2))','eq','(1 4)(2 3)','n=4: reverse 4321 has C(4,2)=6 inversions, rank 23 = 4!-1',$q$
    SELECT notation((unrank(symmetric_group(4), 23)).value) $q$),
  ('symmetric_group','symmetric_group(3) in Coxeter-length order (NOT permutations'' lex order — the whole point of slice 2)','eq',
   '(1)(2)(3),(1)(2 3),(1 2)(3),(1 2 3),(1 3 2),(1 3)(2)','ascending inversions 0,1,1,2,2,3; lex tiebreak within a block (231↦(1 2 3) before 312↦(1 3 2))',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(symmetric_group(3)) e $q$),
  ('symmetric_group','same cardinality as permutations: |symmetric_group(4)| = 24 (accel, numeric)','eq','24','same underlying set, n!',$q$
    SELECT cardinality(symmetric_group(4))::text $q$),
  ('symmetric_group','round-trip: to_cycles(to_permutation(v)) = v over all of symmetric_group(5)','eq','true','the bijection inverts cleanly',$q$
    SELECT bool_and(to_cycles(to_permutation((e).value)) = (e).value)::text FROM elements(symmetric_group(5)) e $q$),
  ('symmetric_group','contains: (1 2)(3) ∈ symmetric_group(3), a malformed 4-cycle on 3 points ∉','eq','true|false','generated from contains_in_fiber',$q$
    SELECT contains(symmetric_group(3), ROW(ARRAY[1,2,0,3])::permutation_cycles)::text || '|' ||
           contains(symmetric_group(3), ROW(ARRAY[1,2,3,4])::permutation_cycles)::text $q$),
  ('symmetric_group','contains the identity of S₀ (the empty product, encoded as no cycles at all)','eq','true','symmetric_group(0)''s sole element',$q$
    SELECT contains(symmetric_group(0), (unrank(symmetric_group(0), 0::rank_index)).value)::text $q$),
  ('symmetric_group','order-correctness: Coxeter length is non-decreasing along rank, over symmetric_group(5)','eq','true',
   'the definitional property of the new order — must hold at every consecutive pair of ranks',$q$
    SELECT bool_and(coxlen >= coalesce(prevlen, coxlen))::text FROM (
      SELECT coxlen, lag(coxlen) OVER (ORDER BY ord) prevlen FROM (
        SELECT ordinality(e) ord, perm_inversions(to_permutation((e).value)) coxlen FROM elements(symmetric_group(5)) e
      ) t
    ) u $q$),
  ('symmetric_group','accelerated unrank(handle,r) == the naive sort-based scan, for every r of symmetric_group(1,5)','eq','true',
   'differential: fiber_unrank (the Mahonian DP) must agree with fiber_elements (independent sort-based enumeration) at every rank',$q$
    SELECT bool_and(
      unrank(symmetric_group(1,5), r) IS NOT DISTINCT FROM (
        SELECT e FROM elements(symmetric_group(1,5), least(r + 1, 2147483647)::int) e
         ORDER BY fiber_address((e).fiber), (e).rank OFFSET r LIMIT 1
      )
    )::text
    FROM generate_series(0, cardinality(symmetric_group(1,5))::int - 1) r $q$),
  ('symmetric_group','rank ∘ unrank = id over symmetric_group(5) (the DP''s own inverse, independent of the realizer''s generic scan)','eq','true',
   'symmetric_group_coxeter_rank(symmetric_group_unrank_by_coxeter(n,r)) = r for every r',$q$
    SELECT bool_and(symmetric_group_coxeter_rank(symmetric_group_unrank_by_coxeter(5, r)) = r)::text
    FROM generate_series(0, (factorial(5))::int - 1) r $q$);

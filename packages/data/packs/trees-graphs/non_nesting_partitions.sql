-- requires: catalan_numbers, realizer, set_partitions
-- non_nesting_partitions — the set partitions of [n] with no NESTING pair: no a<b<c<d where a,d share a block and
-- b,c share a DIFFERENT block (the arc b–c nested inside a–d). The nesting-dual of non_crossing_partitions; also
-- counted by Catalan(n). Reuses the set_partition RGS carrier + floor, filtered by the non-nesting predicate.
-- nesting is defined on ARCS (i → the NEXT element in the same block), not arbitrary same-block pairs: two arcs
-- (a,a') and (b,b') nest when a < b < b' < a'. (Any-pair would over-flag — it disagrees with Sage's is_nonnesting.)
CREATE FUNCTION is_non_nesting(rgs int[]) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  WITH arc AS (
    SELECT i, (SELECT min(j) FROM generate_subscripts(rgs,1) j WHERE j > i AND rgs[j] = rgs[i]) AS j
    FROM generate_subscripts(rgs,1) i
  ), arcs AS (SELECT i, j FROM arc WHERE j IS NOT NULL)
  SELECT NOT EXISTS (SELECT 1 FROM arcs x, arcs y WHERE x.i < y.i AND y.j < x.j) $$;   -- arc y strictly inside arc x

CREATE TYPE non_nesting_partitions_fiber AS (n natural_number);   -- typed fiber; axis: n (borrows set_partitions' floor)
CREATE FUNCTION fiber_elements(f non_nesting_partitions_fiber, element_limit int) RETURNS SETOF set_partition LANGUAGE sql STABLE AS $$
  SELECT v FROM fiber_elements(ROW((f).n)::set_partitions_fiber, 2147483647) v
  WHERE is_non_nesting((v).rgs) ORDER BY (v).rgs LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f non_nesting_partitions_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT catalan_number((f).n::int) $$;
CREATE FUNCTION contains_in_fiber(f non_nesting_partitions_fiber, v set_partition) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT contains_in_fiber(ROW((f).n)::set_partitions_fiber, v) AND is_non_nesting((v).rgs) $$;

INSERT INTO base_collection VALUES ('non_nesting_partitions', 'set_partition');
INSERT INTO base_grade VALUES ('non_nesting_partitions', 1, 'n', NULL, NULL);
CREATE FUNCTION fiber_symbol(f non_nesting_partitions_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'NN([' || (f).n::int || '])' $$;

-- direct unrank: a QUEUE-of-open-labels DP (the arc-interval dual of non_crossing's stack). For each currently-used
-- label track its LAST occurrence position; extending label v at its last position b is safe iff no arc (p,q) with
-- p>b has already closed — equivalently: touching the label at RECENCY-rank j (1=least-recently-touched, s=most)
-- strands (permanently retires) every label older than it (ranks 1..j-1), keeps the newer ones (ranks j+1..s), and
-- the touched label itself becomes the newest (moves to the back of the queue); a brand-new label just joins the
-- back. Recency-rank and label-VALUE order are independent (an old label re-touched can outrank a younger one), so
-- we keep the actual queue (oldest→newest) and, at each step, sort its labels ascending by value to walk lex order,
-- looking up each candidate's recency-rank to price it. Counting by "active-set size" alone obeys the identical
-- recurrence as non_crossing's stack DP (a completion-count bijection, not a coincidence — same Catalan totals):
-- D(0,s)=1; D(m,s) = D(m-1,s+1) [new label] + Σ_{j=1}^s D(m-1, s-j+1) [touch recency-rank j].
CREATE FUNCTION non_nesting_unrank_word(n int, ord bigint) RETURNS int[] LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE
    D numeric[]; m int; s int; k int; i int; rem int; j int;
    w int[] := '{}'; x numeric := ord; queue int[] := '{}'; mx int := -1;
    sorted int[]; cand int; cnt numeric; chosen boolean;
  BEGIN
    D := array_fill(0::numeric, ARRAY[n + 1, n + 2]);           -- D[m+1][s+1], m=0..n, s=0..n+1 (same shape as non_crossing's C)
    FOR s IN 0..n LOOP D[1][s + 1] := 1; END LOOP;
    FOR m IN 1..n LOOP
      FOR s IN 0..n LOOP
        cnt := D[m][s + 2];                                     -- new-label branch: D(m-1, s+1)
        FOR k IN 1..s LOOP cnt := cnt + D[m][k + 1]; END LOOP;   -- touch-rank-k branches: D(m-1, k)
        D[m + 1][s + 1] := cnt;
      END LOOP;
    END LOOP;
    FOR i IN 1..n LOOP
      rem := n - i; s := coalesce(array_length(queue, 1), 0); chosen := false;
      sorted := ARRAY(SELECT unnest(queue) ORDER BY 1);          -- active labels, ascending value (lex order)
      FOR k IN 1..s LOOP
        cand := sorted[k];
        j := array_position(queue, cand);                        -- cand's recency-rank (1=oldest)
        cnt := D[rem + 1][(s - j + 1) + 1];                       -- D(rem, s-j+1)
        IF x < cnt THEN
          w := w || cand; queue := queue[j + 1 : s] || cand; chosen := true; EXIT;
        ELSE
          x := x - cnt;
        END IF;
      END LOOP;
      IF NOT chosen THEN                                          -- brand-new label mx+1, joins the back
        mx := mx + 1; w := w || mx; queue := queue || mx;
      END IF;
    END LOOP;
    RETURN w;
  END $$;
CREATE FUNCTION fiber_unrank(f non_nesting_partitions_fiber, rank rank_index) RETURNS set_partition LANGUAGE sql IMMUTABLE AS $fu$
  SELECT ROW(non_nesting_unrank_word((f).n::int, rank::bigint))::set_partition $fu$;
SELECT base_realize('non_nesting_partitions');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('non_nesting_partitions','COUNT anchor: Catalan(n) for n=0..5','eq','1,1,2,5,14,42','the nesting-dual of non_crossing; also Catalan',$q$
    SELECT string_agg(cardinality(non_nesting_partitions(n))::text, ',' ORDER BY n) FROM generate_series(0,5) n $q$),
  ('non_nesting_partitions','the lone nesting drops at n=4: {1,4}/{2,3} = RGS 0110 excluded','eq','false','0110 nests 2–3 inside 1–4',$q$
    SELECT (ROW(ARRAY[0,1,1,0])::set_partition <@ non_nesting_partitions(4))::text $q$),
  ('non_nesting_partitions','while its crossing cousin 0101 = {1,3}/{2,4} IS non-nesting','eq','true','crossing ≠ nesting: 0101 survives here, 0110 there',$q$
    SELECT (ROW(ARRAY[0,1,0,1])::set_partition <@ non_nesting_partitions(4))::text $q$);

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('non_nesting_partitions','fiber_unrank(non_nesting_partitions(4), 0..13) are all members (accel floor)','eq','true','queue-DP unrank lands inside NN([4]) (14 = Catalan(4)) for every rank',$q$
    SELECT bool_and(fiber_unrank((SELECT f FROM fibers(non_nesting_partitions(4)) f), ord::rank_index) <@ non_nesting_partitions(4))::text
      FROM generate_series(0, cardinality(non_nesting_partitions(4))::int - 1) ord $q$);

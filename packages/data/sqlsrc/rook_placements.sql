-- requires: realizer, utilities
-- rook_placements — placements of any number of NON-ATTACKING rooks on the n×n board: no two share a row or column.
-- Equivalently the partial permutations (partial injections) of [n]. Single grade [n]; |rook_placements(n)| =
-- Σ_k C(n,k)²·k! = [[OEIS:A002720]] (1,2,7,34,209,…). Carrier = a length-n array `cols`, cols[i] = the column of the
-- rook in row i, or 0 if row i is empty; the nonzero entries are distinct (one rook per column). A fresh
-- partial-permutation carrier + a 2-parameter rank/unrank DP: rows are filled left→right and each row's choices are
-- ordered [empty, then the free columns ascending], so the global order is lexicographic by row.

-- ── carrier ──────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE rook_placement AS (cols int[]);                            -- cols[i] = column of the rook in row i, 0 = empty; e.g. {0,0,3}
CREATE FUNCTION notation(p rook_placement) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_to_string((p).cols, ','), '') $$;

-- rookDP count g(rows, avail) = # partial injections of `rows` rows into `avail` free columns
--   = Σ_{k=0}^{min(rows,avail)} C(rows,k)·(avail)_k   (choose k rows to fill, injectively assign k of the free columns)
-- Recurrence g(r,a) = g(r-1,a) + a·g(r-1,a-1); g(n,n) = A002720(n). Drives both the count and the unrank stride.
CREATE FUNCTION rook_ways(rows int, avail int) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE total numeric := 0; k int; term numeric; i int; BEGIN
    FOR k IN 0..LEAST(rows, avail) LOOP
      term := binomial(rows, k)::numeric;
      FOR i IN 0..k-1 LOOP term := term * (avail - i); END LOOP;   -- falling factorial (avail)_k
      total := total + term;
    END LOOP;
    RETURN total;
  END $$;

-- unrank the ord-th placement in row-lexicographic order. Per row, the empty choice covers g(rows_left, avail)
-- placements; otherwise pick the j-th smallest free column, each covering g(rows_left, avail-1). `avail` stays sorted
-- ascending, so column choices are enumerated smallest-first (matching the [empty, cols ascending] order).
CREATE FUNCTION rook_placement_unrank(n int, ord bigint) RETURNS rook_placement LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE avail int[] := ARRAY(SELECT generate_series(1, n)); res int[] := '{}';
          rem numeric := ord; rows_left int; a int; empty_ways numeric; block numeric; j int; r int;
  BEGIN
    FOR r IN 1..n LOOP
      rows_left := n - r;                                   -- rows after this one
      a := coalesce(array_length(avail, 1), 0);
      empty_ways := rook_ways(rows_left, a);
      IF rem < empty_ways THEN
        res := res || 0;                                    -- leave row r empty
      ELSE
        rem := rem - empty_ways;
        block := rook_ways(rows_left, a - 1);               -- placements per column choice
        j := floor(rem / block)::int;                       -- 0-indexed into the sorted free columns
        rem := rem - j * block;
        res := res || avail[j + 1];
        avail := avail[1:j] || avail[j+2 : array_length(avail, 1)];   -- consume that column
      END IF;
    END LOOP;
    RETURN ROW(res)::rook_placement;
  END $$;

-- ── the engines a collection provides ────────────────────────────────────────────────────────────────
CREATE TYPE rook_placements_fiber AS (n natural_number);   -- typed fiber; axis: n = board side
CREATE FUNCTION fiber_count(f rook_placements_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT rook_ways((f).n::int, (f).n::int) $$;
CREATE FUNCTION fiber_elements(f rook_placements_fiber, element_limit int) RETURNS SETOF rook_placement LANGUAGE sql STABLE AS $$
  SELECT rook_placement_unrank((f).n::int, ord::int)
    FROM generate_series(0, least(fiber_count(f), element_limit::numeric) - 1) ord LIMIT element_limit $$;
-- contains: length n, every entry in 0..n, and the nonzero entries (the occupied columns) all distinct.
CREATE FUNCTION contains_in_fiber(f rook_placements_fiber, v rook_placement) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((v).cols, 1), 0) = (f).n::int
     AND NOT EXISTS (SELECT 1 FROM unnest((v).cols) c WHERE c < 0 OR c > (f).n::int)
     AND NOT EXISTS (SELECT 1 FROM unnest((v).cols) c WHERE c <> 0 GROUP BY c HAVING count(*) > 1) $$;

-- direct unrank (capability layer 3): the ord-th element via a closed form / combinatorial unrank.
CREATE FUNCTION fiber_unrank(f rook_placements_fiber, rank rank_index) RETURNS rook_placement LANGUAGE sql IMMUTABLE AS $fu$ SELECT rook_placement_unrank((f).n::int, rank) $fu$;
INSERT INTO base_collection VALUES ('rook_placements', 'rook_placement');
INSERT INTO base_grade VALUES ('rook_placements', 1, 'n', NULL, NULL);
CREATE FUNCTION fiber_symbol(f rook_placements_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'R(' || (f).n::int || ')' $$;   -- corpus symbol
SELECT base_realize('rook_placements');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('rook_placements','cardinality = A002720 for n=0..6: 1,2,7,34,209,1546,13327','eq','1,2,7,34,209,1546,13327','Σ C(n,k)²k! partial permutations [[OEIS:A002720]]',$q$
    SELECT string_agg(cardinality(rook_placements(n))::text, ',' ORDER BY n) FROM generate_series(0,6) n $q$),
  ('rook_placements','n=0 ⇒ the single empty placement','eq','1|','R(0)=1, the empty board',$q$
    SELECT count(*)::text || '|' || notation((unrank(rook_placements(0), 0)).value) FROM elements(rook_placements(0)) e $q$),
  ('rook_placements','rank 0 of R(3) = the all-empty placement 0,0,0','eq','0,0,0','row-lex first (every row empty)',$q$
    SELECT notation((unrank(rook_placements(3), 0)).value) $q$),
  ('rook_placements','rank 3 of R(3) = 0,0,3 (one rook: row 3 → column 3)','eq','0,0,3','anchors the DP stride at n=3',$q$
    SELECT notation((unrank(rook_placements(3), 3)).value) $q$),
  ('rook_placements','rank 33 (last) of R(3) = 3,2,1 (the reverse full permutation)','eq','3,2,1','R(3)=34, so rank 33 is the maximum',$q$
    SELECT notation((unrank(rook_placements(3), 33)).value) $q$),
  ('rook_placements','floor count = accel for n=0..5','eq','1,2,7,34,209,1546','the generated floor, counted',$q$
    SELECT string_agg((SELECT count(*) FROM elements(rook_placements(n)))::text, ',' ORDER BY n) FROM generate_series(0,5) n $q$),
  ('rook_placements','every placement is non-attacking (distinct nonzero columns), n=4','eq','true','no two rooks share a column',$q$
    SELECT bool_and(NOT EXISTS (SELECT 1 FROM unnest(((e).value).cols) c WHERE c <> 0 GROUP BY c HAVING count(*) > 1))::text
      FROM elements(rook_placements(4)) e $q$),
  ('rook_placements','the n! full permutations sit among the placements: R(3) has 6 with no empty row','eq','6','3! placements using every row',$q$
    SELECT count(*)::text FROM elements(rook_placements(3)) e WHERE NOT (0 = ANY(((e).value).cols)) $q$),
  ('rook_placements','element carries a TYPED point fiber + ordinality','eq','3|33','unrank(rook_placements(3),33)',$q$
    SELECT (unrank(rook_placements(3), 33)).fiber.n::text || '|' || ordinality(unrank(rook_placements(3), 33))::text $q$),
  ('rook_placements','range handle: cardinality(rook_placements(0,3)) = 44 = 1+2+7+34','eq','44','fibers unfold over n=0..3',$q$
    SELECT cardinality(rook_placements(0,3))::text $q$),
  ('rook_placements','contains via <@: 0,0,3 ∈ R(3); 1,1,0 ∉ (repeated column); 3,2,1 ∈','eq','true|false|true','the non-attacking predicate',$q$
    SELECT (ROW(ARRAY[0,0,3])::rook_placement <@ rook_placements(3))::text || '|' ||
           (ROW(ARRAY[1,1,0])::rook_placement <@ rook_placements(3))::text || '|' ||
           (ROW(ARRAY[3,2,1])::rook_placement <@ rook_placements(3))::text $q$);

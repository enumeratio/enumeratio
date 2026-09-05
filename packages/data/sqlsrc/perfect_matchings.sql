-- requires: realizer, utilities
-- perfect_matchings — partitions of {1..2n} into n unordered pairs. Single grade [n]. Carrier = the flattened
-- pairs array [a1,b1,a2,b2,…] with each ai<bi and pairs sorted ascending by ai (the canonical form).
--
-- Fiber [n] in FIXED order, built recursively: the least remaining element is always paired first, tried
-- against each larger remaining element in increasing order, then the rest is matched the same way. Because
-- the least element leads every pair, this recursive order coincides with plain lexicographic order of the
-- flattened array — so the floor just builds the tree and does ORDER BY parts, same shape as
-- compositions_into_k_parts's WITH RECURSIVE floor. count = (2n-1)!! = 1·3·5···(2n-1) (double_factorial_odd).

-- ── carrier ──────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE perfect_matching AS (pairs int[]);
CREATE FUNCTION notation(m perfect_matching) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(string_agg('(' || (m).pairs[2*i-1] || ',' || (m).pairs[2*i] || ')', '' ORDER BY i), '')
  FROM generate_series(1, coalesce(array_length((m).pairs,1), 0) / 2) i $$;


-- ── the engines a collection provides ────────────────────────────────────────────────────────────────
CREATE TYPE perfect_matchings_fiber AS (n natural_number);   -- typed fiber; axis: n
CREATE FUNCTION fiber_elements(f perfect_matchings_fiber, element_limit int) RETURNS SETOF perfect_matching LANGUAGE sql STABLE AS $$
  WITH RECURSIVE build AS (
    SELECT ARRAY[]::int[] AS parts, ARRAY(SELECT generate_series(1, 2*(f).n::int)) AS remaining
    UNION ALL
    SELECT parts || ARRAY[remaining[1], e],
           ARRAY(SELECT x FROM unnest(remaining) x WHERE x <> remaining[1] AND x <> e ORDER BY x)
      FROM build, LATERAL unnest(remaining[2:array_length(remaining,1)]) e
     WHERE array_length(remaining,1) > 0
  )
  SELECT ROW(parts)::perfect_matching FROM build
   WHERE coalesce(array_length(remaining,1), 0) = 0
   ORDER BY parts
   LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f perfect_matchings_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT double_factorial_odd((f).n::int) $$;
CREATE FUNCTION contains_in_fiber(f perfect_matchings_fiber, v perfect_matching) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE n int := (f).n::int; arr int[] := (v).pairs; i int;
  BEGIN
    IF coalesce(array_length(arr,1), 0) <> 2*n THEN RETURN false; END IF;
    FOR i IN 1..n LOOP                                                   -- each pair ai<bi, pairs ascending by ai
      IF arr[2*i-1] >= arr[2*i] THEN RETURN false; END IF;
      IF i > 1 AND arr[2*i-3] >= arr[2*i-1] THEN RETURN false; END IF;
    END LOOP;
    RETURN (SELECT array_agg(x ORDER BY x) FROM unnest(arr) x) = ARRAY(SELECT generate_series(1, 2*n));  -- covers {1..2n}
  END $$;

-- ── declare as DATA + realize ────────────────────────────────────────────────────────────────────────
INSERT INTO base_collection VALUES ('perfect_matchings', 'perfect_matching');
INSERT INTO base_grade VALUES ('perfect_matchings', 1, 'n', NULL, NULL);
CREATE FUNCTION fiber_symbol(f perfect_matchings_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'M([' || (2 * (f).n::int) || '])' $$;   -- corpus symbol
-- direct unrank: lex over the pair-list. Always match the smallest free point with a partner; the block below a given
-- partner is (m-3)!! = the matchings of the m-2 points left after that pair (m = current #free points). digit picks
-- the partner (0-based among the free points, ascending), then recurse.
CREATE FUNCTION perfect_matching_unrank(n int, ord bigint) RETURNS perfect_matching LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE rem int[] := ARRAY(SELECT generate_series(1, 2 * n)); pairs int[] := '{}'; x numeric := ord; bs numeric; d int; m int; a int; e int; BEGIN
    WHILE coalesce(array_length(rem, 1), 0) >= 2 LOOP
      m := array_length(rem, 1); a := rem[1];
      bs := double_factorial_odd(m / 2 - 1);   -- (m-3)!! = matchings of the remaining m-2 points (double_factorial_odd(j) = (2j-1)!!)
      d := div(x, bs)::int;                                                 -- 0-based into rem[2:] (ascending partners)
      e := rem[2 + d];
      pairs := pairs || ARRAY[a, e];
      rem := ARRAY(SELECT r FROM unnest(rem) r WHERE r <> a AND r <> e ORDER BY r);
      x := x - d * bs;
    END LOOP;
    RETURN ROW(pairs)::perfect_matching;
  END $$;
CREATE FUNCTION fiber_unrank(f perfect_matchings_fiber, rank rank_index) RETURNS perfect_matching LANGUAGE sql IMMUTABLE AS $fu$
  SELECT perfect_matching_unrank((f).n::int, rank::bigint) $fu$;
SELECT base_realize('perfect_matchings');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('perfect_matchings','anchor: |perfect_matchings(n)| for n=0..4 is 1,1,3,15,105','eq','1,1,3,15,105','(2n-1)!! double factorial',$q$
    SELECT string_agg(cardinality(perfect_matchings(n))::text, ',' ORDER BY n) FROM generate_series(0,4) n $q$),
  ('perfect_matchings','matchings of [4] in fixed order','eq','(1,2)(3,4),(1,3)(2,4),(1,4)(2,3)','least element leads every pair, tried in increasing order',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(perfect_matchings(2)) e $q$),
  ('perfect_matchings','the n=0 fiber has exactly the empty matching','eq','1|','count then notation',$q$
    SELECT cardinality(perfect_matchings(0))::text || '|' || notation((unrank(perfect_matchings(0), 0)).value) $q$),
  ('perfect_matchings','n=1 is the single pair (1,2)','eq','(1,2)','trivial base case',$q$
    SELECT notation((unrank(perfect_matchings(1), 0)).value) $q$),
  ('perfect_matchings','every element of fiber [3] is a valid partition of {1..6} into 3 pairs','eq','true','the defining invariant, checked across the whole fiber',$q$
    SELECT bool_and(array_length(((e).value).pairs,1) = 6
                AND (SELECT array_agg(x ORDER BY x) FROM unnest(((e).value).pairs) x) = ARRAY[1,2,3,4,5,6])::text
      FROM elements(perfect_matchings(3)) e $q$),
  ('perfect_matchings','element carries a TYPED point fiber + ordinality','eq','3|1','unrank(perfect_matchings(3),1)',$q$
    SELECT (unrank(perfect_matchings(3), 1)).fiber.n::text || '|' || ordinality(unrank(perfect_matchings(3), 1))::text $q$),
  ('perfect_matchings','range constructor perfect_matchings(0,3): fibers unfold to n=0,1,2,3','eq','0,1,2,3','the (lo,hi) range form (gap 1)',$q$
    SELECT string_agg((f).n::text, ',' ORDER BY (f).n) FROM fibers(perfect_matchings(0,3)) f $q$),
  ('perfect_matchings','range handle: cardinality(perfect_matchings(0,3)) = 1+1+3+15','eq','20','summed over fibers n=0..3',$q$
    SELECT cardinality(perfect_matchings(0,3))::text $q$),
  ('perfect_matchings','unrank crosses fibers (rank 2 = first n=2 matching)','eq','(1,2)(3,4)','ranks 0,1 are n=0,1 (sizes 1,1); rank 2 = first of n=2',$q$
    SELECT notation((unrank(perfect_matchings(0,3), 2)).value) $q$),
  ('perfect_matchings','contains (gap 2): (1,2)(3,4) ∈ perfect_matchings(2), (1,3)(2,4) ∈, but a wrong-shape value ∉','eq','true|true|false','generated from contains_in_fiber',$q$
    SELECT contains(perfect_matchings(2), ROW(ARRAY[1,2,3,4])::perfect_matching)::text || '|' ||
           contains(perfect_matchings(2), ROW(ARRAY[1,3,2,4])::perfect_matching)::text || '|' ||
           contains(perfect_matchings(2), ROW(ARRAY[2,1,3,4])::perfect_matching)::text $q$),
  ('perfect_matchings','the <@ operator works too: (1,4)(2,3) <@ perfect_matchings(2)','eq','true','operator wrapper',$q$
    SELECT (ROW(ARRAY[1,4,2,3])::perfect_matching <@ perfect_matchings(2))::text $q$);

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('perfect_matchings','fiber_unrank(perfect_matchings(3), 0..14) are all members (accel floor)','eq','true','pair-list unrank lands inside M([6]) (15 = 5!!) for every rank',$q$
    SELECT bool_and(fiber_unrank((SELECT f FROM fibers(perfect_matchings(3)) f), ord::rank_index) <@ perfect_matchings(3))::text
      FROM generate_series(0, cardinality(perfect_matchings(3))::int - 1) ord $q$);

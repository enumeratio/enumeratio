-- requires: realizer, set_compositions, utilities
-- signed_set_compositions — signed ordered set partitions of [n]: a set_composition (ordered sequence of nonempty
-- disjoint blocks whose union is [n]) where each BLOCK (not each element) carries an independent ± sign. #232
-- chunk 3: this is the natural combinatorial representative of a face of the type-B permutahedron — the same role
-- set_compositions plays for the (type-A) permutahedron — but the type-B polytope registration itself lives on
-- `signed_permutations` (polytope-collections.sql), vertex-only for now (see the chunk-2 Birkhoff/hypersimplex
-- precedent); this collection is realized on its own, independent of that registration.
-- Carrier: (labels, signs) — labels exactly as set_composition (labels[i] = 1-based block index of element i, used
-- labels = {1..k}); signs[b] ∈ {+1,-1} is block b's sign, indexed by block label. cardinality: crossing every
-- ordered-set-composition surjection with 2 sign choices PER BLOCK gives the recurrence
--   a(0) = 1;  a(m) = Σ_{i=1}^{m} 2·C(m,i)·a(m-i)     (peel the sign-2 FIRST block of size i off the front)
-- — the Fubini recurrence in set_compositions.sql with an extra factor of 2 for the peeled block's sign.

-- ── carrier ──────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE signed_set_composition AS (labels int[], signs int[]);   -- signs[b] = sign of the block labeled b
CREATE FUNCTION notation(c signed_set_composition) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(string_agg(sgn || blk, '|' ORDER BY lbl), '') FROM (
    SELECT (c).labels[i] AS lbl, string_agg(i::text, ',' ORDER BY i) AS blk,
           CASE WHEN (c).signs[(c).labels[i]] = -1 THEN '-' ELSE '+' END AS sgn
    FROM generate_subscripts((c).labels, 1) i GROUP BY (c).labels[i]) s $$;

CREATE FUNCTION negative_blocks_count(c signed_set_composition) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM unnest((c).signs) s WHERE s = -1 $$;

-- closed form: a(0)=1; a(m) = Σ_{i=1}^m 2·C(m,i)·a(m-i) — same Pascal-triangle-free recurrence shape as
-- set_compositions' fubini(), with the extra ×2 for the peeled-off first block's independent sign.
CREATE FUNCTION signed_set_composition_count(n int) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE a numeric[] := ARRAY[1::numeric]; m int; i int; s numeric;
  BEGIN
    FOR m IN 1..n LOOP
      s := 0;
      FOR i IN 1..m LOOP s := s + binomial(m, i) * a[m - i + 1]; END LOOP;
      a := a || (2 * s);
    END LOOP;
    RETURN a[n + 1];
  END $$;

-- ── the engines a collection provides ────────────────────────────────────────────────────────────────
-- FLOOR: k ascending (1..n blocks), then within k the underlying surjection in lex order (reusing
-- set_composition_surjections), then the sign word ascending (bit b-1 = block b, same "sign minor" convention as
-- signed_permutations); n=0 ⇒ the single empty (no blocks, no signs) composition.
CREATE TYPE signed_set_compositions_fiber AS (n natural_number);   -- typed fiber; axis: n
CREATE FUNCTION fiber_elements(f signed_set_compositions_fiber, element_limit int) RETURNS SETOF signed_set_composition LANGUAGE sql STABLE AS $$
  SELECT ROW(labels, signs)::signed_set_composition FROM (
    SELECT 0 AS k, ARRAY[]::int[] AS labels, ARRAY[]::int[] AS signs, 0 AS sgn WHERE (f).n::int = 0
    UNION ALL
    SELECT k, labels,
           ARRAY(SELECT CASE WHEN ((sgn >> (b - 1)) & 1) = 1 THEN -1 ELSE 1 END FROM generate_series(1, k) b) AS signs,
           sgn
    FROM generate_series(1, (f).n::int) k,
         LATERAL set_composition_surjections((f).n::int, k) AS g(labels),
         generate_series(0, (pow_int(2, k) - 1)::int) sgn
    WHERE (f).n::int > 0
  ) t ORDER BY k, labels, sgn LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f signed_set_compositions_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT signed_set_composition_count((f).n::int) $$;
CREATE FUNCTION contains_in_fiber(f signed_set_compositions_fiber, v signed_set_composition) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE lbls int[] := (v).labels; sgns int[] := (v).signs; n int := coalesce(array_length(lbls,1), 0);
          distinct_lbls int[]; k int;
  BEGIN
    IF n <> (f).n::int THEN RETURN false; END IF;
    IF n = 0 THEN RETURN coalesce(array_length(sgns,1), 0) = 0; END IF;
    SELECT array_agg(DISTINCT x ORDER BY x) INTO distinct_lbls FROM unnest(lbls) x;
    k := array_length(distinct_lbls, 1);
    IF distinct_lbls <> ARRAY(SELECT generate_series(1, k)) THEN RETURN false; END IF;    -- exactly {1..k} used, no gaps
    IF coalesce(array_length(sgns,1), 0) <> k THEN RETURN false; END IF;                  -- one sign per block
    RETURN NOT EXISTS (SELECT 1 FROM unnest(sgns) sg WHERE sg <> 1 AND sg <> -1);
  END $$;

-- ── declare it as DATA + realize ─────────────────────────────────────────────────────────────────────
INSERT INTO base_collection VALUES ('signed_set_compositions', 'signed_set_composition');
INSERT INTO base_grade VALUES ('signed_set_compositions', 1, 'n', NULL, NULL);
CREATE FUNCTION fiber_symbol(f signed_set_compositions_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT '±OΠ([' || (f).n::int || '])' $$;   -- corpus symbol
SELECT base_realize('signed_set_compositions');

INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('signed_set_compositions','negative_blocks_count','negative_blocks_count','Number of negative blocks','natural_numbers');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('signed_set_compositions','COUNT anchor: a(n) for n=0..4 (a(0)=1; a(m)=Σ 2·C(m,i)·a(m-i))','eq','1,2,10,74,730','cardinality per fiber (accel)',$q$
    SELECT string_agg(cardinality(signed_set_compositions(n))::text, ',' ORDER BY n) FROM generate_series(0,4) n $q$),
  ('signed_set_compositions','cardinality(signed_set_compositions(3)) = 74','eq','74','the closed-form count accel',$q$
    SELECT cardinality(signed_set_compositions(3))::text $q$),
  ('signed_set_compositions','floor generates 74 elements at n=3 (independent of the accel)','eq','74','count the floor directly',$q$
    SELECT count(*)::text FROM elements(signed_set_compositions(3)) e $q$),
  ('signed_set_compositions','signed_set_compositions(0) is the single empty composition','eq','1|','count=1, notation=empty',$q$
    SELECT cardinality(signed_set_compositions(0))::text || '|' || notation((unrank(signed_set_compositions(0), 0)).value) $q$),
  ('signed_set_compositions','n=1 enumerated: +1 before -1 (one block, sign minor)','eq','+1|-1','the two signed compositions of a single-element ground set',$q$
    SELECT string_agg(notation((e).value), '|' ORDER BY ordinality(e)) FROM elements(signed_set_compositions(1)) e $q$),
  ('signed_set_compositions','n=2 enumerated in full: k=1 (2 sign patterns), then k=2 lex-major × sign-minor (4 each)','eq','+1,2|-1,2|+1|+2|-1|+2|+1|-2|-1|-2|+2|+1|-2|+1|+2|-1|-2|-1','10 = a(2), matching the closed form',$q$
    SELECT string_agg(notation((e).value), '|' ORDER BY ordinality(e)) FROM elements(signed_set_compositions(2)) e $q$),
  ('signed_set_compositions','element carries a TYPED point fiber (address [n])','eq','3','unrank(signed_set_compositions(3),0).fiber.n',$q$
    SELECT (unrank(signed_set_compositions(3), 0)).fiber.n::text $q$),
  ('signed_set_compositions','unrank crosses sign inside the fiber: n=1 rank 0 = +1, rank 1 = -1','eq','+1|-1','rank 0 is the all-positive block; rank 1 flips its sign',$q$
    SELECT notation((unrank(signed_set_compositions(1), 0)).value) || '|' || notation((unrank(signed_set_compositions(1), 1)).value) $q$),
  ('signed_set_compositions','range constructor signed_set_compositions(0,2): fibers unfold to n = 0,1,2','eq','0,1,2','the (lo,hi) grade range',$q$
    SELECT string_agg((f).n::text, ',' ORDER BY (f).n) FROM fibers(signed_set_compositions(0,2)) f $q$),
  ('signed_set_compositions','range handle cardinality = 1+2+10 = 13','eq','13','summed over fibers n=0,1,2',$q$
    SELECT cardinality(signed_set_compositions(0,2))::text $q$),
  ('signed_set_compositions','contains: {1,2}/{+,-} ∈ fiber(2); {1,1,2} wrong ground-set size; {1,2} with only 1 sign for 2 blocks','eq','true|false|false','generated from contains_in_fiber',$q$
    SELECT contains(signed_set_compositions(2), ROW(ARRAY[1,2], ARRAY[1,-1])::signed_set_composition)::text || '|' ||
           contains(signed_set_compositions(2), ROW(ARRAY[1,1,2], ARRAY[1,1])::signed_set_composition)::text || '|' ||
           contains(signed_set_compositions(2), ROW(ARRAY[1,2], ARRAY[1])::signed_set_composition)::text $q$),
  ('signed_set_compositions','contains: an invalid sign value (2, not ±1) is rejected','eq','false','contains_in_fiber checks sg ∈ {1,-1}',$q$
    SELECT contains(signed_set_compositions(2), ROW(ARRAY[1,2], ARRAY[1,2])::signed_set_composition)::text $q$),
  ('signed_set_compositions','the <@ operator: {1,2}/{-1,-1} <@ signed_set_compositions(2)','eq','true','operator wrapper over contains',$q$
    SELECT (ROW(ARRAY[1,2], ARRAY[-1,-1])::signed_set_composition <@ signed_set_compositions(2))::text $q$),
  ('signed_set_compositions','negative_blocks_count: {+1|-2|+3} has exactly one negative block','eq','1','stat over a 3-block composition, blocks 1 and 3 positive, block 2 negative',$q$
    SELECT negative_blocks_count(ROW(ARRAY[1,2,3], ARRAY[1,-1,1])::signed_set_composition)::text $q$);

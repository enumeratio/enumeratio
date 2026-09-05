-- requires: realizer
-- integer_compositions — ordered sequences of positive parts summing to n. Single grade [n]. Realized from data:
-- carrier + a per-fiber FLOOR (the classic gap-cut bijection) + count/contains accels; base_realize generates
-- handle/fiber/element + constructor (incl. the (lo,hi) range form) + the full surface.
--
-- Bijection: a composition of n ↔ a subset of the n-1 gaps between n unit cells. Cutting a gap ends a part; the
-- run lengths ARE the parts. We enumerate by the gap-cut MASK (bit i ⇒ cut gap i), so the fixed canonical order
-- is mask 0,1,2,… over 0..2^(n-1)-1. cardinality = 2^(n-1) for n≥1; n=0 ⇒ the single empty composition.

-- ── carrier ──────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE composition AS (parts int[]);                             -- ordered positive parts; {2,1} = 2 then 1
CREATE FUNCTION notation(c composition) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT array_to_string((c).parts, '+') $$;

-- decode a gap-cut mask into run-length parts (the bijection). n cells, n-1 gaps; bit (i-1) cuts gap i.
CREATE FUNCTION composition_from_mask(n int, mask bigint) RETURNS composition LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE parts int[] := '{}'; run int := 1; i int; BEGIN
    IF n = 0 THEN RETURN ROW('{}'::int[])::composition; END IF;
    FOR i IN 1..n-1 LOOP
      IF ((mask >> (i-1)) & 1) = 1 THEN parts := parts || run; run := 1;   -- cut: close this part, start the next
      ELSE run := run + 1; END IF;                                          -- no cut: grow the current part
    END LOOP;
    RETURN ROW(parts || run)::composition;                                  -- close the final part
  END $$;

-- ── the engines this collection provides ─────────────────────────────────────────────────────────────
CREATE TYPE integer_compositions_fiber AS (n natural_number);   -- typed fiber; axis: n
-- FLOOR: masks 0..2^(n-1)-1 (n=0 ⇒ the single mask 0 ⇒ empty composition), decoded in mask order.
CREATE FUNCTION fiber_elements(f integer_compositions_fiber, element_limit int) RETURNS SETOF composition LANGUAGE sql STABLE AS $$
  SELECT composition_from_mask((f).n::int, m)
    FROM generate_series(0::bigint, (1::bigint << greatest((f).n::int - 1, 0)) - 1) m
   LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f integer_compositions_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT (1::bigint << greatest((f).n::int - 1, 0))::numeric $$;            -- 2^(n-1) for n≥1; n=0 ⇒ 2^0 = 1 (exact)
CREATE FUNCTION contains_in_fiber(f integer_compositions_fiber, v composition) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((SELECT sum(p) FROM unnest((v).parts) p), 0) = (f).n::int
     AND NOT EXISTS (SELECT 1 FROM unnest((v).parts) p WHERE p <= 0) $$;    -- parts positive AND summing to n

-- ── declare as DATA + realize ────────────────────────────────────────────────────────────────────────
INSERT INTO base_collection VALUES ('integer_compositions', 'composition');
INSERT INTO base_grade VALUES ('integer_compositions', 1, 'n', NULL, NULL);
CREATE FUNCTION fiber_symbol(f integer_compositions_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Comp(' || (f).n::int || ')' $$;   -- corpus symbol
SELECT base_realize('integer_compositions');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('integer_compositions','compositions of 3 in mask order','eq','3,1+2,2+1,1+1+1','the gap-cut floor for fiber [3]',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(integer_compositions(3)) e $q$),
  ('integer_compositions','count anchor 1,1,2,4,8,16 for n=0..5','eq','1,1,2,4,8,16','2^(n-1), with n=0 ⇒ 1',$q$
    SELECT string_agg(cardinality(integer_compositions(n))::text, ',' ORDER BY n) FROM generate_series(0,5) n $q$),
  ('integer_compositions','cardinality(integer_compositions(5)) = 16 = 2^(5-1) (accel)','eq','16','closed-form fiber count',$q$
    SELECT cardinality(integer_compositions(5))::text $q$),
  ('integer_compositions','every composition of 5 sums to 5','eq','true','the defining invariant across the whole fiber',$q$
    SELECT bool_and((SELECT coalesce(sum(p),0) FROM unnest(((e).value).parts) p) = 5)::text FROM elements(integer_compositions(5)) e $q$),
  ('integer_compositions','n=0 ⇒ exactly one empty composition','eq','1|','the empty-parts edge case',$q$
    SELECT count(*)::text || '|' || coalesce(string_agg(notation((e).value), ','), '') FROM elements(integer_compositions(0)) e $q$),
  ('integer_compositions','multi-grade absent: fiber address is [n]','eq','5','single grade ⇒ one point per fiber',$q$
    SELECT (unrank(integer_compositions(5), 0)).fiber.n::text $q$),
  ('integer_compositions','unrank(integer_compositions(3), 1) = 1+2 (mask order)','eq','1+2','rank = ordinality within the one fiber',$q$
    SELECT notation((unrank(integer_compositions(3), 1)).value) $q$),
  ('integer_compositions','range handle cardinality(integer_compositions(1,4)) = 15','eq','15','Σ 2^(n-1) over n=1..4 (fibers unfold)',$q$
    SELECT cardinality(integer_compositions(1,4))::text $q$),
  ('integer_compositions','range constructor unfolds fibers to n = 1,2,3,4','eq','1,2,3,4','the (lo,hi) grade range',$q$
    SELECT string_agg((f).n::text, ',' ORDER BY (f).n) FROM fibers(integer_compositions(1,4)) f $q$),
  ('integer_compositions','contains: 2+1 ∈ compositions(3), 2+2 ∉','eq','true|false','generated from contains_in_fiber',$q$
    SELECT contains(integer_compositions(3), ROW(ARRAY[2,1])::composition)::text || '|' ||
           contains(integer_compositions(3), ROW(ARRAY[2,2])::composition)::text $q$),
  ('integer_compositions','the <@ operator works too: 1+1+1 <@ compositions(3)','eq','true','operator wrapper',$q$
    SELECT (ROW(ARRAY[1,1,1])::composition <@ integer_compositions(3))::text $q$),
  ('integer_compositions','cardinality(integer_compositions()) = ∞, not 0 (#151)','eq','Infinity',
    'the fully-ungraded WHOLE handle (n unbounded) is OPEN — fibers() cannot unfold it, so the naive fiber-sum used to silently see zero fibers and coalesce to 0',$q$
    SELECT cardinality(integer_compositions())::text $q$);

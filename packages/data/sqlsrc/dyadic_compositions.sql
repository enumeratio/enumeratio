-- requires: integer_compositions, realizer
-- dyadic_compositions — ported from old-backup sqlsrc/dyadic-compositions.sql. Compositions of n into parts that
-- are powers of 2 ({1,2,4,8,…}), A023359: 1,1,2,3,6,10,18,31,56,… for n=0,1,2,3,4,5,6,7,8 (count(0)=1, grows
-- faster than Fibonacci). A base_restrict of integer_compositions: same carrier (composition) + grade chain [n],
-- floor = the parent's gap-cut floor filtered by the every-part-a-power-of-2 predicate (realizer re-ranks within
-- the filtered fiber).

-- ── predicate ────────────────────────────────────────────────────────────────────────────────────────
-- every part is a power of 2: p >= 1 AND p & (p-1) = 0 (the classic power-of-2 bit trick).
CREATE FUNCTION is_dyadic_composition(v composition) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT NOT EXISTS (SELECT 1 FROM unnest((v).parts) p WHERE p < 1 OR (p & (p - 1)) <> 0) $$;

-- ── derive + realize ─────────────────────────────────────────────────────────────────────────────────
-- accel hook (#172): a(n) = Σ_{power-of-2 p≤n} a(n−p), a(0)=1 (A023359) — a DP over the O(log n) powers of 2 up
-- to n, polynomial instead of the exponential composition floor.
CREATE FUNCTION dyadic_composition_count(f integer_compositions_fiber) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE n int := (f).n::int; dp numeric[] := ARRAY[1::numeric]; i int; p int; s numeric; BEGIN   -- dp[i+1] = a(i)
    IF n < 0 THEN RETURN NULL; END IF;
    FOR i IN 1..n LOOP
      s := 0; p := 1;
      WHILE p <= i LOOP s := s + dp[i - p + 1]; p := p * 2; END LOOP;
      dp := dp || s;
    END LOOP;
    RETURN dp[n + 1];
  END $$;

SELECT base_restrict('dyadic_compositions', 'integer_compositions', 'is_dyadic_composition', count_fn => 'dyadic_composition_count');
CREATE FUNCTION fiber_symbol(f dyadic_compositions_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'DCom(' || (f).n::int || ')' $$;   -- corpus symbol
SELECT wire_set_notation('dyadic_compositions');


-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('dyadic_compositions','A023359 count anchor n=0..8: 1,1,2,3,6,10,18,31,56','eq','1,1,2,3,6,10,18,31,56','compositions of n into powers of 2',$q$
    SELECT string_agg(cardinality(dyadic_compositions(n))::text, ',' ORDER BY n) FROM generate_series(0,8) n $q$),
  ('dyadic_compositions','cardinality(dyadic_compositions(4)) = 6','eq','6','1+1+1+1, 1+1+2, 1+2+1, 2+1+1, 2+2, 4',$q$
    SELECT cardinality(dyadic_compositions(4))::text $q$),
  ('dyadic_compositions','cardinality(dyadic_compositions(7)) = 31','eq','31','A023359(7)',$q$
    SELECT cardinality(dyadic_compositions(7))::text $q$),
  ('dyadic_compositions','dyadic compositions of 4 in mask order: 4,2+2,1+1+2,1+2+1,2+1+1,1+1+1+1','eq','4,2+2,1+1+2,1+2+1,2+1+1,1+1+1+1','filtered floor: 1+3, 3+1 excluded (3 not a power of 2)',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(dyadic_compositions(4)) e $q$),
  ('dyadic_compositions','every part of every element is a power of 2','eq','true','the defining invariant, checked across n=0..8',$q$
    SELECT bool_and(is_dyadic_composition((e).value)) FROM elements(dyadic_compositions(0,8)) e $q$),
  ('dyadic_compositions','fiber = (n) named axis','eq','4','single grade, borrowed from the parent chain',$q$
    SELECT (unrank(dyadic_compositions(4), 0)).fiber.n::text $q$),
  ('dyadic_compositions','contains: 2+1+1 ∈ dyadic(4), 1+3 ∉','eq','true|false','derived membership = parent ∧ predicate',$q$
    SELECT (ROW(ARRAY[2,1,1])::composition <@ dyadic_compositions(4))::text || '|' ||
           (ROW(ARRAY[1,3])::composition <@ dyadic_compositions(4))::text $q$);

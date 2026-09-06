-- requires: aliquot, realizer
-- amicable_numbers — numbers belonging to an amicable PAIR (A063990): n is amicable iff m = aliquot_sum(n)
-- satisfies m <> n and aliquot_sum(m) = n. First members: 220,284,1184,1210,2620,2924,… Unbounded number set.
-- Reuses aliquot_sum(n numeric) from 48-aliquot.sql — do not redefine.

CREATE FUNCTION is_amicable(n numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT n > 0 AND aliquot_sum(n) <> n AND aliquot_sum(aliquot_sum(n)) = n $$;

CREATE TYPE amicable_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
-- sparse: first member is 220, sixth is 2924, and they thin out fast — no finite window holds the 100th, and there is
-- no closed form. Enumerate by a DIVISOR-SUM SIEVE — one pass computes aliquot_sum for every candidate, O(W log W) —
-- NOT by testing each n with the O(n) aliquot_sum: at the default 100-row window the per-n test scans ~60k integers
-- and tips past the 20s watchdog (#254). The window still SCALES with element_limit (#296 — a small request stays a
-- small sieve) but is CAPPED: past the cap the fiber is a frontier, not a truncation. The sieve reaches 2×W so a pair
-- straddling the window edge (n ≤ W, partner aliquot_sum(n) just past W) is still detected.
CREATE FUNCTION fiber_elements(f amicable_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  WITH b AS (SELECT least(element_limit * 600 + 200, 100000)::bigint AS w),
       sig AS (SELECT m AS v, sum(d) - m AS s                                 -- aliquot_sum (proper-divisor sum) of every m ≤ 2W
                 FROM b, generate_series(1, b.w * 2) d, generate_series(d, b.w * 2, d) m
                GROUP BY m)
  SELECT a.v::numeric FROM sig a JOIN sig partner ON partner.v = a.s, b        -- n amicable ⇔ aliquot_sum(aliquot_sum(n)) = n, with n ≠ aliquot_sum(n)
   WHERE a.v <= b.w AND a.s <> a.v AND partner.s = a.v
   ORDER BY a.v LIMIT element_limit $$;
CREATE FUNCTION contains_in_fiber(f amicable_numbers_fiber, v numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT is_amicable(v) $$;

INSERT INTO base_collection VALUES ('amicable_numbers','numeric',true);
CREATE FUNCTION fiber_symbol(f amicable_numbers_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Amic' $$;   -- corpus symbol
SELECT base_realize('amicable_numbers');

INSERT INTO base_example (suite,title,kind,expected,description,sql) VALUES
  ('amicable_numbers','first six','eq','220,284,1184,1210,2620,2924','aliquot_sum(n)=m, aliquot_sum(m)=n, m<>n',$q$
    SELECT string_agg((e).value::text,',' ORDER BY ordinality(e)) FROM elements(amicable_numbers(),6) e $q$),
  ('amicable_numbers','220↔284 is the defining pair','eq','284|220','aliquot_sum(220)=284, aliquot_sum(284)=220',$q$
    SELECT aliquot_sum(220::numeric)::text || '|' || aliquot_sum(aliquot_sum(220::numeric))::text $q$),
  ('amicable_numbers','cardinality is infinite','eq','Infinity','unbounded number set',$q$
    SELECT cardinality(amicable_numbers())::text $q$),
  ('amicable_numbers','contains: 220 ∈, 221 ∉','eq','true|false','',$q$
    SELECT (220::numeric <@ amicable_numbers())::text||'|'||(221::numeric <@ amicable_numbers())::text $q$);

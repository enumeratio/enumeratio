-- requires: aliquot, realizer
-- amicable_numbers — numbers belonging to an amicable PAIR (A063990): n is amicable iff m = aliquot_sum(n)
-- satisfies m <> n and aliquot_sum(m) = n. First members: 220,284,1184,1210,2620,2924,… Unbounded number set.
-- Reuses aliquot_sum(n numeric) from 48-aliquot.sql — do not redefine.

CREATE FUNCTION is_amicable(n numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT n > 0 AND aliquot_sum(n) <> n AND aliquot_sum(aliquot_sum(n)) = n $$;

CREATE TYPE amicable_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
-- sparse: first member is 220, sixth is 2924 (~500/element); window SCALES with element_limit (#296) so a small
-- request doesn't re-pay a fixed 3200-wide scan — floor keeps the first six comfortably in range.
CREATE FUNCTION fiber_elements(f amicable_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  SELECT n::numeric FROM generate_series(1, element_limit * 600 + 200) n
   WHERE is_amicable(n::numeric) ORDER BY n LIMIT element_limit $$;
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

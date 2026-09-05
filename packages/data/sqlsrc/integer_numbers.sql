-- requires: realizer
-- integer_numbers — the integers ℤ (A001057 in this enumeration order), the ring companion to natural_numbers.
-- Carrier `integer_number` (the ℤ domain, registered a commutative_ring + total_order in algebra.sql), so the
-- collection carries ring arithmetic (+ − ·) and the order — browse it and evaluate in ℤ in the explorer. Unbounded,
-- one infinite fiber. Enumerated by the standard ℕ↔ℤ zigzag 0, 1, −1, 2, −2, … so a finite prefix is symmetric
-- about 0 (the naturals' plain 0,1,2,… can't reach the negatives).
CREATE TYPE integer_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f integer_numbers_fiber, element_limit int) RETURNS SETOF integer_number LANGUAGE sql STABLE AS $$
  SELECT (CASE WHEN r = 0 THEN 0 WHEN r % 2 = 1 THEN (r + 1) / 2 ELSE -(r / 2) END)::integer_number
  FROM generate_series(0, element_limit - 1) r $$;                     -- 0, +1, −1, +2, −2, … (the zigzag)
CREATE FUNCTION contains_in_fiber(f integer_numbers_fiber, v integer_number) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT v IS NOT NULL $$;                          -- every integer belongs (the domain already enforces integrality)

-- direct unrank (capability layer 3): the ord-th element via a closed form / combinatorial unrank.
CREATE FUNCTION fiber_unrank(f integer_numbers_fiber, rank rank_index) RETURNS integer_number LANGUAGE sql IMMUTABLE AS $fu$ SELECT (CASE WHEN rank = 0 THEN 0 WHEN rank % 2 = 1 THEN (rank + 1) / 2 ELSE -(rank / 2) END)::integer_number $fu$;
INSERT INTO base_collection VALUES ('integer_numbers', 'integer_number', true);   -- unbounded, ungraded
CREATE FUNCTION fiber_symbol(f integer_numbers_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'ℤ' $$;   -- corpus symbol
SELECT base_realize('integer_numbers');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('integer_numbers','the zigzag 0,+1,−1,+2,… (first eight)','eq','0,1,-1,2,-2,3,-3,4','symmetric about 0',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(integer_numbers(), 8) e $q$),
  ('integer_numbers','cardinality = infinity (unbounded)','eq','Infinity','one endless fiber',$q$
    SELECT cardinality(integer_numbers())::text $q$),
  ('integer_numbers','contains: 7 ∈ and −3 ∈ (via <@)','eq','true|true','any integer belongs',$q$
    SELECT (7::integer_number <@ integer_numbers())::text || '|' ||
           ((-3)::integer_number <@ integer_numbers())::text $q$),
  ('integer_numbers','it carries the ring arithmetic: (−3) · 4 = −12','eq','-12','integer_number · on the carrier',$q$
    SELECT ((-3)::integer_number * 4::integer_number)::text $q$);

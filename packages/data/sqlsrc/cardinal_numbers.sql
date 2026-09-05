-- requires: realizer
-- cardinal_numbers — the cardinal numbers ℕ ∪ {ℵ₀}, enumerated as the finite cardinals 0,1,2,… (ℵ₀ is their limit,
-- a member but not reached by finite enumeration). Carrier `cardinal`, so the collection carries cardinal arithmetic
-- (+ · with ℵ₀-absorption and the 0-annihilator) and the well-order — browse it in the explorer and evaluate in
-- ℕ ∪ {ℵ₀}. Unbounded, a single infinite fiber (like natural_numbers). The `cardinal` DOMAIN lives in the realizer.
CREATE TYPE cardinal_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f cardinal_numbers_fiber, element_limit int) RETURNS SETOF cardinal LANGUAGE sql STABLE AS $$
  SELECT r::cardinal FROM generate_series(0, element_limit - 1) r $$;                  -- the r-th finite cardinal is r
CREATE FUNCTION contains_in_fiber(f cardinal_numbers_fiber, v cardinal) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT v IS NOT NULL $$;                        -- every cardinal (finite or ℵ₀) belongs; ℵ₀ is a member even so

-- direct unrank (capability layer 3): the ord-th element via a closed form / combinatorial unrank.
CREATE FUNCTION fiber_unrank(f cardinal_numbers_fiber, rank rank_index) RETURNS cardinal LANGUAGE sql IMMUTABLE AS $fu$ SELECT rank::cardinal $fu$;
INSERT INTO base_collection VALUES ('cardinal_numbers', 'cardinal', true);   -- unbounded, ungraded
SELECT base_realize('cardinal_numbers');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('cardinal_numbers','the first cardinals 0..7','eq','0,1,2,3,4,5,6,7','finite cardinals in order',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(cardinal_numbers(), 8) e $q$),
  ('cardinal_numbers','cardinality = infinity (unbounded)','eq','Infinity','endlessly many finite cardinals',$q$
    SELECT cardinality(cardinal_numbers())::text $q$),
  ('cardinal_numbers','ℵ₀ ∈ cardinal_numbers (via <@), and so is 5','eq','true|true','the top is a member too',$q$
    SELECT ('infinity'::cardinal <@ cardinal_numbers())::text || '|' || (5::cardinal <@ cardinal_numbers())::text $q$),
  ('cardinal_numbers','it carries the ring arithmetic: ℵ₀ · 0 = 0 (the 0 annihilator)','eq','0','cardinal_mul on the carrier',$q$
    SELECT ('infinity'::cardinal * 0::cardinal)::text $q$);

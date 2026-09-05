-- requires: realizer
-- natural_numbers — the naturals 0,1,2,… (A001477). Ported from pg-enumeratio-core_old_backup/sqlsrc/natural-numbers.sql.
-- NOTE: the old collection additionally GRADED ℕ by the prime-counting function π (fiber {n : π(n)=k} = [pₖ, p_{k+1}−1],
-- whose least element is the k-th prime — the "primes fall out of grading ℕ by π" thesis, with a prime-TYPED
-- least-element aggregate). That π-grading showcase does not map onto the new single-grade-chain model (it needs an
-- UNBOUNDED grade + a fiber-typed aggregate); it is tracked as a deferred FEATURE, not reproduced here. This port is
-- the base collection: the unbounded, ungraded naturals, matching the other number sets (carrier numeric).

CREATE TYPE natural_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f natural_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  SELECT r::numeric FROM generate_series(0, element_limit - 1) r $$;    -- the r-th natural IS r
CREATE FUNCTION contains_in_fiber(f natural_numbers_fiber, v numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT v >= 0 AND v = trunc(v) $$;                                    -- a non-negative integer

-- direct unrank (capability layer 3): the ord-th element via a closed form / combinatorial unrank.
CREATE FUNCTION fiber_unrank(f natural_numbers_fiber, rank rank_index) RETURNS numeric LANGUAGE sql IMMUTABLE AS $fu$ SELECT rank::numeric $fu$;
INSERT INTO base_collection VALUES ('natural_numbers', 'numeric', true);  -- unbounded, ungraded
CREATE FUNCTION fiber_symbol(f natural_numbers_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'ℕ' $$;   -- corpus symbol
SELECT base_realize('natural_numbers');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('natural_numbers','first eight via the realized floor','eq','0,1,2,3,4,5,6,7','elements over the one infinite fiber',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(natural_numbers(), 8) e $q$),
  ('natural_numbers','the r-th natural is r: unrank(5) = 5','eq','5','off the floor',$q$
    SELECT (unrank(natural_numbers(), 5)).value::text $q$),
  ('natural_numbers','ungraded ⇒ one fiber with empty address','eq','1|{}','fibers(handle)',$q$
    SELECT count(*)::text || '|' || (SELECT fiber_address(f)::text FROM fibers(natural_numbers()) f LIMIT 1) FROM fibers(natural_numbers()) $q$),
  ('natural_numbers','cardinality = infinity (unbounded)','eq','Infinity','one endless fiber',$q$
    SELECT cardinality(natural_numbers())::text $q$),
  ('natural_numbers','contains: 7 ∈, 7.5 ∉, -1 ∉ (via <@)','eq','true|false|false','a non-negative integer',$q$
    SELECT (7::numeric <@ natural_numbers())::text || '|' ||
           (7.5::numeric <@ natural_numbers())::text || '|' ||
           ((-1)::numeric <@ natural_numbers())::text $q$),
  ('natural_numbers','ungraded handle ::text is the bare constructor','eq','natural_numbers()','no axes ⇒ coll()',$q$
    SELECT natural_numbers()::text $q$),
  ('natural_numbers','unnest of the infinite handle raises','eq','true','cardinality = ∞ ⇒ no finite carrier set',$q$
    SELECT base_raises($e$ SELECT count(*) FROM unnest(natural_numbers()) $e$)::text $q$);

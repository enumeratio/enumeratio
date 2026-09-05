-- requires: number-theory, realizer
-- primorial_numbers — product of the first r primes (A002110): 1,2,6,30,210,2310,… Ungraded/∞ numeric.
CREATE FUNCTION primorial_term(r term_index) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE p numeric:=1; i int; BEGIN FOR i IN 1..r LOOP p:=p*nth_prime(i); END LOOP; RETURN p; END $$;
CREATE TYPE primorial_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
-- Each term from the one before it (#307). primorial_term(r) loops 1..r over nth_prime, so calling it once per
-- term made the window O(N²) in prime lookups — 300 terms cost ~45,000 of them, past the selfcert watchdog, and
-- the accel could not be certified at all. The running product is O(N). primorial_term stays as the named twin.
CREATE FUNCTION fiber_elements(f primorial_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  WITH RECURSIVE t(k, val) AS (
    SELECT 0, 1::numeric                                            -- primorial_term(0) = the empty product
     UNION ALL
    SELECT k + 1, val * nth_prime(k + 1) FROM t WHERE k + 1 <= element_limit - 1)
  SELECT val FROM t WHERE k <= element_limit - 1 ORDER BY k $$;
CREATE FUNCTION contains_in_fiber(f primorial_numbers_fiber, v numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$   -- scan the monotonic floor until ≥ v
  WITH RECURSIVE t(k, val) AS (SELECT 0, primorial_term(0) UNION ALL SELECT k+1, primorial_term(k+1) FROM t WHERE val < v)
  SELECT EXISTS (SELECT 1 FROM t WHERE val = v) $$;
-- direct unrank (capability layer 3): the ord-th element via a closed form / combinatorial unrank.
CREATE FUNCTION fiber_unrank(f primorial_numbers_fiber, rank rank_index) RETURNS numeric LANGUAGE sql IMMUTABLE AS $fu$ SELECT primorial_term(rank::term_index) $fu$;
INSERT INTO base_collection VALUES ('primorial_numbers','numeric',true);
CREATE FUNCTION fiber_symbol(f primorial_numbers_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Prim' $$;   -- corpus symbol
SELECT base_realize('primorial_numbers');
INSERT INTO base_example (suite,title,kind,expected,description,sql) VALUES
  ('primorial_numbers','first terms','eq','1,2,6,30,210,2310,30030','product of first r primes',$q$ SELECT string_agg((e).value::text,',' ORDER BY ordinality(e)) FROM elements(primorial_numbers(),7) e $q$),
  ('primorial_numbers','contains via <@: 2310 ∈ (P(5)), 2311 ∉','eq','true|false','floor-scan membership',$q$ SELECT (2310::numeric <@ primorial_numbers())::text || '|' || (2311::numeric <@ primorial_numbers())::text $q$),
  ('primorial_numbers','primorial(n) / primorial(n-1) = nth_prime(n) for n=1..6','eq','true','each step multiplies in exactly the next prime',$q$
    SELECT bool_and((unrank(primorial_numbers(), n)).value / (unrank(primorial_numbers(), n-1)).value = nth_prime(n))
    FROM generate_series(1, 6) n $q$);

-- requires: realizer
-- happy_numbers — iterating "sum of squares of decimal digits" reaches 1 (A007770): 1,7,10,13,19,23,28,…
-- Unhappy numbers fall into the cycle containing 4, so iterate until 1 (happy) or 4 (unhappy).
CREATE FUNCTION digit_square_sum(n numeric) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE m numeric:=trunc(abs(n)); s numeric:=0; d int; BEGIN WHILE m>0 LOOP d:=mod(m,10)::int; s:=s+d*d; m:=div(m,10); END LOOP; RETURN s; END $$;
CREATE FUNCTION is_happy(n numeric) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE m numeric:=n; BEGIN IF n<1 THEN RETURN false; END IF; WHILE m<>1 AND m<>4 LOOP m:=digit_square_sum(m); END LOOP; RETURN m=1; END $$;
CREATE TYPE happy_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f happy_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$ SELECT n::numeric FROM generate_series(1,element_limit*8+50) n WHERE is_happy(n::numeric) LIMIT element_limit $$;
CREATE FUNCTION contains_in_fiber(f happy_numbers_fiber, v numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT is_happy(v) $$;
INSERT INTO base_collection VALUES ('happy_numbers','numeric',true);
CREATE FUNCTION fiber_symbol(f happy_numbers_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Happy' $$;   -- corpus symbol
SELECT base_realize('happy_numbers');
INSERT INTO base_example (suite,title,kind,expected,description,sql) VALUES
  ('happy_numbers','first ten','eq','1,7,10,13,19,23,28,31,32,44','digit-square-sum reaches 1',$q$ SELECT string_agg((e).value::text,',' ORDER BY ordinality(e)) FROM elements(happy_numbers(),10) e $q$),
  ('happy_numbers','contains: 19 ∈, 2 ∉','eq','true|false','',$q$ SELECT (19::numeric <@ happy_numbers())::text||'|'||(2::numeric <@ happy_numbers())::text $q$);

-- requires: realizer, utilities
-- narcissistic_numbers (Armstrong) — sum of (digit)^(#digits) = n (A005188): 0..9,153,370,371,407,… Number set.

CREATE FUNCTION is_narcissistic(n numeric) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE m numeric; d int; s numeric:=0; dig int; BEGIN
    IF n<0 THEN RETURN false; END IF;
    d:=length(trunc(n)::text); m:=trunc(n);
    IF m=0 THEN RETURN true; END IF;  -- 0 = 0^1
    WHILE m>0 LOOP dig:=mod(m,10)::int; s:=s+pow_int(dig,d); m:=div(m,10); END LOOP;
    RETURN s = n;
  END $$;
CREATE TYPE narcissistic_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f narcissistic_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$ SELECT n::numeric FROM generate_series(0,element_limit*20+200) n WHERE is_narcissistic(n::numeric) LIMIT element_limit $$;
CREATE FUNCTION contains_in_fiber(f narcissistic_numbers_fiber, v numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT is_narcissistic(v) $$;
INSERT INTO base_collection VALUES ('narcissistic_numbers','numeric',true);
CREATE FUNCTION fiber_symbol(f narcissistic_numbers_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Arm' $$;   -- corpus symbol
SELECT base_realize('narcissistic_numbers');
INSERT INTO base_example (suite,title,kind,expected,description,sql) VALUES
  ('narcissistic_numbers','first eleven (single digits + 153)','eq','0,1,2,3,4,5,6,7,8,9,153','sum of digit^(#digits)',$q$ SELECT string_agg((e).value::text,',' ORDER BY ordinality(e)) FROM elements(narcissistic_numbers(),11) e $q$),
  ('narcissistic_numbers','contains: 153 ∈ (1+125+27), 154 ∉','eq','true|false','',$q$ SELECT (153::numeric <@ narcissistic_numbers())::text||'|'||(154::numeric <@ narcissistic_numbers())::text $q$),
  ('narcissistic_numbers','decomposed: 1^3+5^3+3^3 = 153, computed directly (not via is_narcissistic)','eq','153|true','',$q$
    SELECT (pow_int(1,3)+pow_int(5,3)+pow_int(3,3))::text || '|' || (pow_int(1,3)+pow_int(5,3)+pow_int(3,3) = 153)::text $q$),
  ('narcissistic_numbers','1634 is a 4-digit narcissistic number (1^4+6^4+3^4+4^4)','eq','true','',$q$
    SELECT is_narcissistic(1634)::text $q$);

-- requires: realizer
-- tribonacci_numbers — T(0)=0,T(1)=0,T(2)=1,T(n)=T(n-1)+T(n-2)+T(n-3): 0,0,1,1,2,4,7,13,24,… Ungraded/∞ numeric.
CREATE FUNCTION tribonacci_term(r term_index) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE a numeric:=0; b numeric:=0; c numeric:=1; d numeric; i int; BEGIN
    IF r=0 OR r=1 THEN RETURN 0; END IF; IF r=2 THEN RETURN 1; END IF;
    FOR i IN 3..r LOOP d:=a+b+c; a:=b; b:=c; c:=d; END LOOP; RETURN c; END $$;
CREATE TYPE tribonacci_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f tribonacci_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  SELECT tribonacci_term(r) FROM generate_series(0, element_limit-1) r $$;
CREATE FUNCTION fiber_unrank(f tribonacci_numbers_fiber, rank rank_index) RETURNS numeric LANGUAGE sql IMMUTABLE AS $fu$ SELECT tribonacci_term(rank::term_index) $fu$;
INSERT INTO base_collection VALUES ('tribonacci_numbers','numeric',true);
INSERT INTO base_monotonic_sequence VALUES ('tribonacci_numbers');   -- non-decreasing: synth a scanning contains
SELECT base_realize('tribonacci_numbers');
INSERT INTO base_example (suite,title,kind,expected,description,sql) VALUES
  ('tribonacci_numbers','first terms','eq','0,0,1,1,2,4,7,13,24','sum of previous 3',$q$ SELECT string_agg((e).value::text,',' ORDER BY ordinality(e)) FROM elements(tribonacci_numbers(),9) e $q$),
  ('tribonacci_numbers','indexable + synthesized contains: unrank(8)=24, 24 ∈, 25 ∉','eq','24|true|false','fiber_unrank + the non-decreasing scan',$q$ SELECT (unrank(tribonacci_numbers(),8)).value::text||'|'||(24::numeric<@tribonacci_numbers())::text||'|'||(25::numeric<@tribonacci_numbers())::text $q$),
  ('tribonacci_numbers','recurrence holds off the floor: T(n) = T(n-1)+T(n-2)+T(n-3) for n=3..8','eq','true','accelerated unrank cross-checked against its own recurrence',$q$
    SELECT bool_and((unrank(tribonacci_numbers(), n)).value = (unrank(tribonacci_numbers(), n-1)).value + (unrank(tribonacci_numbers(), n-2)).value + (unrank(tribonacci_numbers(), n-3)).value)
    FROM generate_series(3, 8) n $q$),
  ('tribonacci_numbers','unrank(10) = 81','eq','81','off the floor, past the first-terms window',$q$
    SELECT (unrank(tribonacci_numbers(), 10)).value::text $q$),
  ('tribonacci_numbers','cardinality = infinity (unbounded)','eq','Infinity','one endless fiber',$q$
    SELECT cardinality(tribonacci_numbers())::text $q$);

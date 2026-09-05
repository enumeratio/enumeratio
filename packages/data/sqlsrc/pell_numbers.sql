-- requires: realizer
-- pell_numbers — P(0)=0,P(1)=1,P(n)=2P(n-1)+P(n-2): 0,1,2,5,12,29,70,169,… Ungraded/∞ numeric.
CREATE FUNCTION pell_term(r term_index) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE a numeric:=0; b numeric:=1; t numeric; i int; BEGIN
    IF r=0 THEN RETURN 0; END IF; FOR i IN 2..r LOOP t:=2*b+a; a:=b; b:=t; END LOOP; RETURN b; END $$;
CREATE TYPE pell_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f pell_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  SELECT pell_term(r) FROM generate_series(0, element_limit-1) r $$;
-- direct unrank (capability layer 3): the ord-th element via a closed form / combinatorial unrank.
CREATE FUNCTION fiber_unrank(f pell_numbers_fiber, rank rank_index) RETURNS numeric LANGUAGE sql IMMUTABLE AS $fu$ SELECT pell_term(rank::term_index) $fu$;
INSERT INTO base_collection VALUES ('pell_numbers','numeric',true);
INSERT INTO base_monotonic_sequence VALUES ('pell_numbers');   -- non-decreasing: synth a scanning contains
SELECT base_realize('pell_numbers');
INSERT INTO base_example (suite,title,kind,expected,description,sql) VALUES
  ('pell_numbers','first terms','eq','0,1,2,5,12,29,70,169,408','2·prev+prev2',$q$ SELECT string_agg((e).value::text,',' ORDER BY ordinality(e)) FROM elements(pell_numbers(),9) e $q$);

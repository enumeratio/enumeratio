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
  ('pell_numbers','first terms','eq','0,1,2,5,12,29,70,169,408','2·prev+prev2',$q$ SELECT string_agg((e).value::text,',' ORDER BY ordinality(e)) FROM elements(pell_numbers(),9) e $q$),
  ('pell_numbers','unrank(9) = 985 = 2·408+169','eq','985','off the floor',$q$ SELECT (unrank(pell_numbers(), 9)).value::text $q$),
  ('pell_numbers','cardinality = infinity (unbounded)','eq','Infinity','one endless fiber',$q$ SELECT cardinality(pell_numbers())::text $q$),
  ('pell_numbers','contains via synthesized scan: 169 ∈, 170 ∉','eq','true|false','monotonic-sequence contains + <@',$q$ SELECT (169::numeric <@ pell_numbers())::text || '|' || (170::numeric <@ pell_numbers())::text $q$),
  ('pell_numbers','recurrence holds off the floor: P(n) = 2·P(n-1)+P(n-2) for n=2..8','eq','true','independent re-derivation via unrank, not fiber_elements',$q$
    SELECT bool_and((unrank(pell_numbers(), n)).value = 2*(unrank(pell_numbers(), n-1)).value + (unrank(pell_numbers(), n-2)).value)::text FROM generate_series(2,8) n $q$);

-- requires: realizer
-- jacobsthal_numbers — J(0)=0,J(1)=1,J(n)=J(n-1)+2J(n-2): 0,1,1,3,5,11,21,43,… Ungraded/∞ numeric.
CREATE FUNCTION jacobsthal_term(r term_index) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE a numeric:=0; b numeric:=1; t numeric; i int; BEGIN
    IF r=0 THEN RETURN 0; END IF; FOR i IN 2..r LOOP t:=b+2*a; a:=b; b:=t; END LOOP; RETURN b; END $$;
CREATE TYPE jacobsthal_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f jacobsthal_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$ SELECT jacobsthal_term(r) FROM generate_series(0,element_limit-1) r $$;
-- direct unrank (capability layer 3): the ord-th element via a closed form / combinatorial unrank.
CREATE FUNCTION fiber_unrank(f jacobsthal_numbers_fiber, rank rank_index) RETURNS numeric LANGUAGE sql IMMUTABLE AS $fu$ SELECT jacobsthal_term(rank::term_index) $fu$;
INSERT INTO base_collection VALUES ('jacobsthal_numbers','numeric',true);
INSERT INTO base_monotonic_sequence VALUES ('jacobsthal_numbers');   -- non-decreasing: synth a scanning contains
SELECT base_realize('jacobsthal_numbers');
INSERT INTO base_example (suite,title,kind,expected,description,sql) VALUES
  ('jacobsthal_numbers','first terms','eq','0,1,1,3,5,11,21,43,85','J(n-1)+2J(n-2)',$q$ SELECT string_agg((e).value::text,',' ORDER BY ordinality(e)) FROM elements(jacobsthal_numbers(),9) e $q$),
  ('jacobsthal_numbers','synthesized contains handles the plateau: 21 ∈, 1 ∈ (repeated term), 4 ∉','eq','true|true|false','non-decreasing scan is plateau-safe',$q$ SELECT (21::numeric<@jacobsthal_numbers())::text||'|'||(1::numeric<@jacobsthal_numbers())::text||'|'||(4::numeric<@jacobsthal_numbers())::text $q$);

-- requires: number-theory, realizer
-- achilles_numbers — powerful but NOT a perfect power (A052486): 72,108,200,288,392,432,…
CREATE TYPE achilles_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f achilles_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$ SELECT n::numeric FROM generate_series(2,element_limit*100+200) n WHERE is_achilles(n::numeric) LIMIT element_limit $$;
CREATE FUNCTION contains_in_fiber(f achilles_numbers_fiber, v numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT is_achilles(v) $$;
INSERT INTO base_collection VALUES ('achilles_numbers','numeric',true);
CREATE FUNCTION fiber_symbol(f achilles_numbers_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Achilles' $$;   -- corpus symbol
SELECT base_realize('achilles_numbers');
INSERT INTO base_example (suite,title,kind,expected,description,sql) VALUES
  ('achilles_numbers','first six','eq','72,108,200,288,392,432','powerful, not a perfect power',$q$ SELECT string_agg((e).value::text,',' ORDER BY ordinality(e)) FROM elements(achilles_numbers(),6) e $q$),
  ('achilles_numbers','cardinality = infinity (unbounded)','eq','Infinity','achilles numbers are infinite',$q$ SELECT cardinality(achilles_numbers())::text $q$),
  ('achilles_numbers','membership: 72 ∈ (Achilles), 64 ∉ (powerful but a perfect power, 2^6)','eq','true|false','contains_in_fiber via is_achilles + <@',$q$
    SELECT (72::numeric <@ achilles_numbers())::text || '|' || (64::numeric <@ achilles_numbers())::text $q$),
  ('achilles_numbers','decomposed re-check: every generated term is powerful AND not a perfect power','eq','true','independent is_powerful/is_perfect_power cross-check (not just is_achilles again)',$q$
    SELECT bool_and(is_powerful((e).value) AND NOT is_perfect_power((e).value))::text FROM elements(achilles_numbers(),6) e $q$);

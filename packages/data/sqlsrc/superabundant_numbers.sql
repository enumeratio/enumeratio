-- requires: aliquot, realizer
-- superabundant_numbers — n whose abundancy index σ(n)/n exceeds that of every smaller n (A004394): 1,2,4,6,12,24,36,
-- 48,60,120,180,240,360,720,840,1260,1680,2520,5040,10080,… Alaoglu–Erdős (1944). Robin's theorem ties the bound
-- σ(n)/n < e^γ ln ln n (for n > 5040) to the Riemann Hypothesis. Like the HCNs this is a record property over all
-- smaller n — no local predicate — so the floor is a literal seed and contains is membership. Unbounded ⇒ ∞.
-- (σ(n) = aliquot_sum(n) + n, from 48-aliquot.)

CREATE FUNCTION superabundant_numbers_seed() RETURNS numeric[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY[1,2,4,6,12,24,36,48,60,120,180,240,360,720,840,1260,1680,2520,5040,10080,15120,25200,27720,
    55440,110880,166320]::numeric[] $$;

CREATE TYPE superabundant_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f superabundant_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  SELECT v FROM unnest(superabundant_numbers_seed()) WITH ORDINALITY AS t(v, o) ORDER BY o LIMIT element_limit $$;
CREATE FUNCTION contains_in_fiber(f superabundant_numbers_fiber, v numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT v = ANY(superabundant_numbers_seed()) $$;

INSERT INTO base_collection VALUES ('superabundant_numbers', 'numeric', true);   -- unbounded, ungraded
CREATE FUNCTION fiber_symbol(f superabundant_numbers_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'SA' $$;   -- corpus symbol
SELECT base_realize('superabundant_numbers');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('superabundant_numbers','first ten via the realized floor','eq','1,2,4,6,12,24,36,48,60,120','A004394',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(superabundant_numbers(), 10) e $q$),
  ('superabundant_numbers','the abundancy index σ(n)/n strictly increases along the sequence','ok',NULL,'the defining record property',$q$
    SELECT bool_and((aliquot_sum(v) + v) * prev > (aliquot_sum(prev) + prev) * v) FROM (
      SELECT v, lag(v) OVER (ORDER BY o) prev FROM unnest(superabundant_numbers_seed()) WITH ORDINALITY AS t(v, o)) s
      WHERE prev IS NOT NULL $q$),
  ('superabundant_numbers','diverges from the HCNs at rank 19: 10080 not 7560','eq','10080','superabundant ≠ highly composite',$q$
    SELECT (unrank(superabundant_numbers(), 19)).value::text $q$),
  ('superabundant_numbers','contains via <@: 5040 ∈ (Robin''s threshold), 7560 ∉ (an HCN, not superabundant)','eq','true|false','record-property membership',$q$
    SELECT (5040::numeric <@ superabundant_numbers())::text || '|' || (7560::numeric <@ superabundant_numbers())::text $q$);

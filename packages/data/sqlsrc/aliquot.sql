-- Aliquot (proper-divisor) primitives — shared by the perfect/abundant/deficient number families so they don't
-- each redefine them. aliquot_sum(n) = σ(n) − n = sum of proper divisors.

CREATE FUNCTION aliquot_sum(n numeric) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(sum(d), 0)::numeric FROM generate_series(1, greatest(div(n, 2)::bigint, 1)) d WHERE n > 1 AND mod(n, d) = 0 $$;
CREATE FUNCTION is_perfect_number(n numeric)   RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT n > 1 AND aliquot_sum(n) = n $$;
CREATE FUNCTION is_abundant_number(n numeric)  RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT n > 0 AND aliquot_sum(n) > n $$;
CREATE FUNCTION is_deficient_number(n numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT n > 0 AND aliquot_sum(n) < n $$;

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('aliquot','perfect numbers to 30 are 6, 28','eq','6,28','aliquot_sum = n',$q$
    SELECT string_agg(n::text, ',' ORDER BY n) FROM generate_series(2,30) n WHERE is_perfect_number(n) $q$),
  ('aliquot','aliquot_sum(12) = 16 (abundant)','eq','16|true','1+2+3+4+6',$q$
    SELECT aliquot_sum(12)::text || '|' || is_abundant_number(12)::text $q$);

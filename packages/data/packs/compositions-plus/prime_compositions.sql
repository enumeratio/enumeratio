-- requires: integer_compositions, number-theory, realizer
-- prime_compositions — compositions of n into positive PRIME parts {2,3,5,7,…}; ordered sums, order matters.
-- Ported from old-backup sqlsrc/prime-compositions.sql (OEIS A023360). base_restrict of integer_compositions
-- (carrier `composition`, ordered positive parts, gap-cut floor): filter the parent's floor down to compositions
-- whose every part is prime. Reuses the parent's carrier + notation; own count/order/contains fall out of
-- base_restrict re-ranking the filtered floor.

CREATE FUNCTION is_prime_composition(v composition) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT NOT EXISTS (SELECT 1 FROM unnest((v).parts) p WHERE NOT is_prime_number(p::numeric)) $$;   -- empty composition qualifies vacuously

SELECT base_restrict('prime_compositions', 'integer_compositions', 'is_prime_composition');

CREATE FUNCTION fiber_symbol(f prime_compositions_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'PCom(' || (f).n::int || ')' $$;   -- corpus symbol

SELECT wire_set_notation('prime_compositions');


-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES

  ('prime_compositions','|prime_compositions(2)| = 1','eq','1','Just "2".',$q$
    SELECT cardinality(prime_compositions(2))::text $q$),

  ('prime_compositions','|prime_compositions(5)| = 3','eq','3','5, 2+3, 3+2.',$q$
    SELECT cardinality(prime_compositions(5))::text $q$),

  ('prime_compositions','|prime_compositions(7)| = 6','eq','6','7; 2+5,5+2; 2+2+3,2+3+2,3+2+2.',$q$
    SELECT cardinality(prime_compositions(7))::text $q$),

  ('prime_compositions','count anchor n=0..10','eq','1,0,1,1,1,3,2,6,6,10,16','direct-sum recurrence over primes (A023360)',$q$
    SELECT string_agg(cardinality(prime_compositions(n))::text, ',' ORDER BY n) FROM generate_series(0,10) n $q$),

  ('prime_compositions','compositions of 5 into primes, parent mask order','eq','5,2+3,3+2','5 is itself prime, so it survives the filter too, in gap-cut mask order',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(prime_compositions(5)) e $q$),

  ('prime_compositions','every part of every composition of 8 is prime','eq','true','the defining invariant across the whole fiber',$q$
    SELECT bool_and(NOT EXISTS (SELECT 1 FROM unnest(((e).value).parts) p WHERE NOT is_prime_number(p::numeric)))::text
      FROM elements(prime_compositions(8)) e $q$),

  ('prime_compositions','every composition of 9 sums to 9','eq','true','the composition invariant, inherited from the parent floor',$q$
    SELECT bool_and((SELECT coalesce(sum(p),0) FROM unnest(((e).value).parts) p) = 9)::text FROM elements(prime_compositions(9)) e $q$),

  ('prime_compositions','contains via <@: 2+3 ∈ prime_compositions(5), 1+4 ∉ (has non-prime parts)','eq','true|false','derived membership = parent ∧ predicate',$q$
    SELECT (ROW(ARRAY[2,3])::composition <@ prime_compositions(5))::text || '|' ||
           (ROW(ARRAY[1,4])::composition <@ prime_compositions(5))::text $q$);

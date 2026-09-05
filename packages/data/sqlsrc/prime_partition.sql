-- requires: integer_partitions, number-theory, realizer
-- prime_partition — partitions of n into PRIME parts {2,3,5,7,…} (unordered, descending). Count = A000607:
-- 1,0,1,1,1,2,2,3,3,4,5,6,7,9,10 for n=0..14 (n=0 the empty partition; n=1 empty since 1 is not prime). The
-- unordered companion of prime_compositions (ordered prime sums). A base_restrict of integer_partitions: same
-- carrier + grade [n], the descending-lex floor filtered to all-prime-part partitions, realizer re-ranks.

CREATE FUNCTION is_prime_partition(v integer_partition) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT NOT EXISTS (SELECT 1 FROM unnest((v).parts) x WHERE NOT is_prime_number(x::numeric)) $$;   -- empty partition qualifies vacuously

SELECT base_restrict('prime_partition', 'integer_partitions', 'is_prime_partition');
CREATE FUNCTION fiber_symbol(f prime_partition_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'PP(' || (f).n::int || ')' $$;   -- corpus symbol
SELECT wire_set_notation('prime_partition');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('prime_partition','count for n=0..14: 1,0,1,1,1,2,2,3,3,4,5,6,7,9,10 (A000607)','eq','1,0,1,1,1,2,2,3,3,4,5,6,7,9,10','partitions into prime parts',$q$
    SELECT string_agg(cardinality(prime_partition(n))::text, ',' ORDER BY n) FROM generate_series(0,14) n $q$),
  ('prime_partition','n=1 has none (1 is not prime); n=4 is just 2+2','eq','0|1','the empty fiber and the singleton 2+2',$q$
    SELECT cardinality(prime_partition(1))::text || '|' || cardinality(prime_partition(4))::text $q$),
  ('prime_partition','partitions of 7 into primes, in order','eq','7,5+2,3+2+2','the filtered floor for fiber [7]',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(prime_partition(7)) e $q$),
  ('prime_partition','every part is prime across a fiber (n=12)','eq','true','structural invariant over the whole fiber',$q$
    SELECT bool_and(is_prime_partition((e).value)) FROM elements(prime_partition(12)) e $q$),
  ('prime_partition','contains via <@: 3+2+2 ∈ prime_partition(7); 4+3 ∉ (4 composite), 6+1 ∉','eq','true|false|false','derived membership = parent ∧ predicate',$q$
    SELECT (ROW(ARRAY[3,2,2])::integer_partition <@ prime_partition(7))::text || '|' ||
           (ROW(ARRAY[4,3])::integer_partition <@ prime_partition(7))::text || '|' ||
           (ROW(ARRAY[6,1])::integer_partition <@ prime_partition(7))::text $q$);

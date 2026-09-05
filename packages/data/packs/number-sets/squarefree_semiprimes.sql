-- requires: natural_numbers, number-predicates
-- squarefree_semiprimes — products of two DISTINCT primes n = p·q, p<q (Ω=2 ∧ ω=2), A006881: 6,10,14,15,21,22,…
-- A strict subset of the semiprimes, excluding the prime squares 4,9,25,… A base_restrict specialization of
-- natural_numbers by is_squarefree_semiprime (which delegates to the factored carrier). Semiprimes are the tighter
-- natural parent, but restricting the naturals directly keeps the floor a single over-scan (no nested window).
SELECT base_restrict('squarefree_semiprimes', 'natural_numbers', 'is_squarefree_semiprime');
CREATE FUNCTION fiber_symbol(f squarefree_semiprimes_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'QfSP' $$;   -- corpus symbol
SELECT wire_set_notation('squarefree_semiprimes');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('squarefree_semiprimes','first eight — A006881','eq','6,10,14,15,21,22,26,33','p·q with p<q distinct primes',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(squarefree_semiprimes(), 8) e $q$),
  ('squarefree_semiprimes','excludes prime squares: 6 ∈, 9 ∉ (=3², ω=1), 12 ∉ (=2²·3, Ω=3)','eq','true|false|false','strict subset of semiprimes',$q$
    SELECT (6::numeric <@ squarefree_semiprimes())::text || '|' ||
           (9::numeric <@ squarefree_semiprimes())::text || '|' ||
           (12::numeric <@ squarefree_semiprimes())::text $q$),
  ('squarefree_semiprimes','cardinality = infinity','eq','Infinity','unbounded number set',$q$
    SELECT cardinality(squarefree_semiprimes())::text $q$),
  ('squarefree_semiprimes','parent is natural_numbers','eq','natural_numbers|is_squarefree_semiprime','base_collection_parent records the specialization',$q$
    SELECT parent || '|' || predicate FROM base_collection_parent WHERE collection = 'squarefree_semiprimes' $q$);

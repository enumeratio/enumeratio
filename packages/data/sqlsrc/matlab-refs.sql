-- requires: references
-- MATLAB cross-references as base_reference rows (system='matlab', first introduced here) — same UNIFORM
-- cross-reference layer as wolfram-refs.sql/oeis-refs.sql (keyed by (subject, system, identity), listed side by
-- side in the explorer's identity strip). Coverage audit against MATLAB's own documentation
-- (mathworks.com/help/matlab/, mathworks.com/help/symbolic/, mathworks.com/help/stats/) — no live kernel available
-- in this environment (no MATLAB/Octave install), so every row is DOCUMENTATION-verified only: each function's
-- own definition/indexing on its MathWorks reference page, not a name-coincidence.
--
-- MATLAB is a numerical-computing platform, not a dedicated combinatorics system like Sage — coverage here is
-- deliberately thin. Base MATLAB contributes the handful of counting/enumeration builtins (nchoosek, perms,
-- factorial, primes, factor); the Symbolic Math Toolbox and Statistics and Machine Learning Toolbox add almost
-- nothing beyond that for THIS catalog's shape:
--   - Symbolic Math Toolbox: bernoulli(n) and euler(n) exist (special-function evaluators, not enumerators), but
--     there is no bernoulli_numbers collection to point at, and euler(n) is the same signed alternating-sign
--     Euler-number convention wolfram-refs.sql already excluded EulerE for — it only agrees with
--     alternating_permutations at even n (WL/MATLAB Euler numbers are 0 at odd n>1, unlike the full zigzag
--     sequence) — no row, same reasoning as the wolfram exclusion. No StirlingS1/S2, BellB, or PartitionsP/Q
--     equivalent exists in the Symbolic Math Toolbox per its own function reference — no rows.
--   - Statistics and Machine Learning Toolbox: fullfact(levels) generates a mixed-radix full-factorial design
--     (each factor can have a DIFFERENT level count) — more general than any single fixed-alphabet collection
--     here (words() takes one base for every position), so it isn't a clean match to one identity; excluded
--     rather than forced. No other combinatorial-enumeration function found in this toolbox's reference.
--   - combnk(v,k) is a deprecated alias of nchoosek(v,k) per MATLAB's own docs — redundant with the nchoosek row
--     below, excluded to avoid a duplicate pointer to the same identity.
INSERT INTO base_reference (subject_kind, subject, system, identity, url, delta) VALUES
  ('collection','k_subsets',               'matlab','nchoosek', 'https://www.mathworks.com/help/matlab/ref/nchoosek.html','nchoosek has two modes: nchoosek(n,k) is the scalar binomial coefficient C(n,k) (matches fiber_count(k_subsets(n),k)); nchoosek(v,k) with a length-m vector v enumerates all k-element combinations of v in the order elements appear in v (not necessarily our canonical order)'),
  ('collection','permutations',            'matlab','perms',    'https://www.mathworks.com/help/matlab/ref/perms.html','perms(v) returns all n! permutations of v, but in reverse-lexicographic order of the element indices — our permutations() fiber_unrank/elements() order is plain lexicographic ascending, so the SET matches but the ORDER does not'),
  ('collection','factorial_numbers',       'matlab','factorial','https://www.mathworks.com/help/matlab/ref/factorial.html','factorial(0) = 1, matches our n=0 term exactly; both agree for all n'),
  ('collection','prime_numbers',           'matlab','primes',   'https://www.mathworks.com/help/matlab/ref/primes.html','primes(n) returns all primes ≤ n (a value-bounded set, count depends on n) — our prime_numbers is RANK-indexed (the k-th prime by index); the underlying set is the same, only the query shape differs'),
  ('collection','integer_factorizations',  'matlab','factor',   'https://www.mathworks.com/help/matlab/ref/factor.html','factor(n) returns the flat vector of prime factors with multiplicity in ascending order (e.g. factor(200) = [2 2 2 5 5]) — our integer_factorizations carries the same multiset in exponent notation (2^3·5^2); factors(factored(n)) recovers MATLAB''s flat multiset directly');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('references','every MATLAB pointer resolves to a real collection (integrity, no FK)','eq','0','no dangling subject in the matlab layer',$q$
    SELECT count(*)::text FROM base_reference r WHERE r.system='matlab'
      AND NOT EXISTS (SELECT 1 FROM base_collection c WHERE c.id = r.subject) $q$),
  ('references','the exact-match matlab pointers agree with each collection''s own values (small n)','eq','1,1,2,6,24,120|2,3,5,7,11,13,17,19,23|{2,2,2,5,5}|24','factorial(0..5) / primes(25) first 9 / factor(200) / perms([1 2 3 4]) row count',$q$
    SELECT concat_ws('|',
      (SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(factorial_numbers(), 6) e),
      (SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(prime_numbers(), 9) e),
      (SELECT factors(factored(200))::text),
      (SELECT cardinality(permutations(4))::text)) $q$);

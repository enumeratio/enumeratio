-- requires: references
-- Wolfram Language cross-references as base_reference rows (system='wolfram') — same UNIFORM cross-reference
-- layer as oeis-refs.sql (keyed by (subject, system, identity), listed side by side in the explorer's identity
-- strip). Coverage audit against WL's named counting functions (issue #136, from the kimi-k3 prior-art pass):
-- PartitionsP/Q, BellB, StirlingS1/S2, Subfactorial, CatalanNumber, PolygonalNumber, Fibonacci, LucasL,
-- Binomial. Each row verified against reference.wolfram.com — the function's own indexing/definition, not just
-- OEIS-number coincidence. Gaps (no WL builtin, or no matching collection) are NOT rows here — see the issue
-- close-out for the list: DeBruijnSequence, Multinomial, MotzkinNumber, NarayanaNumber, DelannoyNumber,
-- FubiniNumber, Eulerian (none exist as WL symbols per reference.wolfram.com — Eulerian numbers are core-language
-- gaps too, not just Narayana/Motzkin/Delannoy), EulerE (exists, but only matches alternating_permutations at
-- even n — WL's Euler numbers are 0 at odd n>1, unlike the full zigzag sequence — no row).
--
-- Second pass (2026-09-04, issue #136 follow-up): q-analogs QBinomial and QFactorial DO exist as WL builtins
-- (introduced 7.0) and match collections whose in-repo generating-function registry (generating_functions.sql)
-- already proves the identity via gf_qbinomial / gf_qfactorial — not a fresh claim, a cross-reference to math
-- already asserted and self-tested here. Also added: Factorial2 (double factorial) and FactorialPower (falling
-- factorial), both exact unshifted matches. Checked and NOT added: Multinomial (exists as a WL builtin, but no
-- enumeratio collection counts multiset-word arrangements/anagrams — multisets here counts multichoose, a
-- different quantity); BellY (Bell polynomials, multivariate — no single-stat collection match); Hyperfactorial,
-- FrobeniusNumber, FiniteGroupCount/FiniteAbelianGroupCount (no combinatorial-collection counterpart in the
-- catalog); no WL builtin for Young tableaux (standard or semistandard) was found on reference.wolfram.com's
-- combinatorics guide — no row for standard_tableaux/semistandard_tableaux.
INSERT INTO base_reference (subject_kind, subject, system, identity, url, delta) VALUES
  ('collection','catalan_numbers',              'wolfram','CatalanNumber','https://reference.wolfram.com/language/ref/CatalanNumber.html',''),
  ('collection','integer_partitions',           'wolfram','PartitionsP',  'https://reference.wolfram.com/language/ref/PartitionsP.html',''),
  ('collection','distinct_partitions',          'wolfram','PartitionsQ',  'https://reference.wolfram.com/language/ref/PartitionsQ.html',''),
  ('collection','bell_numbers',                 'wolfram','BellB',        'https://reference.wolfram.com/language/ref/BellB.html',''),
  ('collection','set_partitions',               'wolfram','BellB',        'https://reference.wolfram.com/language/ref/BellB.html','cardinality(set_partitions(n)) = BellB(n); the set-partition collection whose count BellB gives, alongside the plain sequence at bell_numbers'),
  ('collection','set_partitions_into_k_blocks', 'wolfram','StirlingS2',   'https://reference.wolfram.com/language/ref/StirlingS2.html',''),
  ('collection','k_cycle_permutations',         'wolfram','StirlingS1',   'https://reference.wolfram.com/language/ref/StirlingS1.html','WL StirlingS1 is SIGNED; our fiber count is the unsigned cycle-count c(n,k) = |StirlingS1(n,k)|'),
  ('collection','derangements',                 'wolfram','Subfactorial', 'https://reference.wolfram.com/language/ref/Subfactorial.html',''),
  ('collection','fibonacci_numbers',            'wolfram','Fibonacci',    'https://reference.wolfram.com/language/ref/Fibonacci.html',''),
  ('collection','lucas_numbers',                'wolfram','LucasL',       'https://reference.wolfram.com/language/ref/LucasL.html',''),
  ('collection','k_subsets',                    'wolfram','Binomial',     'https://reference.wolfram.com/language/ref/Binomial.html','fiber_count(n,k) = Binomial(n,k)'),
  -- PolygonalNumber(r, n): the generalized r-gonal number of index n, 0-indexed (PolygonalNumber(r,0)=0,
  -- PolygonalNumber(r,1)=1) — matches each shape collection's r=0,1,2,… directly, no offset.
  ('collection','triangular_numbers',           'wolfram','PolygonalNumber','https://reference.wolfram.com/language/ref/PolygonalNumber.html','r=3 fixed for the triangular case; PolygonalNumber(3,r) — their n = our r'),
  ('collection','square_numbers',               'wolfram','PolygonalNumber','https://reference.wolfram.com/language/ref/PolygonalNumber.html','r=4 fixed for the square case; PolygonalNumber(4,r) — their n = our r'),
  ('collection','pentagonal_numbers',           'wolfram','PolygonalNumber','https://reference.wolfram.com/language/ref/PolygonalNumber.html','r=5 fixed for the pentagonal case; PolygonalNumber(5,r) — their n = our r'),
  ('collection','hexagonal_numbers',            'wolfram','PolygonalNumber','https://reference.wolfram.com/language/ref/PolygonalNumber.html','r=6 fixed for the hexagonal case; PolygonalNumber(6,r) — their n = our r'),
  ('collection','heptagonal_numbers',           'wolfram','PolygonalNumber','https://reference.wolfram.com/language/ref/PolygonalNumber.html','r=7 fixed for the heptagonal case; PolygonalNumber(7,r) — their n = our r'),
  ('collection','octagonal_numbers',            'wolfram','PolygonalNumber','https://reference.wolfram.com/language/ref/PolygonalNumber.html','r=8 fixed for the octagonal case; PolygonalNumber(8,r) — their n = our r'),
  -- q-analogs: QBinomial[n,m,q] and QFactorial[n,q] are real WL builtins (introduced 7.0), verified on their own
  -- reference pages. Both already have an in-repo proof, not just a name match: generating_functions.sql registers
  -- gf_qbinomial / gf_qfactorial as the exact coefficient-producing builders for these collections' stat gradings.
  ('collection','box_confined_partitions',      'wolfram','QBinomial',    'https://reference.wolfram.com/language/ref/QBinomial.html','grouping box_confined_partitions(parts,max_part) by |λ| gives QBinomial[parts+max_part,parts,q] coefficients (box_confined_partitions.sql''s own "THE GEM" self-test); cardinality = QBinomial[parts+max_part,parts,1] = Binomial(parts+max_part,parts)'),
  ('collection','permutations',                 'wolfram','QFactorial',   'https://reference.wolfram.com/language/ref/QFactorial.html','grouping permutations(n) by inversions (or major_index) gives QFactorial[n,q] coefficients — the Mahonian distribution [n]_q! (generating_functions.sql: gf_qfactorial); cardinality = QFactorial[n,1] = n!'),
  -- Factorial2[n] (double factorial) and FactorialPower[x,n] (falling factorial) — exact, unshifted matches.
  ('collection','double_factorial_numbers',     'wolfram','Factorial2',   'https://reference.wolfram.com/language/ref/Factorial2.html','our fiber index n ↦ (2n−1)!! = Factorial2[2n-1]; both use the (-1)!!=1 convention at n=0'),
  ('collection','arrangements',                 'wolfram','FactorialPower','https://reference.wolfram.com/language/ref/FactorialPower.html','fiber_count(n,k) = P(n,k) = n!/(n-k)! = FactorialPower[n,k], the 2-argument falling-factorial form');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('references','every Wolfram pointer resolves to a real collection (integrity, no FK)','eq','0','no dangling subject in the wolfram layer — scoped to subject_kind=''collection''; a non-collection subject_kind (e.g. ''function'', base_function.sql) resolves against its own registry instead',$q$
    SELECT count(*)::text FROM base_reference r WHERE r.system='wolfram' AND r.subject_kind='collection'
      AND NOT EXISTS (SELECT 1 FROM base_collection c WHERE c.id = r.subject) $q$),
  ('references','PolygonalNumber covers all six named shape collections','eq','6','triangular/square/pentagonal/hexagonal/heptagonal/octagonal, one row each',$q$
    SELECT count(*)::text FROM base_reference WHERE system='wolfram' AND identity='PolygonalNumber' $q$),
  ('references','BellB points from at least bell_numbers and set_partitions (one identity, many roles; a floor — more may be added)','eq','true','mirrors the oeis A000110 dual-pointer pattern',$q$
    SELECT (array_agg(subject) @> ARRAY['bell_numbers','set_partitions'])::text FROM base_reference WHERE system='wolfram' AND identity='BellB' $q$),
  ('references','the exact-match wolfram pointers agree with each collection''s own cardinality (small n)','eq','1,1,2,5,15,52|1,1,2,3,5,7|1,1,1,2,2,3|0,1,1,2,3,5|2,1,3,4,7,11|1,0,1,2,9,44','BellB / PartitionsP / PartitionsQ / Fibonacci / LucasL / Subfactorial',$q$
    SELECT concat_ws('|',
      (SELECT string_agg(cardinality(set_partitions(n))::text, ',' ORDER BY n) FROM generate_series(0,5) n),
      (SELECT string_agg(cardinality(integer_partitions(n))::text, ',' ORDER BY n) FROM generate_series(0,5) n),
      (SELECT string_agg(cardinality(distinct_partitions(n))::text, ',' ORDER BY n) FROM generate_series(0,5) n),
      (SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(fibonacci_numbers(), 6) e),
      (SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(lucas_numbers(), 6) e),
      (SELECT string_agg(cardinality(derangements(n))::text, ',' ORDER BY n) FROM generate_series(0,5) n)) $q$),
  ('references','QBinomial[4,2,q] via box_confined_partitions(2,2) grouped by |λ| matches gf_qbinomial(4,2)','eq','true','the q-binomial row, computed two ways',$q$
    SELECT (ARRAY(SELECT c FROM (
              SELECT coalesce((SELECT sum(x) FROM unnest(((e).value).parts) x), 0) s, count(*) c
              FROM elements(box_confined_partitions(2,2)) e GROUP BY 1 ORDER BY s) t)::numeric[]
            = gf_qbinomial(4,2))::text $q$),
  ('references','QFactorial[4,q] via permutations(4) grouped by inversions matches gf_qfactorial(4); cardinality = QFactorial[4,1] = 24','eq','true|24','the Mahonian row, computed two ways, plus the q=1 specialization',$q$
    SELECT (ARRAY(SELECT c FROM (SELECT perm_inversions((e).value) k, count(*) c FROM elements(permutations(4)) e GROUP BY 1 ORDER BY 1) t)::numeric[]
            = gf_qfactorial(4))::text || '|' ||
           (SELECT sum(x)::text FROM unnest(gf_qfactorial(4)) x) $q$),
  ('references','Factorial2: double_factorial_numbers(n) = (2n-1)!! for n=0..5','eq','1,1,3,15,105,945','matches Factorial2[2n-1] under the (-1)!!=1 convention',$q$
    SELECT string_agg((unrank(double_factorial_numbers(), n)).value::text, ',' ORDER BY n) FROM generate_series(0,5) n $q$),
  ('references','FactorialPower: arrangements(5,k) fiber_count = falling factorial P(5,k) for k=0..5','eq','1,5,20,60,120,120','5!/(5-k)!, agrees with cardinality(arrangements(5,k))',$q$
    SELECT string_agg(cardinality(arrangements(5,k))::text, ',' ORDER BY k) FROM generate_series(0,5) k $q$);

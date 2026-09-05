-- requires: references
-- OEIS pointers as base_reference rows (system='oeis') — the UNIFORM cross-reference layer (mathlib4 / sage / oeis all
-- keyed by (subject, system, identity), so the explorer's identity strip lists them side by side and a shared sequence
-- like A000108 can point from many collections at once). This complements base_oeis, which is the deeper CURATED layer:
-- rich formula + blurb annotations for the distinguished sequences, one representative collection each. Harvested from
-- the collection headers + verified (workflow base-reference-enrichment, 2026-08-27); 10 non-collection concepts
-- (Lyndon words, necklaces, ballot sequences, … — derived/example files, not realized collections) were dropped.
INSERT INTO base_reference (subject_kind, subject, system, identity, url, delta) VALUES
  ('collection','abundant_numbers','oeis','A005101','https://oeis.org/A005101',''),
  ('collection','achilles_numbers','oeis','A052486','https://oeis.org/A052486',''),
  ('collection','amicable_numbers','oeis','A063990','https://oeis.org/A063990',''),
  ('collection','alternating_sign_matrices','oeis','A005130','https://oeis.org/A005130',''),
  ('collection','arithmetic_numbers','oeis','A003601','https://oeis.org/A003601',''),
  ('collection','arrangements','oeis','A008279','https://oeis.org/A008279',''),
  ('collection','arrangements','oeis','A000522','https://oeis.org/A000522','row sums Σ_k n!/(n-k)! = |arrangements(n)| over all k'),
  ('collection','automorphic_numbers','oeis','A003226','https://oeis.org/A003226',''),
  ('collection','ascent_sequences','oeis','A022493','https://oeis.org/A022493',''),
  ('collection','bell_numbers','oeis','A000110','https://oeis.org/A000110',''),
  ('collection','binary_trees','oeis','A000108','https://oeis.org/A000108',''),
  ('collection','calkin_wilf_paths','oeis','A002487','https://oeis.org/A002487','fiber n is a contiguous depth-block of the BFS Calkin-Wilf enumeration (fusc-indexed); rank = word binary value'),
  ('collection','cardinal_numbers','oeis','A001477','https://oeis.org/A001477','finite-cardinal enumeration matches exactly; ℵ₀ is an extra non-enumerated limit member not in A001477'),
  ('collection','catalan_numbers','oeis','A000108','https://oeis.org/A000108',''),
  ('collection','centered_hexagonal_numbers','oeis','A003215','https://oeis.org/A003215',''),
  ('collection','centered_square_numbers','oeis','A001844','https://oeis.org/A001844',''),
  ('collection','centered_triangular_numbers','oeis','A005448','https://oeis.org/A005448',''),
  ('collection','central_delannoy_numbers','oeis','A001850','https://oeis.org/A001850',''),
  ('collection','colored_motzkin_paths','oeis','A000108','https://oeis.org/A000108','header names it only as the r=2 special case, not a general pointer'),
  ('collection','compositions_into_k_parts','oeis','A097805','https://oeis.org/A097805','matches for n,k≥1; OEIS extra k=0 boundary column has no counterpart'),
  ('collection','cousin_primes','oeis','A023200','https://oeis.org/A023200',''),
  ('collection','cube_numbers','oeis','A000578','https://oeis.org/A000578',''),
  ('collection','cross_polytope','oeis','A000244','https://oeis.org/A000244','cardinality only (3^n faces), not the element carrier'),
  ('collection','decorated_permutations','oeis','A000522','https://oeis.org/A000522',''),
  ('collection','deficient_numbers','oeis','A005100','https://oeis.org/A005100',''),
  ('collection','delannoy_paths','oeis','A001850','https://oeis.org/A001850',''),
  ('collection','dissections','oeis','A001003','https://oeis.org/A001003',''),
  ('collection','distinct_partitions','oeis','A000009','https://oeis.org/A000009',''),
  ('collection','double_factorial_numbers','oeis','A001147','https://oeis.org/A001147',''),
  ('collection','dyck_paths','oeis','A000108','https://oeis.org/A000108',''),
  ('collection','endofunctions','oeis','A000312','https://oeis.org/A000312',''),
  ('collection','evil_numbers','oeis','A001969','https://oeis.org/A001969',''),
  ('collection','factorial_numbers','oeis','A000142','https://oeis.org/A000142',''),
  ('collection','fibonacci_numbers','oeis','A000045','https://oeis.org/A000045',''),
  ('collection','gray_codes','oeis','A003188','https://oeis.org/A003188','flat sequence; our gray_code_unrank(n,r) renders g(r) as an n-bit word, r<2^n'),
  ('collection','hexagonal_numbers','oeis','A000384','https://oeis.org/A000384',''),
  ('collection','harshad_numbers','oeis','A005349','https://oeis.org/A005349',''),
  ('collection','happy_numbers','oeis','A007770','https://oeis.org/A007770',''),
  ('collection','heptagonal_numbers','oeis','A000566','https://oeis.org/A000566',''),
  ('collection','hyperbinary_representations','oeis','A002487','https://oeis.org/A002487','fiber n has fusc(n+1) numerals — Stern''s diatomic sequence'),
  ('collection','jacobsthal_numbers','oeis','A001045','https://oeis.org/A001045',''),
  ('collection','k_colored_permutations','oeis','A319027','https://oeis.org/A319027',''),
  ('collection','k_motzkin_paths','oeis','A055151','https://oeis.org/A055151',''),
  ('collection','k_almost_primes','oeis','A078840','https://oeis.org/A078840','their k is 1-indexed within Ω=n row; our unrank is 0-indexed'),
  ('collection','k_descent_permutations','oeis','A008292','https://oeis.org/A008292',''),
  ('collection','k_part_partitions','oeis','A008284','https://oeis.org/A008284',''),
  ('collection','k_cycle_permutations','oeis','A132393','https://oeis.org/A132393',''),
  ('collection','kaprekar_numbers','oeis','A006886','https://oeis.org/A006886',''),
  ('collection','labeled_forests','oeis','A000272','https://oeis.org/A000272','shifted: count = (n+1)^(n-1) = A000272(n+1)'),
  ('collection','labeled_trees','oeis','A000272','https://oeis.org/A000272',''),
  ('collection','lucas_numbers','oeis','A000032','https://oeis.org/A000032',''),
  ('collection','multiplicative_partitions','oeis','A001055','https://oeis.org/A001055',''),
  ('collection','motzkin_paths','oeis','A001006','https://oeis.org/A001006','count only'),
  ('collection','motzkin_numbers','oeis','A001006','https://oeis.org/A001006',''),
  ('collection','natural_numbers','oeis','A001477','https://oeis.org/A001477',''),
  ('collection','narayana_numbers','oeis','A001263','https://oeis.org/A001263',''),
  ('collection','narcissistic_numbers','oeis','A005188','https://oeis.org/A005188',''),
  ('collection','non_crossing_partitions','oeis','A000108','https://oeis.org/A000108','cardinality only'),
  ('collection','non_nesting_partitions','oeis','A000108','https://oeis.org/A000108','cardinality only'),
  ('collection','octagonal_numbers','oeis','A000567','https://oeis.org/A000567',''),
  ('collection','odious_numbers','oeis','A000069','https://oeis.org/A000069',''),
  ('collection','ordered_factorizations','oeis','A074206','https://oeis.org/A074206',''),
  ('collection','ordered_trees','oeis','A000108','https://oeis.org/A000108','cardinality only'),
  ('collection','padovan_sequence','oeis','A000931','https://oeis.org/A000931','P(n) = A000931(n+5); offset differs'),
  ('collection','parking_functions','oeis','A000272','https://oeis.org/A000272','our n = A000272 index − 1'),
  ('collection','partition_algebra','oeis','A000110','https://oeis.org/A000110','cardinality = Bell(n), borrowed from set_partitions'),
  ('collection','partition_numbers','oeis','A000041','https://oeis.org/A000041',''),
  ('collection','pell_numbers','oeis','A000129','https://oeis.org/A000129',''),
  ('collection','pentagonal_numbers','oeis','A000326','https://oeis.org/A000326',''),
  ('collection','pentatope_numbers','oeis','A000332','https://oeis.org/A000332','our r = A000332 index − 3'),
  ('collection','perfect_matchings','oeis','A001147','https://oeis.org/A001147',''),
  ('collection','perfect_numbers','oeis','A000396','https://oeis.org/A000396',''),
  ('collection','perfect_power_numbers','oeis','A001597','https://oeis.org/A001597',''),
  ('collection','permutahedron','oeis','A000670','https://oeis.org/A000670','cardinality only, borrowed from set_compositions'),
  ('collection','permutations','oeis','A000142','https://oeis.org/A000142','cardinality only'),
  ('collection','pernicious_numbers','oeis','A052294','https://oeis.org/A052294',''),
  ('collection','perrin_sequence','oeis','A001608','https://oeis.org/A001608',''),
  ('collection','plane_partitions','oeis','A000219','https://oeis.org/A000219',''),
  ('collection','plane_trees','oeis','A000108','https://oeis.org/A000108','n (node count) = Catalan index + 1'),
  ('collection','powerful_numbers','oeis','A001694','https://oeis.org/A001694',''),
  ('collection','practical_numbers','oeis','A005153','https://oeis.org/A005153',''),
  ('collection','prime_gaps','oeis','A001223','https://oeis.org/A001223','the gap reading g(n) = p_{n+1} − p_n carried on each element'),
  ('collection','prime_gaps','oeis','A000040','https://oeis.org/A000040','the elements themselves are the primes (each addressed by the smaller prime of its pair)'),
  ('collection','prime_numbers','oeis','A000040','https://oeis.org/A000040',''),
  ('collection','prime_power_numbers','oeis','A246655','https://oeis.org/A246655',''),
  ('collection','primorial_numbers','oeis','A002110','https://oeis.org/A002110',''),
  ('collection','pronic_numbers','oeis','A002378','https://oeis.org/A002378',''),
  ('collection','prufer_sequences','oeis','A000272','https://oeis.org/A000272',''),
  ('collection','restricted_growth_strings','oeis','A000110','https://oeis.org/A000110',''),
  ('collection','rook_placements','oeis','A002720','https://oeis.org/A002720',''),
  ('collection','rooted_unlabeled_trees','oeis','A000081','https://oeis.org/A000081',''),
  ('collection','safe_primes','oeis','A005385','https://oeis.org/A005385',''),
  ('collection','schroeder_numbers','oeis','A006318','https://oeis.org/A006318',''),
  ('collection','schroeder_paths','oeis','A006318','https://oeis.org/A006318',''),
  ('collection','semiprime_numbers','oeis','A001358','https://oeis.org/A001358',''),
  ('collection','set_compositions','oeis','A000670','https://oeis.org/A000670',''),
  ('collection','set_partitions','oeis','A000110','https://oeis.org/A000110',''),
  ('collection','set_partitions_into_k_blocks','oeis','A008277','https://oeis.org/A008277',''),
  ('collection','sexy_primes','oeis','A023201','https://oeis.org/A023201',''),
  ('collection','signed_permutations','oeis','A000165','https://oeis.org/A000165',''),
  ('collection','signed_subsets','oeis','A000244','https://oeis.org/A000244','cardinality only (3^n); the face structure itself has no OEIS analog'),
  ('collection','smith_numbers','oeis','A006753','https://oeis.org/A006753',''),
  ('collection','sophie_germain_primes','oeis','A005384','https://oeis.org/A005384',''),
  ('collection','sparse_subsets','oeis','A000045','https://oeis.org/A000045','count = F(n+2), shifted'),
  ('collection','sphenic_numbers','oeis','A007304','https://oeis.org/A007304',''),
  ('collection','square_free_numbers','oeis','A005117','https://oeis.org/A005117',''),
  ('collection','square_numbers','oeis','A000290','https://oeis.org/A000290',''),
  ('collection','square_pyramidal_numbers','oeis','A000330','https://oeis.org/A000330',''),
  ('collection','squarefree_semiprimes','oeis','A006881','https://oeis.org/A006881',''),
  ('collection','standard_tableaux','oeis','A000085','https://oeis.org/A000085',''),
  ('collection','star_numbers','oeis','A003154','https://oeis.org/A003154',''),
  ('collection','stern_brocot_paths','oeis','A000079','https://oeis.org/A000079','cardinality only; borrows binary_words carrier'),
  ('collection','stern_diatomic_sequence','oeis','A002487','https://oeis.org/A002487',''),
  ('collection','subexcedant_seqs','oeis','A000142','https://oeis.org/A000142','cardinality only; distinct word-representation'),
  ('collection','subsets','oeis','A000079','https://oeis.org/A000079',''),
  ('collection','surjections','oeis','A000670','https://oeis.org/A000670',''),
  ('collection','surjections','oeis','A019538','https://oeis.org/A019538','per-k fiber count'),
  ('collection','surjections_onto_k','oeis','A019538','https://oeis.org/A019538',''),
  ('collection','triangular_numbers','oeis','A000217','https://oeis.org/A000217',''),
  ('collection','thue_morse_numbers','oeis','A010060','https://oeis.org/A010060',''),
  ('collection','tetrahedral_numbers','oeis','A000292','https://oeis.org/A000292',''),
  ('collection','tribonacci_numbers','oeis','A000073','https://oeis.org/A000073',''),
  ('collection','twin_primes','oeis','A001359','https://oeis.org/A001359','');

-- ── size-sequence enrichment (2026-08-28): collections that carried NO cross-reference, each wired to the OEIS
-- sequence its own realized counts match. Verified by computing cardinality(<coll>(n)) and matching the leading
-- terms (see the count-match example below). The six length-3 pattern classes are Wilf-equivalent ⇒ all Catalan.
INSERT INTO base_reference (subject_kind, subject, system, identity, url, delta) VALUES
  ('collection','permutations_avoiding_123','oeis','A000108','https://oeis.org/A000108',''),
  ('collection','permutations_avoiding_132','oeis','A000108','https://oeis.org/A000108',''),
  ('collection','permutations_avoiding_213','oeis','A000108','https://oeis.org/A000108',''),
  ('collection','permutations_avoiding_231','oeis','A000108','https://oeis.org/A000108',''),
  ('collection','permutations_avoiding_312','oeis','A000108','https://oeis.org/A000108',''),
  ('collection','permutations_avoiding_321','oeis','A000108','https://oeis.org/A000108',''),
  ('collection','non_crossing_matchings','oeis','A000108','https://oeis.org/A000108',''),
  ('collection','non_nesting_matchings','oeis','A000108','https://oeis.org/A000108',''),
  ('collection','alternating_permutations','oeis','A000111','https://oeis.org/A000111',''),   -- Euler up/down (zigzag)
  ('collection','involutions','oeis','A000085','https://oeis.org/A000085',''),
  ('collection','even_permutations','oeis','A001710','https://oeis.org/A001710',''),           -- n!/2 (n≥2)
  ('collection','odd_partitions','oeis','A000009','https://oeis.org/A000009',''),               -- = distinct parts (Euler)
  ('collection','self_conjugate_partitions','oeis','A000700','https://oeis.org/A000700',''),    -- distinct odd parts
  ('collection','connected_permutations','oeis','A003319','https://oeis.org/A003319',''),       -- indecomposable
  ('collection','separable_permutations','oeis','A006318','https://oeis.org/A006318',''),       -- large Schröder
  ('collection','odd_compositions','oeis','A000045','https://oeis.org/A000045',''),             -- parts odd ⇒ Fibonacci
  ('collection','lehmer_codes','oeis','A000142','https://oeis.org/A000142',''),                 -- n!
  ('collection','carlitz_compositions','oeis','A003242','https://oeis.org/A003242','');          -- adjacent parts differ

-- ── second enrichment pass (2026-08-28): more count-verified pointers. The composition-into-special-parts A-numbers
-- (A023359/60/61) and the partition-into-special-parts ones were cross-checked against OEIS by definition + terms.
INSERT INTO base_reference (subject_kind, subject, system, identity, url, delta) VALUES
  ('collection','baxter_permutations','oeis','A001181','https://oeis.org/A001181',''),
  ('collection','non_decreasing_parking_functions','oeis','A000108','https://oeis.org/A000108',''),  -- Catalan
  ('collection','riordan_paths','oeis','A005043','https://oeis.org/A005043',''),                     -- Riordan / Motzkin sums
  ('collection','vexillary_permutations','oeis','A005802','https://oeis.org/A005802',''),            -- 2143-avoiding
  ('collection','lucas_strings','oeis','A000204','https://oeis.org/A000204',''),                     -- Lucas numbers
  ('collection','fib_strings','oeis','A000045','https://oeis.org/A000045','F(n+2): length-n binary strings with no two adjacent 1s'),
  ('collection','syt_two_row','oeis','A001405','https://oeis.org/A001405',''),                       -- central binomial C(n,⌊n/2⌋)
  ('collection','syt_two_column','oeis','A001405','https://oeis.org/A001405',''),                    -- conjugate of ≤2 rows
  ('collection','syt_hook_shape','oeis','A000079','https://oeis.org/A000079','2^(n-1): SYT of a hook with n cells'),
  ('collection','prime_partition','oeis','A000607','https://oeis.org/A000607',''),                   -- partitions into primes
  ('collection','prime_compositions','oeis','A023360','https://oeis.org/A023360',''),                -- compositions into primes
  ('collection','triangular_partitions','oeis','A007294','https://oeis.org/A007294',''),             -- partitions into triangular parts
  ('collection','square_partitions','oeis','A001156','https://oeis.org/A001156',''),                 -- partitions into squares
  ('collection','fibonacci_compositions','oeis','A000045','https://oeis.org/A000045','F(n+1)'),
  ('collection','triangular_composition','oeis','A023361','https://oeis.org/A023361',''),            -- compositions into triangular parts
  ('collection','dyadic_compositions','oeis','A023359','https://oeis.org/A023359',''),               -- compositions into powers of 2
  ('collection','primitive_binary_strings','oeis','A027375','https://oeis.org/A027375',''),          -- aperiodic binary strings
  ('collection','lyndon_words','oeis','A001037','https://oeis.org/A001037','');                       -- binary Lyndon words / necklaces

-- ── third pass (2026-08-28): closed-form / classic-necklace tails. ──────────────────────────────────────────────
INSERT INTO base_reference (subject_kind, subject, system, identity, url, delta) VALUES
  ('collection','grassmannian_permutations','oeis','A000325','https://oeis.org/A000325',''),          -- 2ⁿ−n (≤1 descent)
  ('collection','cograssmannian_permutations','oeis','A000325','https://oeis.org/A000325',''),         -- 2ⁿ−n (≤1 ascent)
  ('collection','binary_bracelets','oeis','A000029','https://oeis.org/A000029',''),                    -- 2-color bracelets
  ('collection','tri_strings','oeis','A000073','https://oeis.org/A000073','A000073(n+3): length-n binary strings avoiding 111 (tribonacci)');

-- ── fourth pass (2026-08-28): pointers taken from each collection's OWN documented count (self-verified by its
-- existing cardinality example). Fibonacci / Lucas / 2^⌊n/2⌋ families over restrictions of words & permutations.
INSERT INTO base_reference (subject_kind, subject, system, identity, url, delta) VALUES
  ('collection','boolean_permutations','oeis','A000045','https://oeis.org/A000045','F(n+1): no non-adjacent inversion (independent sets of a path)'),
  ('collection','step_compositions','oeis','A000045','https://oeis.org/A000045','F(n+1): 1/2-step compositions'),
  ('collection','proper_compositions','oeis','A000045','https://oeis.org/A000045','F(n−1)'),
  ('collection','palindromic_compositions','oeis','A016116','https://oeis.org/A016116',''),                  -- 2^⌊n/2⌋
  ('collection','binary_palindromes','oeis','A016116','https://oeis.org/A016116','A016116(n+1) = 2^⌈n/2⌉'),
  ('collection','independent_sets_cycle','oeis','A000032','https://oeis.org/A000032','Lucas Lₙ — independent sets of the cycle Cₙ');

-- ── fifth pass (2026-08-28): the collection headers cite the A-number directly (author-verified). ────────────────
INSERT INTO base_reference (subject_kind, subject, system, identity, url, delta) VALUES
  ('collection','simple_permutations','oeis','A111111','https://oeis.org/A111111',''),                       -- 1,1,2,0,2,6,46,338 (note the 0 at n=3)
  ('collection','tri_compositions','oeis','A000073','https://oeis.org/A000073','tribonacci (A000073 shifted): compositions into {1,2,3}'),
  ('collection','tetra_compositions','oeis','A000078','https://oeis.org/A000078','tetranacci: compositions into {1,2,3,4}'),
  ('collection','weak3_compositions','oeis','A000217','https://oeis.org/A000217','fiber n has C(n+2,2) elements — the triangular numbers (A000217 shifted)');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('references','every OEIS pointer resolves to a real collection (integrity, no FK)','eq','0','no dangling subject in the oeis layer — scoped to subject_kind=''collection''; a non-collection subject_kind (e.g. ''function'', base_function.sql) resolves against its own registry instead',$q$
    SELECT count(*)::text FROM base_reference r WHERE r.system='oeis' AND r.subject_kind='collection'
      AND NOT EXISTS (SELECT 1 FROM base_collection c WHERE c.id = r.subject) $q$),
  ('references','a shared sequence points from many collections: A000108 (Catalan) covers at least 17 (a floor — more may be added)','eq','true','one identity, many roles — the reason oeis lives in base_reference not base_oeis',$q$
    SELECT (count(*) >= 17)::text FROM base_reference WHERE system='oeis' AND identity='A000108' $q$),
  ('references','the GF families resolve to their OEIS sequence','eq','true|true|true|true','the generating-function identity in its OEIS role (pinned per subject — a subject may pick up other oeis pointers)',$q$
    SELECT (EXISTS (SELECT 1 FROM base_reference WHERE system='oeis' AND subject='catalan_numbers'   AND identity='A000108'))::text || '|' ||
           (EXISTS (SELECT 1 FROM base_reference WHERE system='oeis' AND subject='fibonacci_numbers' AND identity='A000045'))::text || '|' ||
           (EXISTS (SELECT 1 FROM base_reference WHERE system='oeis' AND subject='motzkin_numbers'   AND identity='A001006'))::text || '|' ||
           (EXISTS (SELECT 1 FROM base_reference WHERE system='oeis' AND subject='schroeder_numbers' AND identity='A006318'))::text $q$),
  ('references','the 2026-08-28 enrichment mappings match their collections'' own counts','eq','1,1,2,4,10,26,76|1,1,2,5,16,61,272|1,1,2,3,5,8,13|1,1,3,4,7,14,23|1,2,6,22,90,394','A000085 / A000111 / A000045 / A003242 / A006318 — the count-match that justifies each pointer',$q$
    SELECT concat_ws('|',
      (SELECT string_agg(cardinality(involutions(n))::text, ',' ORDER BY n) FROM generate_series(0,6) n),
      (SELECT string_agg(cardinality(alternating_permutations(n))::text, ',' ORDER BY n) FROM generate_series(1,7) n),
      (SELECT string_agg(cardinality(odd_compositions(n))::text, ',' ORDER BY n) FROM generate_series(1,7) n),
      (SELECT string_agg(cardinality(carlitz_compositions(n))::text, ',' ORDER BY n) FROM generate_series(1,7) n),
      (SELECT string_agg(cardinality(separable_permutations(n))::text, ',' ORDER BY n) FROM generate_series(1,6) n)) $q$),
  ('references','the second enrichment pass matches its collections'' own counts too','eq','1,2,6,22,92,422|1,0,1,1,3,6,15|1,2,6,23,103,513|1,2,3,6,10,20|1,0,1,1,1,2,2,3,3,4,5|1,2,3,6,10,18,31','A001181 / A005043 / A005802 / A001405 / A000607 / A023359',$q$
    SELECT concat_ws('|',
      (SELECT string_agg(cardinality(baxter_permutations(n))::text, ',' ORDER BY n) FROM generate_series(1,6) n),
      (SELECT string_agg(cardinality(riordan_paths(n))::text, ',' ORDER BY n) FROM generate_series(0,6) n),
      (SELECT string_agg(cardinality(vexillary_permutations(n))::text, ',' ORDER BY n) FROM generate_series(1,6) n),
      (SELECT string_agg(cardinality(syt_two_row(n))::text, ',' ORDER BY n) FROM generate_series(1,6) n),
      (SELECT string_agg(cardinality(prime_partition(n))::text, ',' ORDER BY n) FROM generate_series(0,10) n),
      (SELECT string_agg(cardinality(dyadic_compositions(n))::text, ',' ORDER BY n) FROM generate_series(1,7) n)) $q$),
  ('references','the third pass matches its collections'' own counts','eq','1,2,5,12,27,58|2,3,4,6,8,13,18,30|2,4,7,13,24,44,81,149','A000325 (2ⁿ−n) / A000029 (bracelets) / A000073 (tribonacci)',$q$
    SELECT concat_ws('|',
      (SELECT string_agg(cardinality(grassmannian_permutations(n))::text, ',' ORDER BY n) FROM generate_series(1,6) n),
      (SELECT string_agg(cardinality(binary_bracelets(n))::text, ',' ORDER BY n) FROM generate_series(1,8) n),
      (SELECT string_agg(cardinality(tri_strings(n))::text, ',' ORDER BY n) FROM generate_series(1,8) n)) $q$);

-- little-Schröder pair (added centrally — collection-defining files can't insert base_reference: requires-tag cycle)
INSERT INTO base_reference (subject_kind, subject, system, identity, url, delta) VALUES
  ('collection','little_schroder_numbers','oeis','A001003','https://oeis.org/A001003',''),
  ('collection','little_schroder_triangle','oeis','A114709','https://oeis.org/A114709','');

-- ── sixth pass (2026-09-03, redo of #235): number-theoretic collections that had NO oeis pointer at all. Every
-- A-number below was checked live at oeis.org (not from memory) — its first-terms list compared digit-for-digit
-- against the collection's own realized elements() output before being added; see base_example below for a subset
-- of the spot-checks. abundant_numbers/powerful_numbers/automorphic_numbers/happy_numbers/central_delannoy_numbers
-- already carried correct pointers (A005101/A001694/A003226/A007770/A001850 — reverified here too, unchanged) from
-- an earlier pass.
INSERT INTO base_reference (subject_kind, subject, system, identity, url, delta) VALUES
  ('collection','superabundant_numbers','oeis','A004394','https://oeis.org/A004394',''),
  ('collection','semiperfect_numbers','oeis','A005835','https://oeis.org/A005835',''),
  ('collection','weird_numbers','oeis','A006037','https://oeis.org/A006037',''),
  ('collection','lucky_numbers','oeis','A000959','https://oeis.org/A000959',''),
  ('collection','carmichael_numbers','oeis','A002997','https://oeis.org/A002997',''),
  ('collection','circular_primes','oeis','A068652','https://oeis.org/A068652','every cyclic digit permutation is prime — NOT A016114 (smallest-representative-only variant)'),
  ('collection','emirp_primes','oeis','A006567','https://oeis.org/A006567',''),
  ('collection','fibonacci_primes','oeis','A005478','https://oeis.org/A005478','Fibonacci VALUES that are prime, not their indices (cf. A001605)'),
  ('collection','giuga_numbers','oeis','A007850','https://oeis.org/A007850',''),
  ('collection','highly_composite_numbers','oeis','A002182','https://oeis.org/A002182','distinct from superabundant (A004394) from the 20th term on'),
  ('collection','idoneal_numbers','oeis','A000926','https://oeis.org/A000926',''),
  ('collection','mersenne_primes','oeis','A000668','https://oeis.org/A000668','the prime values 2^p-1 themselves, not the exponents p (cf. A000043)'),
  ('collection','palindromic_primes','oeis','A002385','https://oeis.org/A002385',''),
  ('collection','untouchable_numbers','oeis','A005114','https://oeis.org/A005114','');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('references','the sixth pass (2026-09-03) matches its collections'' own first terms, part 1','eq',
   '12,18,20,24,30|1,2,4,6,12|6,12,18,20,24|70,836,4030,5830,7192|1,3,7,9,13|1,3,13,63,321|561,1105,1729,2465,2821',
   'A005101(abundant, reverified) / A004394(superabundant) / A005835(semiperfect) / A006037(weird) / A000959(lucky) / A001850(central Delannoy) / A002997(Carmichael)',$q$
    SELECT concat_ws('|',
      (SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(abundant_numbers(), 5) e),
      (SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(superabundant_numbers(), 5) e),
      (SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(semiperfect_numbers(), 5) e),
      (SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(weird_numbers(), 5) e),
      (SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(lucky_numbers(), 5) e),
      (SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(central_delannoy_numbers(), 5) e),
      (SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(carmichael_numbers(), 5) e)) $q$),
  ('references','the sixth pass (2026-09-03) matches its collections'' own first terms, part 2','eq',
   '2,3,5,7,11|13,17,31,37,71|2,3,5,13,89|30,858,1722,66198,2214408306|1,2,4,6,12|1,2,3,4,5|3,7,31,127,8191|2,3,5,7,11|2,5,52,88,96',
   'A068652(circular) / A006567(emirp) / A005478(fibonacci prime) / A007850(giuga) / A002182(highly composite) / A000926(idoneal) / A000668(mersenne) / A002385(palindromic prime) / A005114(untouchable)',$q$
    SELECT concat_ws('|',
      (SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(circular_primes(), 5) e),
      (SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(emirp_primes(), 5) e),
      (SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(fibonacci_primes(), 5) e),
      (SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(giuga_numbers(), 5) e),
      (SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(highly_composite_numbers(), 5) e),
      (SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(idoneal_numbers(), 5) e),
      (SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(mersenne_primes(), 5) e),
      (SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(palindromic_primes(), 5) e),
      (SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(untouchable_numbers(), 5) e)) $q$);

-- ── seventh pass (2026-09-03, issue #248 — OEIS wave 2: triangles + graded/combinatorial collections). Every
-- A-number below was checked live at oeis.org (browser navigate + get_page_text — WebFetch 403s there) — its
-- first terms compared digit-for-digit against triangle_cells()/cardinality() computed from this repo's own DB
-- before being added; see base_example below for the spot-checks. Skipped as unconfirmable/not single-sequence:
-- gelfand_tsetlin and k_dyck_paths (genuinely 2-parameter families, no canonical single read-by-rows OEIS id),
-- weak_compositions_into_k_parts (a Pascal reindexing; no distinct OEIS entry found for this exact row form).
INSERT INTO base_reference (subject_kind, subject, system, identity, url, delta) VALUES
  -- triangles (base_triangle registry members that had no pointer)
  ('collection','k_subsets','oeis','A007318','https://oeis.org/A007318',''),                                    -- Pascal's triangle
  ('collection','schroeder_triangle','oeis','A060693','https://oeis.org/A060693',
   'A060693 counts by peaks, our T(n,k) by flat steps — equidistributed statistics, same triangle values'),
  ('collection','k_inversion_permutations','oeis','A008302','https://oeis.org/A008302',''),                     -- Mahonian numbers
  ('collection','bounded_part_partitions','oeis','A026820','https://oeis.org/A026820',''),                      -- Euler's table: greatest part ≤ k
  -- graded/combinatorial collections whose own counting sequence has an OEIS id. NOTE: integer_partitions is
  -- deliberately left WITHOUT a pointer here even though p(n)=A000041 matches — search_sequence.sql's own
  -- example relies on integer_partitions staying catalog-only (no oeis_id) so it can disambiguate the "counting"
  -- hit from the numeric sibling partition_numbers (elements, A000041); don't add one without updating that test.
  ('collection','integer_compositions','oeis','A011782','https://oeis.org/A011782',''),
  ('collection','standard_tableau_pairs','oeis','A000142','https://oeis.org/A000142','RSK: pairs of same-shape SYT of size n sum to n!'),
  ('collection','ternary_gray_codes','oeis','A000244','https://oeis.org/A000244',''),
  ('collection','binary_words','oeis','A000079','https://oeis.org/A000079',''),
  ('collection','boolean_algebra','oeis','A000079','https://oeis.org/A000079',''),
  ('collection','associahedron','oeis','A001003','https://oeis.org/A001003',
   'cardinality only (total face count = little Schröder numbers, not just vertices); borrows the dissection carrier'),
  ('collection','largest_part_partitions','oeis','A008284','https://oeis.org/A008284',''),                      -- A008284's own primary reading (greatest part = k)
  ('collection','binary_words_by_weight','oeis','A007318','https://oeis.org/A007318','');                       -- weight-graded reading of Pascal

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('references','the seventh pass (2026-09-03) triangle rows match their OEIS pointers (one spot-check row each)','eq',
   '1,4,6,4,1|14,35,30,10,1|1,3,5,6,5,3,1|1,4,7,9,10,11',
   'A007318(k_subsets row n=4) / A060693(schroeder_triangle row n=4) / A008302(k_inversion_permutations row n=4) / A026820(bounded_part_partitions row n=6)',$q$
    SELECT concat_ws('|',
      (SELECT string_agg(value::text, ',' ORDER BY col_index) FROM triangle_row('k_subsets', 4)),
      (SELECT string_agg(value::text, ',' ORDER BY col_index) FROM triangle_row('schroeder_triangle', 4)),
      (SELECT string_agg(value::text, ',' ORDER BY col_index) FROM triangle_row('k_inversion_permutations', 4)),
      (SELECT string_agg(value::text, ',' ORDER BY col_index) FROM triangle_row('bounded_part_partitions', 6))) $q$),
  ('references','the seventh pass (2026-09-03) sequence collections match their OEIS pointers','eq',
   '1,1,2,4,8,16|1,1,2,6,24,120|1,3,9,27,81,243|1,2,4,8,16,32|1,2,4,8,16,32|1,1,3,11,45,197',
   'A011782(integer_compositions) / A000142(standard_tableau_pairs) / A000244(ternary_gray_codes) / A000079(binary_words) / A000079(boolean_algebra) / A001003(associahedron), n=0..5',$q$
    SELECT concat_ws('|',
      (SELECT string_agg(cardinality(integer_compositions(n))::text, ',' ORDER BY n) FROM generate_series(0,5) n),
      (SELECT string_agg(cardinality(standard_tableau_pairs(n))::text, ',' ORDER BY n) FROM generate_series(0,5) n),
      (SELECT string_agg(cardinality(ternary_gray_codes(n))::text, ',' ORDER BY n) FROM generate_series(0,5) n),
      (SELECT string_agg(cardinality(binary_words(n))::text, ',' ORDER BY n) FROM generate_series(0,5) n),
      (SELECT string_agg(cardinality(boolean_algebra(n))::text, ',' ORDER BY n) FROM generate_series(0,5) n),
      (SELECT string_agg(cardinality(associahedron(n))::text, ',' ORDER BY n) FROM generate_series(0,5) n)) $q$),
  ('references','the seventh pass (2026-09-03) shared-triangle pointers match their OEIS rows too (one spot-check row each)','eq',
   '1,3,3,2,1,1|1,4,6,4,1',
   'A008284(largest_part_partitions row n=6, dual of k_part_partitions) / A007318(binary_words_by_weight row n=4)',$q$
    SELECT concat_ws('|',
      (SELECT string_agg(cardinality(largest_part_partitions(6,m))::text, ',' ORDER BY m) FROM generate_series(1,6) m),
      (SELECT string_agg(cardinality(binary_words_by_weight(4,k))::text, ',' ORDER BY k) FROM generate_series(0,4) k)) $q$);

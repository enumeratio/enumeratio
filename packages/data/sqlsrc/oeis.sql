-- requires: realizer
-- The OEIS annotation seed — distinguished integer sequences (A-number, KaTeX formula, one-line blurb, slice
-- provenance), each wired to the already-realized collection it annotates (its enumeration or, for combinatorial
-- families, its size sequence). Ported from numbers/data/sequences.yaml. `collection` is NULL for a metadata-only
-- sequence with no realized collection yet (little Schröder, Fubini, Euler/secant). No load-order coupling (no FK).

INSERT INTO base_oeis (a_number, collection, name, formula, blurb, provenance) VALUES
  -- ── counting sequences (count a combinatorial family) ──────────────────────────────────────────────────────────
  ('A000142','factorial_numbers','Factorial',
   'n! = \prod_{i=1}^{n} i',
   'Orderings of n items — the vertices of the permutohedron.', NULL),
  ('A002110','primorial_numbers','Primorial',
   'p_n\# = \prod_{i=1}^{n} p_i',
   'Product of the first n primes — the place values of the primoradic system.', NULL),
  ('A000108','catalan_numbers','Catalan',
   'C_n = \tfrac{1}{n+1}\binom{2n}{n}',
   'Bracketings, triangulations, Dyck paths — the vertices of the associahedron.', NULL),
  ('A000110','bell_numbers','Bell',
   'B_n = \sum_{k=0}^{n} S(n,k)',
   'Ways to partition a set.', 'Stirling₂ triangle row sums'),
  ('A000079','powers_of_two','Powers of two',
   'a_n = 2^n',
   'Subsets of an n-set — the vertices of the n-cube.', 'Pascal triangle row sums'),
  ('A000670','fubini_numbers','Fubini (ordered Bell)',
   'a_n = \sum_{k=0}^{n} k!\,S(n,k)',
   'Ordered set partitions (rankings with ties) — the total face count of the permutohedron.',
   'Stirling₂×k! (surjection) triangle row sums'),
  ('A001003',NULL,'Little Schröder (super-Catalan)',
   '(n+1)a_n = 3(2n-1)a_{n-1} - (n-2)a_{n-2}',
   'Dissections of a convex polygon by non-crossing diagonals — the faces of the associahedron.',
   'Schröder triangle row sums'),
  ('A006318','schroeder_numbers','Large Schröder',
   'S_n = 2\,s_n\ (n \ge 1)',
   'Schröder paths; twice the little Schröder numbers for n ≥ 1, and the Narayana polynomial at t = 2.', NULL),
  ('A000041','partition_numbers','Partition',
   'p(n) = \prod_{k\ge 1} \tfrac{1}{1-x^k}',
   'Ways to write n as a sum of positive parts, order ignored — Euler''s pentagonal recurrence.', NULL),
  ('A001006','motzkin_numbers','Motzkin',
   'M_n = M_{n-1} + \sum_{k=0}^{n-2} M_k\,M_{n-2-k}',
   'Lattice paths with up/down/level steps; non-crossing chord diagrams on n points.', NULL),
  ('A000166','derangements','Derangements (subfactorial)',
   '!n = (n-1)\,(!(n-1) + !(n-2))',
   'Permutations with no fixed points — the subfactorial !n ≈ n!/e.', NULL),
  ('A001147','double_factorial_numbers','Odd double factorial',
   '(2n-1)!! = 1 \cdot 3 \cdot 5 \cdots (2n-1)',
   'Product of the odd numbers up to 2n−1; counts perfect matchings of the complete graph K₂ₙ.', NULL),
  ('A000364',NULL,'Euler (secant) numbers',
   '|E_{2n}| = \sec^{(2n)}(0)',
   'Coefficients of sec(x) — count the alternating (up-down) permutations of even length.', NULL),
  ('A000055','unlabeled_free_trees','Free (unrooted) trees',
   'a(n) = r(n) - \tfrac12\sum_{i=1}^{n-1} r(i)r(n-i) + \tfrac12[n\text{ even}]\,r(n/2)',
   'Trees on n unlabeled nodes up to isomorphism, via Otter''s formula over the rooted-tree count r=A000081.', NULL),
  -- ── figurate / simplex numbers (the columns and diagonals of Pascal's triangle) ───────────────────────────────
  ('A000027','natural_numbers','Natural',
   'a_n = n',
   'The counting numbers — column 1 of Pascal''s triangle (the 1-simplex numbers).', 'Pascal column 1'),
  ('A000217','triangular_numbers','Triangular',
   'T_n = \tfrac{n(n+1)}{2} = \binom{n+1}{2}',
   'Dots in a triangle — column 2 of Pascal''s triangle (the 2-simplex numbers).', 'Pascal column 2'),
  ('A000292','tetrahedral_numbers','Tetrahedral',
   '\tfrac{n(n+1)(n+2)}{6} = \binom{n+2}{3}',
   'Spheres stacked in a tetrahedron — column 3 of Pascal''s triangle (the 3-simplex numbers).', 'Pascal column 3'),
  ('A000332','pentatope_numbers','Pentatope (4-simplex)',
   '\binom{n+3}{4}',
   'The 4-simplex numbers — column 4 of Pascal''s triangle.', 'Pascal column 4'),
  -- ── recurrences ────────────────────────────────────────────────────────────────────────────────────────────────
  ('A000045','fibonacci_numbers','Fibonacci',
   'F_n = F_{n-1} + F_{n-2}',
   'Each term the sum of the previous two — the shallow-diagonal sums of Pascal''s triangle.',
   'Pascal antidiagonal sums'),
  ('A000032','lucas_numbers','Lucas',
   'L_n = L_{n-1} + L_{n-2},\ L_0=2,\ L_1=1',
   'Companion to Fibonacci: L(n) = F(n−1) + F(n+1).', NULL),
  ('A000129','pell_numbers','Pell',
   'P_n = 2P_{n-1} + P_{n-2},\ P_0=0,\ P_1=1',
   'Numerators of the √2 continued-fraction convergents (the silver ratio).', NULL),
  ('A000073','tribonacci_numbers','Tribonacci',
   'T_n = T_{n-1} + T_{n-2} + T_{n-3}',
   'Sum of the previous three terms.', NULL),
  ('A000931','padovan_sequence','Padovan',
   'P_n = P_{n-2} + P_{n-3},\ P_0=P_1=P_2=1',
   'Spiral tilings with equilateral triangles; the ratio converges to the plastic constant ρ ≈ 1.3247.', NULL),
  -- ── automatic / self-similar sequences ─────────────────────────────────────────────────────────────────────────
  ('A010060','thue_morse_numbers','Thue–Morse',
   't(n) = \left(\textstyle\sum \text{bits of }n\right) \bmod 2',
   'Parity of the binary digit-sum (evil 0 / odious 1) — the fixed point of 0↦01, 1↦10.', NULL),
  ('A002487','stern_diatomic_sequence','Stern''s diatomic (fusc)',
   's(2n)=s(n),\ s(2n+1)=s(n)+s(n+1)',
   'fusc: s(n+1) counts the hyperbinary representations of n; consecutive pairs enumerate the positive rationals.', NULL);

-- ── curation pass (2026-08-28): distinguished sequences that were referenced (base_reference, system=oeis) but had
-- no rich formula/blurb entry. Each is wired to a representative realized collection whose counts it tabulates.
INSERT INTO base_oeis (a_number, collection, name, formula, blurb, provenance) VALUES
  -- permutation statistics & pattern classes
  ('A000085','involutions','Involutions',
   'a_n = a_{n-1} + (n-1)\,a_{n-2}',
   'Self-inverse permutations (σ² = id); by RSK, also the number of standard Young tableaux with n cells.', NULL),
  ('A000111','alternating_permutations','Euler zigzag (up/down)',
   '\textstyle\sum a_n \tfrac{x^n}{n!} = \sec x + \tan x',
   'Alternating (zigzag) permutations; the tangent and secant numbers interleaved.', NULL),
  ('A001181','baxter_permutations','Baxter',
   'B_n = \sum_{k=1}^{n} \frac{\binom{n+1}{k-1}\binom{n+1}{k}\binom{n+1}{k+1}}{\binom{n+1}{1}\binom{n+1}{2}}',
   'Baxter permutations; pairs of twin binary trees and plane bipolar orientations.', NULL),
  ('A005802','vexillary_permutations','Vexillary (2143-avoiding)',
   '|\mathrm{Av}_n(2143)|',
   'The 2143-avoiding permutations; their Schubert polynomials are single Schur polynomials.', NULL),
  ('A003319','connected_permutations','Indecomposable permutations',
   '\textstyle\sum a_n x^n = 2 - \left(\sum_{n\ge0} n!\,x^n\right)^{-1}',
   'Permutations with no proper prefix that is itself a permutation of an initial block {1..k}.', NULL),
  ('A000325','grassmannian_permutations','2ⁿ − n',
   'a_n = 2^n - n',
   'Grassmannian permutations of [n] — those with at most one descent.', NULL),
  ('A001405','syt_two_row','Central binomial coefficient',
   '\binom{n}{\lfloor n/2 \rfloor}',
   'The largest entry in row n of Pascal''s triangle; counts standard Young tableaux with at most two rows.', NULL),
  -- partitions into restricted parts
  ('A000009','distinct_partitions','Partitions into distinct parts',
   '\textstyle\prod_{k\ge1}(1 + x^k)',
   'Partitions of n into distinct parts — equal in number to partitions into odd parts (Euler).', 'Euler: distinct = odd'),
  ('A000700','self_conjugate_partitions','Self-conjugate partitions',
   '\textstyle\prod_{k\ge0}(1 + x^{2k+1})',
   'Partitions equal to their conjugate (transpose); equinumerous with partitions into distinct odd parts.', NULL),
  ('A000607','prime_partition','Partitions into prime parts',
   '\textstyle\prod_{p\ \mathrm{prime}} (1 - x^p)^{-1}',
   'Partitions of n whose parts are all prime.', NULL),
  -- compositions & words
  ('A003242','carlitz_compositions','Carlitz compositions',
   'c_i \ne c_{i+1}\ \text{for all } i',
   'Compositions of n with no two adjacent parts equal.', NULL),
  ('A000078','tetra_compositions','Tetranacci',
   'a_n = a_{n-1} + a_{n-2} + a_{n-3} + a_{n-4}',
   'Sum of the previous four terms; also compositions of n into parts of size at most 4.', NULL),
  ('A001037','lyndon_words','Binary Lyndon words',
   'a_n = \tfrac1n \sum_{d \mid n} \mu(d)\, 2^{n/d}',
   'Aperiodic binary necklaces of length n; the number of degree-n irreducible polynomials over GF(2).', NULL),
  ('A027375','primitive_binary_strings','Aperiodic binary strings',
   'a_n = \sum_{d \mid n} \mu(d)\, 2^{n/d}',
   'Binary strings of length n that are not a repetition of a shorter block (= n × Lyndon words).', NULL),
  -- lattice paths & number-theory sets
  ('A005043','riordan_paths','Riordan (Motzkin sum)',
   'a_n = \tfrac{(n-1)\,(2a_{n-1} + 3a_{n-2})}{n+1}',
   'Motzkin paths with no flat steps on the x-axis — the Riordan (Motzkin sum) numbers.', NULL),
  ('A001358','semiprime_numbers','Semiprimes',
   '\Omega(n) = 2',
   'Products of two primes, not necessarily distinct — the 2-almost-primes.', NULL),
  ('A005117','square_free_numbers','Squarefree',
   '\mu(n) \ne 0',
   'Integers divisible by no perfect square greater than 1; every prime exponent is at most 1.', NULL);

-- ── second curation pass (2026-08-28): distinguished triangles, tree/matrix counts, and figurate closed forms. ───
INSERT INTO base_oeis (a_number, collection, name, formula, blurb, provenance) VALUES
  ('A008277','set_partitions_into_k_blocks','Stirling (second kind)',
   'S(n,k) = k\,S(n-1,k) + S(n-1,k-1)',
   'Ways to partition an n-set into k nonempty blocks — the Stirling numbers of the second kind.', 'Stirling₂ triangle'),
  ('A008292','k_descent_permutations','Eulerian',
   'E(n,k) = (k+1)\,E(n-1,k) + (n-k)\,E(n-1,k-1)',
   'Permutations of [n] with k descents — the Eulerian triangle.', 'Eulerian triangle'),
  ('A132393','k_cycle_permutations','Stirling (first kind, unsigned)',
   'c(n,k) = c(n-1,k-1) + (n-1)\,c(n-1,k)',
   'Permutations of [n] with k cycles — the unsigned Stirling numbers of the first kind.', 'Stirling₁ triangle'),
  ('A001263','narayana_numbers','Narayana',
   'N(n,k) = \tfrac1n \binom{n}{k}\binom{n}{k-1}',
   'Dyck paths of semilength n with k peaks — a refinement of the Catalan numbers.', 'Catalan refinement'),
  ('A000272','labeled_trees','Cayley (labeled trees)',
   'a_n = n^{\,n-2}',
   'Labeled trees on n vertices — Cayley''s formula.', NULL),
  ('A005130','alternating_sign_matrices','Alternating sign matrices',
   'A_n = \prod_{k=0}^{n-1}\frac{(3k+1)!}{(n+k)!}',
   'n×n matrices of 0, ±1 whose rows and columns sum to 1 with signs alternating — the ASM theorem.', NULL),
  ('A000312','endofunctions','n to the n',
   'a_n = n^{\,n}',
   'All functions from an n-set to itself (endofunctions).', NULL),
  ('A000522','arrangements','Total arrangements',
   'a_n = \sum_{k=0}^{n} \tfrac{n!}{k!}',
   'Arrangements of any length from an n-set — sequences of distinct elements (partial permutations).', NULL),
  ('A000290','square_numbers','Squares',
   'a_n = n^2',
   'Perfect squares — the areas of integer-sided squares.', NULL),
  ('A000578','cube_numbers','Cubes',
   'a_n = n^3',
   'Perfect cubes — the volumes of integer-sided cubes.', NULL),
  ('A000326','pentagonal_numbers','Pentagonal',
   'P_n = \tfrac{n(3n-1)}{2}',
   'Pentagonal numbers — the exponents in Euler''s pentagonal number theorem for partitions.', NULL);

INSERT INTO base_oeis (a_number, collection, name, formula, blurb, provenance) VALUES
  -- ── #231 number-theoretic objects ────────────────────────────────────────────────────────────────────────────
  ('A005728','farey_sequences','Farey sequence sizes',
   '|F_n| = 1 + \sum_{k=1}^{n} \varphi(k)',
   'Count of reduced fractions in [0,1] with denominator ≤ n.', NULL),
  ('A045917','goldbach_partitions','Goldbach partition counts',
   'r(2n) = \#\{(p,q) : p \le q,\ p,q\ \text{prime},\ p+q=2n\}',
   'Number of ways to write 2n as a sum of two primes — Goldbach''s comet.', NULL);

-- ── found via sage's live oeis() reverse-lookup (leading terms → A-number), confirmed against enumeratio's own
-- values before adding (unlike every row above, sourced by hand) — see resources/references-work close-out. ──
INSERT INTO base_oeis (a_number, collection, name, formula, blurb, provenance) VALUES
  ('A000012','all_ones','All ones',
   'a_n = 1',
   'The constant sequence of 1s — Euler-transforms to the partition numbers, the base case sequence_transforms.sql demonstrates every transform against.', 'Euler transform base case');

-- ── living assertions ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('base_oeis','row count is at least the ported seed + curation passes (>= 52)','eq','true','floor, not exact — grows as curation continues (post-#171)',$q$
    SELECT (count(*) >= 52)::text FROM base_oeis $q$),
  ('base_oeis','at least 50 wired to a collection, exactly 2 metadata-only','eq','true|2','collection link populated vs NULL; wired count is a floor',$q$
    SELECT (count(*) FILTER (WHERE collection IS NOT NULL) >= 50)::text || '|' || count(*) FILTER (WHERE collection IS NULL)::text FROM base_oeis $q$),
  ('base_oeis','every wired collection actually exists','eq','0','no dangling collection link (integrity, no FK)',$q$
    SELECT count(*)::text FROM base_oeis o WHERE o.collection IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM base_collection c WHERE c.id = o.collection) $q$),
  ('base_oeis','spot-check: A-numbers resolve to the right collection','eq',
   'A000045→fibonacci_numbers, A000108→catalan_numbers, A001147→double_factorial_numbers, A006318→schroeder_numbers, A010060→thue_morse_numbers',
   'the wiring the port is about',$q$
    SELECT string_agg(a_number || '→' || collection, ', ' ORDER BY a_number)
    FROM base_oeis WHERE a_number IN ('A000045','A000108','A006318','A010060','A001147') $q$),
  ('base_oeis','the 3 newly-added sequence collections are wired','eq','A001147,A002487,A010060','double factorial / Stern / Thue–Morse',$q$
    SELECT string_agg(a_number, ',' ORDER BY a_number) FROM base_oeis
    WHERE collection IN ('double_factorial_numbers','stern_diatomic_sequence','thue_morse_numbers') $q$);

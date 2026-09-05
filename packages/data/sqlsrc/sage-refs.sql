-- requires: references
-- Second Sage cross-reference pass (system='sage', new file — the original ~90-row sweep lives inline in
-- references.sql; kept separate here to avoid touching that large shared file). Follow-up coverage audit against
-- sage.combinat.combinat's own named counting-function surface (issue-driven, same discipline as
-- wolfram-refs.sql/sympy-refs.sql): every row below was checked by actually RUNNING sage (`sage -c "..."`,
-- sage 10.x, this dev box), cross-checked against enumeratio's OWN cardinality/term functions for the same n —
-- not a name-coincidence. The differential was also re-run through the repo's own harness (a scratch candidate
-- file of base_example rows applied via run.mts, matching the self-cert discipline elsewhere in this repo) before
-- any row below was written.
--
-- Verified matches (sage.combinat.combinat, live):
--   * eulerian_number(n,k) — IDENTICAL to k_descent_permutations' own eulerian_number(n,k): sage gives
--     ⟨4,0..3⟩=1,11,11,1 and ⟨5,0..4⟩=1,26,66,26,1, matching the fiber counts exactly (confirmed against
--     k_descent_permutations.sql's own self-tests, then re-checked live against the pg function itself).
--     aggregate — a bare fiber-count function, same role as fubini_numbers→OrderedSetPartitions(n).
--   * eulerian_polynomial(n) — the SAME identity packaged as one polynomial per n (coefficient list = the whole
--     ⟨n,·⟩ row): eulerian_polynomial(3).list()=[1,4,1], (4)=[1,11,11,1], (5)=[1,26,66,26,1]. This is Sage's own
--     A_n(q), the exact object generating_functions.sql already registers as gf_eulerian_row(n) — a second,
--     independent sage pointer to math already proved in-repo (the QBinomial/QFactorial pattern in wolfram-refs.sql).
--     aggregate — one function call = one whole row, not enumerable elements.
--   * stirling_number1(n,k) — the UNSIGNED Stirling numbers of the first kind, matching k_cycle_permutations'
--     own stirling_first_unsigned(n,k) exactly: c(5,·)=0,24,50,35,10,1 and c(6,·)=0,120,274,225,85,15,1
--     (verified live and against k_cycle_permutations.sql's fiber_count). k_cycle_permutations had NO sage
--     row at all before this pass. aggregate.
--   * stirling_number2(n,k) — the Stirling numbers of the second kind, matching set_partitions_into_k_blocks'
--     stirling_second(n,k) exactly: S(5,·)=0,1,15,25,10,1 and S(6,·)=0,1,31,90,65,15,1. set_partitions_into_k_blocks
--     already carries an ISOMORPHIC element-level row (SetPartitions(n,k), references.sql:127) — this is a second,
--     dual pointer to the bare counting function, same one-identity-many-roles pattern as BellB→bell_numbers AND
--     BellB→set_partitions in wolfram-refs.sql. aggregate.
--   * fibonacci(n) — exact, UNSHIFTED match to fibonacci_numbers: sage fibonacci(0..8) = 0,1,1,2,3,5,8,13,21,
--     identical to fibonacci_numbers' own F(0)=0,F(1)=1,... floor, term for term. fibonacci_numbers had NO sage
--     row before this pass (lucas_numbers already had one: lucas_number2(n,1,-1), references.sql:187).
--     isomorphic — a number-sequence collection where each element IS the function's value, not a count of some
--     larger structured class.
--   * number_of_unordered_tuples(S,k) — the multichoose ((|S| multichoose k)) = C(|S|+k-1,k), matching multisets'
--     own fiber_count exactly: number_of_unordered_tuples([1,2,3],2)=6=cardinality(multisets(3,2));
--     a 5-set choose-3 multichoose = C(7,3)=35=cardinality(multisets(5,3)). multisets had NO sage row at all
--     before this pass. aggregate — counts the class, doesn't enumerate multisets.
--
-- Checked and EXCLUDED (real Sage functions/objects, ruled out after live verification — don't re-add without
-- re-checking):
--   * delannoy_number / DelannoyNumber / schroeder_number / SchroederNumber / motzkin_number / MotzkinNumber — NONE
--     exist anywhere in sage (checked `sage.all` top-level names directly, and swept every sage.combinat submodule
--     name via pkgutil.walk_packages for 'delannoy'/'schroeder'/'motzkin' substrings — zero hits). No row for
--     central_delannoy_numbers, delannoy_paths, schroeder_numbers, little_schroder_numbers, schroeder_paths,
--     schroeder_triangle, little_schroder_triangle, motzkin_numbers, or motzkin_paths. Same conclusion
--     wolfram-refs.sql already reached for Wolfram Language (Motzkin/Delannoy have no core-language builtin there
--     either) — sage has no bare counting function for any of the three either, despite being the more
--     combinatorics-focused system.
--   * tribonacci — no function of that name anywhere in `sage.all` (unlike sympy, which has tribonacci(n) with a
--     documented off-by-one delta per sympy-refs.sql). No row for tribonacci_numbers.
--   * euler_number(n) — live output is 1,0,-1,0,5,0,-61,0,1385 for n=0..8: the classical SIGNED, zero-at-odd-n
--     secant-number convention. alternating_permutations counts the actual (all-positive) Euler zigzag A000111 —
--     1,1,2,5,16,61,... for n=1..6 — a different sequence past sign/parity, the exact mismatch wolfram-refs.sql
--     already found for WL's EulerE. No row.
--   * bell_polynomial — multivariate (Bell/Touchard polynomials in several indeterminates); no single-stat
--     enumeratio collection matches, same reasoning wolfram-refs.sql used to exclude BellY. No row.
--   * bernoulli / bernoulli_polynomial — no combinatorial-collection counterpart in the catalog (matches
--     matlab-refs.sql's identical exclusion of MATLAB's bernoulli(n)). No row.
--   * lah_number(n,k) — the Lah numbers (partitions of [n] into k nonempty LINEARLY ORDERED blocks); no
--     enumeratio collection counts that shape (nothing between set_partitions_into_k_blocks [unordered blocks]
--     and surjections_onto_k [ordered target, unordered-within-block] lines up). No row.
--   * number_of_tuples(S,k) = |S|^k — numerically matches words(size=k, base=|S|), but words already carries an
--     ISOMORPHIC element-level sage row (Words(base,size), references.sql:135); a second bare cardinality-only
--     pointer to the identical object adds no new information (the same call sympy-refs.sql makes for its own
--     already-covered number sequences). No row.
--   * narayana_number — already mapped (references.sql:115, with its 0-vs-1-indexed k delta documented); not
--     revisited here.
INSERT INTO base_reference (subject_kind, subject, system, identity, url, delta, relation) VALUES
  ('collection','k_descent_permutations','sage','sage.combinat.combinat.eulerian_number(n, k)',
    'https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/combinat.html',
    'fiber_count(n,k) = eulerian_number(n,k) exactly, 0-indexed k (0..n-1) same as ours; verified live n=4,5','aggregate'),
  ('collection','k_descent_permutations','sage','sage.combinat.combinat.eulerian_polynomial(n)',
    'https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/combinat.html',
    '.list() gives the whole ⟨n,·⟩ row at once, the same object generating_functions.sql calls gf_eulerian_row(n); verified live n=3,4,5','aggregate'),
  ('collection','k_cycle_permutations','sage','sage.combinat.combinat.stirling_number1(n, k)',
    'https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/combinat.html',
    'UNSIGNED first-kind Stirling numbers, matches fiber_count = stirling_first_unsigned(n,k) exactly; verified live n=5,6 (no prior sage row for this collection)','aggregate'),
  ('collection','set_partitions_into_k_blocks','sage','sage.combinat.combinat.stirling_number2(n, k)',
    'https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/combinat.html',
    'dual pointer alongside the existing isomorphic SetPartitions(n,k) row; matches fiber_count = stirling_second(n,k) exactly; verified live n=5,6','aggregate'),
  ('collection','fibonacci_numbers','sage','sage.combinat.combinat.fibonacci(n)',
    'https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/combinat.html',
    'exact unshifted term-for-term match (F(0)=0,F(1)=1,...); verified live n=0..8 (no prior sage row for this collection)','isomorphic'),
  ('collection','multisets','sage','sage.combinat.combinat.number_of_unordered_tuples(S, k)',
    'https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/combinat.html',
    'the multichoose ((|S| multichoose k)); matches fiber_count exactly; verified live (3,2)=6, (5,3)=35 (no prior sage row for this collection)','aggregate');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('references','every second-pass sage pointer resolves to a real collection (integrity, no FK)','eq','0','no dangling subject in this file''s rows',$q$
    SELECT count(*)::text FROM base_reference r
    WHERE r.system='sage' AND r.identity LIKE 'sage.combinat.combinat.%'
      AND r.identity NOT IN ('sage.combinat.combinat.catalan_number(n)','sage.combinat.combinat.narayana_number(n, k)',
                              'sage.combinat.combinat.lucas_number2(n, 1, -1)','sage.combinat.combinat.polygonal_number(3, n)',
                              'sage.combinat.combinat.polygonal_number(5, n)','sage.combinat.combinat.polygonal_number(6, n)',
                              'sage.combinat.combinat.polygonal_number(7, n)','sage.combinat.combinat.polygonal_number(8, n)',
                              'sage.combinat.combinat.bell_number(n)')
      AND NOT EXISTS (SELECT 1 FROM base_collection c WHERE c.id = r.subject) $q$),
  ('references','this file added exactly 6 new sage rows across 5 subjects','eq','6|5','one row per verified match, k_descent_permutations carries two',$q$
    SELECT count(*)::text || '|' || count(DISTINCT subject)::text FROM base_reference
    WHERE system='sage' AND identity IN (
      'sage.combinat.combinat.eulerian_number(n, k)','sage.combinat.combinat.eulerian_polynomial(n)',
      'sage.combinat.combinat.stirling_number1(n, k)','sage.combinat.combinat.stirling_number2(n, k)',
      'sage.combinat.combinat.fibonacci(n)','sage.combinat.combinat.number_of_unordered_tuples(S, k)') $q$),
  ('references','the second-pass sage rows carry the right relation (5 aggregate, 1 isomorphic)','eq','5|1','fibonacci_numbers is the one genuine isomorphism; the rest are bare counting functions',$q$
    SELECT count(*) FILTER (WHERE relation='aggregate')::text || '|' || count(*) FILTER (WHERE relation='isomorphic')::text
    FROM base_reference WHERE system='sage' AND identity IN (
      'sage.combinat.combinat.eulerian_number(n, k)','sage.combinat.combinat.eulerian_polynomial(n)',
      'sage.combinat.combinat.stirling_number1(n, k)','sage.combinat.combinat.stirling_number2(n, k)',
      'sage.combinat.combinat.fibonacci(n)','sage.combinat.combinat.number_of_unordered_tuples(S, k)') $q$),
  ('references','the new sage pointers agree with each collection''s own function, live (small n)','eq','1,11,11,1|1,26,66,26,1|0,120,274,225,85,15,1|0,1,31,90,65,15,1|0,1,1,2,3,5,8,13,21|6|35',
   'eulerian_number(4,·) / eulerian_number(5,·) / stirling_first_unsigned(6,·) / stirling_second(6,·) / fibonacci_numbers(9) / multisets(3,2) / multisets(5,3) — each cross-checked against sage''s own output for the same n',$q$
    SELECT concat_ws('|',
      (SELECT string_agg(eulerian_number(4,k)::text, ',' ORDER BY k) FROM generate_series(0,3) k),
      (SELECT string_agg(eulerian_number(5,k)::text, ',' ORDER BY k) FROM generate_series(0,4) k),
      (SELECT string_agg(stirling_first_unsigned(6,k)::text, ',' ORDER BY k) FROM generate_series(0,6) k),
      (SELECT string_agg(stirling_second(6,k)::text, ',' ORDER BY k) FROM generate_series(0,6) k),
      (SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(fibonacci_numbers(), 9) e),
      (SELECT cardinality(multisets(3,2))::text),
      (SELECT cardinality(multisets(5,3))::text)) $q$);

-- ── construction-syntax proof of concept (issue: a bare property name like sage.combinat.partition.
-- Partition.conjugate — self_conjugate_partitions' existing row above, references.sql — names the OPERATION but
-- not how to apply it over a collection). This is the first row that instead names the real running construction:
-- Partitions(n).map(lambda p: p.conjugate()) — verified live (`sage -c "list(Partitions(4).map(lambda p:
-- p.conjugate()))"` → [[1,1,1,1],[2,1,1],[2,2],[3,1],[4]], matching integer_partitions' own conjugate map term for
-- term), not a plausible-looking guess. subject_kind='map' (not 'collection') because this points at the MAP
-- itself (integer_partitions.conjugate, findstat Mp00202 — see maps.sql), not at integer_partitions as a whole.
-- A parallel improvement for self_conjugate_partitions' own FILTER (checked live: EnumeratedSets in this sage
-- version — Partitions(6) — have no .filter() method, only .map(); no equally-nice syntax exists there, so that
-- row is intentionally left as-is rather than forced into a shape sage doesn't support). The bigger idea this is
-- a proof-of-concept for — auto-deriving this kind of row from enumeratio's own base_map registrations rather
-- than hand-authoring one at a time — stays on the wiki backlog (#30): this single row is the concrete case that
-- motivated it, not the general mechanism.
INSERT INTO base_reference (subject_kind, subject, system, identity, url, delta, relation) VALUES
  ('map','integer_partitions.conjugate','sage','Partitions(n).map(lambda p: p.conjugate())',
    'https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/partition.html',
    'real running construction, not just the bare Partition.conjugate property; verified live n=4 term-for-term against integer_partitions'' own conjugate map','isomorphic');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('references','the conjugate MAP (not just the collection) now carries real sage construction syntax','eq','Partitions(n).map(lambda p: p.conjugate())|isomorphic','distinguishes the map-level pointer from self_conjugate_partitions'' collection-level one',$q$
    SELECT identity || '|' || relation FROM base_reference WHERE subject_kind='map' AND subject='integer_partitions.conjugate' AND system='sage' $q$);

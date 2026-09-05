-- requires: references
-- SymPy cross-references as base_reference rows (system='sympy') — the LIVE-ORACLE counterpart to wolfram-refs.sql
-- (doc-verified only, no kernel available) and the sage rows in references.sql (doc/oracle verified). SymPy IS
-- installed in this dev environment (a plain pip package, no external binary like sage needs), so every row below
-- was checked by actually RUNNING sympy — not from a plausible-looking name match. See
-- packages/cli/tests/oracle_sympy.py's header for the full survey (what matched, what was excluded and why) and
-- packages/cli/cases-sympy.yaml for the case table; `pnpm --filter @enumeratio/cli test` runs
-- oracle_sympy.test.ts, which re-enumerates every case against sympy.combinatorics / sympy.utilities.iterables and
-- asserts the element SET matches enumeratio's construct(...).serialize() (skips cleanly if python3/sympy aren't
-- on the box — sympy 1.11.1 confirmed here).
--
-- Two disciplines in this one file: most rows are ELEMENT-LEVEL (identity is a generator function, delta notes
-- any index-shift convention) verified by oracle_sympy.test.ts; the two number-sequence rows (motzkin_numbers,
-- tribonacci_numbers) are CARDINALITY-only (identity is a closed-form/recurrence function, not a generator) — sympy
-- has no enumerator for those, so they're checked by literal small-n agreement instead (see the base_example
-- below), same discipline as wolfram-refs.sql's number rows.
--
-- Excluded (see oracle_sympy.py for the full reasoning — don't re-add without re-verifying): ordered_partitions
-- (misleadingly named — it's integer_partitions again, not compositions); signed_subsets (no direct generator);
-- multiset_permutations/multiset_combinations (no size-parameterized collection lines up cleanly); lyndon_words /
-- k_lyndon_words (sympy has no Lyndon-word generator, only necklaces/bracelets); every number sequence already
-- covered by wolfram-refs.sql or references.sql's sage rows (catalan, bell, stirling1/2, partition-count,
-- fibonacci, lucas, subfactorial) — no new information from re-adding them here.
INSERT INTO base_reference (subject_kind, subject, system, identity, url, delta) VALUES
  ('collection','permutations',   'sympy','generate_bell',
    'https://docs.sympy.org/latest/modules/utilities/iterables.html#sympy.utilities.iterables.generate_bell',
    'generate_bell yields the same SET in Steinhaus-Johnson-Trotter (adjacent-transposition) order, not lex order; 0-indexed tuples, shift +1'),
  ('collection','derangements',   'sympy','generate_derangements',
    'https://docs.sympy.org/latest/modules/utilities/iterables.html#sympy.utilities.iterables.generate_derangements',''),
  ('collection','involutions',    'sympy','generate_involutions',
    'https://docs.sympy.org/latest/modules/utilities/iterables.html#sympy.utilities.iterables.generate_involutions',
    '0-indexed tuples, shift +1'),
  ('collection','subsets',        'sympy','subsets',
    'https://docs.sympy.org/latest/modules/utilities/iterables.html#sympy.utilities.iterables.subsets',
    'subsets(seq) with k=None (the default) — all 2^n subsets, shortest to longest'),
  ('collection','k_subsets',      'sympy','subsets',
    'https://docs.sympy.org/latest/modules/utilities/iterables.html#sympy.utilities.iterables.subsets',
    'subsets(seq, k) — the k-subsets'),
  ('collection','integer_partitions','sympy','partitions',
    'https://docs.sympy.org/latest/modules/utilities/iterables.html#sympy.utilities.iterables.partitions',
    'partitions(n) yields {part_size: multiplicity} dicts, not a parts list — expand + sort descending to compare'),
  ('collection','set_partitions', 'sympy','multiset_partitions',
    'https://docs.sympy.org/latest/modules/utilities/iterables.html#sympy.utilities.iterables.multiset_partitions',
    'multiset_partitions(n) partitions the 0-indexed multiset range(n) — shift block elements +1 for our 1-indexed RGS'),
  ('collection','signed_permutations','sympy','signed_permutations',
    'https://docs.sympy.org/latest/modules/utilities/iterables.html#sympy.utilities.iterables.signed_permutations',
    'must be called with a tuple, not a range — signed_permutations(t) does type(t)(i) internally and range(tuple) raises'),
  ('collection','arrangements',   'sympy','variations',
    'https://docs.sympy.org/latest/modules/utilities/iterables.html#sympy.utilities.iterables.variations',
    'variations(seq, k) — the length-k injective words (arrangements'' [n,k] fiber); repetition=False (the default)'),
  ('collection','words',          'sympy','variations',
    'https://docs.sympy.org/latest/modules/utilities/iterables.html#sympy.utilities.iterables.variations',
    'variations(seq, k, repetition=True) — length-k tuples over a len(seq)-letter alphabet = words(size=k, base=len(seq))'),
  ('collection','binary_necklaces','sympy','necklaces',
    'https://docs.sympy.org/latest/modules/utilities/iterables.html#sympy.utilities.iterables.necklaces',
    'necklaces(n, 2), free=False (the default) — same lex-least-under-rotation representative convention as ours'),
  ('collection','k_necklaces',    'sympy','necklaces',
    'https://docs.sympy.org/latest/modules/utilities/iterables.html#sympy.utilities.iterables.necklaces',
    'necklaces(n, base) — 0-indexed colors, shift +1 for our 1-based letters'),
  ('collection','binary_bracelets','sympy','bracelets',
    'https://docs.sympy.org/latest/modules/utilities/iterables.html#sympy.utilities.iterables.bracelets',
    'bracelets(n, 2) (necklaces with free=True) — same lex-least-under-rotation+reflection representative convention as ours'),
  ('collection','k_bracelets',    'sympy','bracelets',
    'https://docs.sympy.org/latest/modules/utilities/iterables.html#sympy.utilities.iterables.bracelets',
    '0-indexed colors, shift +1 for our 1-based letters'),
  -- cardinality-only: sympy has no enumerator for these, only a closed-form/recurrence function (verified by
  -- literal small-n agreement, not element-set enumeration — see the base_example below).
  ('collection','motzkin_numbers','sympy','motzkin.find_first_n_motzkins', NULL,
    'the motzkin(n) FUNCTION itself is off by one term from the standard/OEIS A001006 indexing (confirmed live,
sympy 1.11.1: motzkin(0..10) = 1,1,1,2,4,9,21,51,127,323,835 — an extra leading 1); find_first_n_motzkins(k) gives
the correct first k terms matching ours exactly. No WL builtin either (see wolfram-refs.sql) — this is new information.'),
  ('collection','tribonacci_numbers','sympy','tribonacci',
    'https://docs.sympy.org/latest/modules/functions/combinatorial.html#sympy.functions.combinatorial.numbers.tribonacci',
    'sympy''s T0=0,T1=1,T2=1,T3=2,... (one term ahead of ours); ours repeats the leading 0 (T0=0,T1=0,T2=1,T3=1,...)
so tribonacci_numbers(n) [ours] = sympy tribonacci(n-1) for n>=1');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('references','every sympy pointer resolves to a real collection (integrity, no FK)','eq','0','no dangling subject in the sympy layer',$q$
    SELECT count(*)::text FROM base_reference r WHERE r.system='sympy'
      AND NOT EXISTS (SELECT 1 FROM base_collection c WHERE c.id = r.subject) $q$),
  ('references','the sympy number-sequence pointers agree with each collection''s own cardinality (small n)','eq','1,1,2,4,9,21,51,127,323|0,0,1,1,2,4,7,13,24','motzkin_numbers via find_first_n_motzkins(9); tribonacci_numbers is one term AHEAD of sympy''s own T0=0,T1=1,... (see delta)',$q$
    SELECT concat_ws('|',
      (SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(motzkin_numbers(), 9) e),
      (SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(tribonacci_numbers(), 9) e)) $q$);

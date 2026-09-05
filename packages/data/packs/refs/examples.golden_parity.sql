-- requires: realizer
-- examples.golden_parity — issue #79: a parity audit of the precursor `numbers` repo's worked-examples corpus
-- (numbers/src/examples.ts) against this repo's base_example golden suite. Most of examples.ts's ~110 facts
-- already have an equivalent base_example row somewhere in the per-collection seed files (same fact, checked
-- against the realized surface rather than the old TS library). This file carries only the GAPS: facts that
-- had no equivalent row anywhere in the catalog. Every example below only calls CORE functions (eulerian_number,
-- stern_diatomic_sequence, radix_value, mixed_radix_value, k_subsets, nth_prime) — this pack loading after all of
-- core (#283 phase 2.2) already satisfies the original "after realizer + every collection" intent, so the
-- `requires-tag: collection` this file carried under the monolithic load order is dropped as stale (it no longer
-- has any provider to wait for within this pack's own files — §3.2 scopes the tag to the pack). See the issue
-- close-out for the full parity accounting (covered / ported / un-portable).

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  -- Eulerian numbers: eulerian_number(n,k) exists (k_descent_permutations.sql) but isn't a registered
  -- base_triangle row (only Pascal/Stirling-2/Narayana/… are), so triangle_row() can't reach it — call it
  -- directly. Row sum recovers n! (A(4,k) sums to 4! = 24), the ascent-count analogue of Pascal's row-sum.
  ('golden_parity','Eulerian row n=4 via eulerian_number(4,k) = 1,11,11,1','eq','1,11,11,1',
   'A(4,k) for k=0..3 — row sum 1+11+11+1 = 24 = 4!',$q$
    SELECT string_agg(eulerian_number(4,k)::text, ',' ORDER BY k) FROM generate_series(0,3) k $q$),

  -- hyperbinary representations: the precursor ties hyperBaryCount(n,2,1) to fusc(n+1) (Stern's diatomic
  -- series) as an identity, not a separate hyperbinary collection — this repo never ported a standalone
  -- hyperbinary carrier, but stern_diatomic_sequence realizes fusc directly, so the identity itself survives:
  -- the count of hyperbinary representations of 8 is fusc(9).
  ('golden_parity','hyperbinary representation count of 8 = fusc(9) = 4','eq','4',
   'hyperBaryCount(n,2,1) = fusc(n+1); no standalone hyperbinary carrier here, but the fusc identity holds',$q$
    SELECT (unrank(stern_diatomic_sequence(), 9)).value::text $q$),

  -- Digit-word value: radix_value is the generic "digits → value" inverse of radix_extract (MSB-first, any
  -- radix/unit) — ⟨1 0 1⟩ base 2 is 5, the same fact as examples.ts's wordValue([1,0,1],2).
  ('golden_parity','radix_value([1,0,1], base 2) = 5 — ⟨101⟩₂','eq','5',
   'digits→value inverse of radix_extract, MSB-first: 1·4+0·2+1',$q$
    SELECT radix_value(ARRAY[1,0,1], 2, 1)::text $q$),

  -- Mixed-radix value over non-uniform per-position moduli (MNS): [2,3,2] moduli, digits ⟨1 2 1⟩ (MSB-first)
  -- = 11, same fact as examples.ts's mixedRadixValue([1,2,1],[2,3,2]).
  ('golden_parity','mixed_radix_value([1,2,1], moduli [2,3,2]) = 11','eq','11',
   'MNS place-value: 1·6 + 2·2 + 1 = 11 (moduli read LSB-first: 2,3,2)',$q$
    SELECT mixed_radix_value(ARRAY[1,2,1], ARRAY[2,3,2])::text $q$),

  -- Primoradic (prime-moduli MNS): examples.ts's primoradic round-trip (859) uses fixed radices [2,3,5,7,…];
  -- this repo's mixed_radix_extract/value are the same generic MNS engine, so the prime-moduli instance —
  -- built from nth_prime — round-trips the same way. Not the numbers repo's own digit vector (different
  -- convention), but the identity it's testing (extract∘value = id over a prime-moduli MNS) is the same fact.
  ('golden_parity','primoradic round-trip of 859 over primes 2,3,5,7,11','eq','859',
   'mixed_radix_value(mixed_radix_extract(n, primes), primes) = n — the generic MNS engine on prime moduli',$q$
    SELECT mixed_radix_value(
      mixed_radix_extract(859, ARRAY(SELECT nth_prime(i)::int FROM generate_series(1,5) i)),
      ARRAY(SELECT nth_prime(i)::int FROM generate_series(1,5) i)
    )::text $q$),

  -- Transpositions of [5]: the precursor's `transpositions` family (single 2-cycles) has no standalone
  -- collection here, but |transpositions([n])| = C(n,2) is exactly the unordered-pair count k_subsets already
  -- realizes — same fact via the family it borrows its cardinality from.
  ('golden_parity','transpositions of [5] = C(5,2) = 10, via k_subsets(5,2)','eq','10',
   'a transposition ↔ an unordered pair; no standalone transpositions carrier here, cardinality borrows k_subsets',$q$
    SELECT cardinality(k_subsets(5,2))::text $q$);

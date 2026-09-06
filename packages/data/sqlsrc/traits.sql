-- requires: realizer, catalog-resolution, glyphs, categories, constructions
-- (pattern_avoiding_permutations was a stale requires header — nothing in this file calls it, #283 phase 3 grep;
-- simple_permutations/non_crossing_permutations rows moved to packs/permutations-plus/traits.permutations-plus.sql,
-- ascent_sequences' row moved to packs/words-plus/traits.words-plus.sql — #283 phase 3,
-- base_collection_trait_manual.collection REFERENCES base_collection)
-- requires-tag: collection
-- The trait vocabulary + the derived collection→trait assignment. Traits are real rows (id, description, implies);
-- assignments are computed from the registries and closed transitively over `implies` (has_glyph/has_polytope ⇒
-- visual), the way a Sage object's category memberships follow from its axioms. See https://github.com/enumeratio/enumeratio/wiki/Visual-Representations
-- for the space model these lean on.

INSERT INTO base_trait (id, title, description, implies) VALUES
  ('finite',       'finite',         'Finitely many elements at each size.',                                        '{}'),
  ('graded',       'graded',         'Carries a grading beyond size — elements fiber over one or more further axes.', '{}'),
  ('has_stats',    'has statistics', 'At least one statistic is defined on the carrier.',                            '{}'),
  ('has_maps',     'has maps',       'At least one map sends its elements into another collection.',                 '{}'),
  ('has_glyph',    'page glyph',     'The carrier casts into a page-space glyph (an SVG diagram).',                   '{visual}'),
  ('has_polytope', 'polytope',       'Elements are the faces of a polytope — a scene-space cast.',                    '{visual}'),
  ('visual',       'visual',         'Has at least one visual representation (page or scene space).',                 '{}'),
  ('immutable',    'immutable',      'Fixed for all time — a mathematical object, never edited, only rebuilt.',       '{}'),
  ('repetition_free', 'no repeats',  'Elements are repetition-free multisets — a Nodup multiset (a Finset), not a bag. The refinement that separates subsets/finsets from multisets; asserted, not proven (Lean''s Nodup minus the obligation).', '{}'),
  ('generic',      'generic',        'A parameterized construction with an unfilled type-parameter — a HOLE (e.g. words over an alphabet of size b). Concrete collections fill the holes. Derived from base_collection_construction.', '{}'),
  ('no_closed_form_count', 'no closed-form count', 'Cardinality genuinely has no known simple closed-form formula — only a generating function, an awkward recurrence, or a floor scan. An HONEST absence (issue #172''s audit), not a missing accel someone forgot to add; recorded so selfcert / the explorer can tell the two apart.', '{}'),
  -- enumeration-capability ladder (the capability layers, made queryable). Derived by introspecting which optional
  -- hooks each collection provides: iterator (always) → count → membership → direct unrank. A collection sits at a
  -- capability tier when the corresponding function is present; the sampler and callers read this to tell an O(1)-ish
  -- random access from a scan-only floor. See https://github.com/enumeratio/enumeratio/wiki/Grading (capability layers).
  ('enumerable',   'enumerable',     'Has an iterator floor — its elements can be listed in order. The base capability every realized collection has.',            '{}'),
  ('countable',    'countable',      'Fiber sizes come from a closed-form / DP count without enumerating — a direct cardinality (fiber_count).',                 '{enumerable}'),
  ('decidable',    'decidable',      'Membership is a direct predicate — contains(x) tests an element without scanning the fiber (contains_in_fiber).',           '{enumerable}'),
  ('bounded_membership', 'bounded membership', 'Membership is only SEMI-decided — a non-monotonic sequence, so a scan can never prove absence. contains(x) scans up to a stated ceiling: true/false within it, NULL (unknown) past it. Weaker than decidable; never a false negative.', '{enumerable}'),
  ('indexable',    'indexable',      'Direct unrank — the ord-th element of a fiber without iterating, via a term formula or combinatorial unrank (fiber_unrank).', '{enumerable}'),
  ('samplable',    'samplable',      'A uniform random element is well-defined — finite with a direct count, so random_element gives a uniform draw. The draw is O(1) when the collection is ALSO indexable; otherwise it scans the floor, O(fiber size).', '{countable, finite}'),
  ('steppable',    'steppable',      'Has a cheap forward step — next(el) via an explicit value→value successor (successor) or a direct unrank, no rescan.', '{enumerable}'),
  ('reversible',   'reversible',     'Has a cheap backward step — prev(el) via an explicit predecessor (predecessor) or a direct unrank. A forward-only floor is not reversible.', '{enumerable}');

-- The sorted family — the ordered analogue of `repetition_free`. Each asserts a collection's elements read as a monotone
-- sequence under one fixed order; that alignment is the hook to borrow mathlib's List.Sorted facts. Strictness and
-- direction live in the four leaf traits, all closing up to the `sorted` umbrella over base_trait.implies (mirroring
-- mathlib's StrictMono ⇒ Monotone). Strict monotonicity also entails `repetition_free` — a strictly ordered sequence repeats
-- nothing — so the strict leaves imply it (which newly, and correctly, tags distinct_partitions repetition_free).
INSERT INTO base_trait (id, title, description, implies) VALUES
  ('sorted',              'sorted',              'Elements are a monotone sequence — sorted under one fixed order. The ordered analogue of repetition_free; the hook to align a collection with mathlib''s List.Sorted and borrow its facts. Direction and strictness live in the sub-traits that imply this.', '{}'),
  ('weakly_increasing',   'weakly increasing',   'Entries never decrease left to right (a[i] <= a[i+1]) — sorted ascending, repeats allowed. mathlib Monotone / List.Sorted (·≤·).', '{sorted}'),
  ('weakly_decreasing',   'weakly decreasing',   'Entries never increase left to right (a[i] >= a[i+1]) — partition shape. mathlib Antitone / List.Sorted (·≥·).',                    '{sorted}'),
  ('strictly_increasing', 'strictly increasing', 'Entries strictly increase (a[i] < a[i+1]) — sorted ascending, no repeats, so also repetition_free. mathlib StrictMono / List.Sorted (·<·).', '{weakly_increasing, repetition_free}'),
  ('strictly_decreasing', 'strictly decreasing', 'Entries strictly decrease (a[i] > a[i+1]) — distinct parts, so also repetition_free. mathlib StrictAnti / List.Sorted (·>·).',           '{weakly_decreasing, repetition_free}');

-- EDITORIAL trait assignments — properties NOT derivable from a registry (mirrors base_tag's manual layer). No proofs,
-- just an assertion; aligning a collection with a mathlib type this way is the hook to (later) borrow that type's
-- proven facts. `repetition_free` marks the Finset-like refinements of `multisets`.
CREATE TABLE base_collection_trait_manual (
  trait      text NOT NULL REFERENCES base_trait,
  collection text NOT NULL REFERENCES base_collection,
  PRIMARY KEY (trait, collection)
);
INSERT INTO base_collection_trait_manual (trait, collection) VALUES
  ('repetition_free', 'subsets'), ('repetition_free', 'k_subsets'), ('repetition_free', 'finsets'),
  ('repetition_free', 'boolean_algebra');   -- NOT multisets (repetition allowed); simplex is packs/polytopes' row

-- no_closed_form_count (issue #172's fiber_count accel audit): collections confirmed to have no known simple
-- closed form, each checked against its own file's header comment / OEIS entry rather than asserted from memory —
--   (every no_closed_form_count row is now pack-owned: prime/carlitz/zigzag compositions ->
--    packs/compositions-plus/traits.compositions-plus.sql, ascent_sequences ->
--    packs/words-plus/traits.words-plus.sql, simple/non_crossing/vexillary permutations ->
--    packs/permutations-plus/. Core registers the TRAIT; the packs claim their collections.)

-- The sorted family, assigned from each carrier's canonical order (see the carrier type comments). Verified against
-- sampled element data by the base_example rows below, not asserted from memory.
INSERT INTO base_collection_trait_manual (trait, collection) VALUES
  -- strictly increasing: the finset carrier (members int[]) lists members ascending with no repeats
  ('strictly_increasing', 'subsets'), ('strictly_increasing', 'k_subsets'), ('strictly_increasing', 'finsets'),
  ('strictly_increasing', 'boolean_algebra'),   -- simplex's strictly_increasing row is packs/polytopes'
  -- weakly increasing: a multiset is sorted ascending with repetition
  ('weakly_increasing', 'multisets'),
  -- weakly decreasing: the integer_partition carrier (parts int[]) is a descending part sequence
  ('weakly_decreasing', 'integer_partitions');
-- the rest of this family's rows (bounded_part/box_confined/k_part/largest_part/odd/prime/self_conjugate/
-- square/triangular/distinct partitions, all pack-owned) move to traits.partitions-plus.sql (#283).

-- collection → trait, derived from the registries then closed over base_trait.implies.
CREATE VIEW base_collection_trait AS
WITH RECURSIVE seed(collection, trait) AS (
            SELECT id, 'finite'   FROM base_catalog WHERE NOT unbounded AND alias_of IS NULL
  UNION ALL SELECT id, 'graded'   FROM base_catalog WHERE coalesce(array_length(grades, 1), 0) > 1
  UNION ALL SELECT DISTINCT collection, 'has_stats' FROM base_stat_resolved
  UNION ALL SELECT DISTINCT collection, 'has_maps'  FROM base_map_resolved
  UNION ALL SELECT c.id, 'has_glyph' FROM base_catalog c WHERE carrier_renders_svg(c.carrier)
  UNION ALL SELECT collection, 'has_polytope' FROM base_polytope
  UNION ALL SELECT collection, trait FROM base_collection_trait_manual   -- editorial (repetition_free, …)
  UNION ALL SELECT collection, 'generic' FROM base_collection_construction WHERE generic   -- a construction with an unfilled type-param hole
  -- enumeration capabilities, introspected from the realized function surface (to_regprocedure = "does this hook exist")
  UNION ALL SELECT id, 'enumerable' FROM base_collection WHERE alias_of IS NULL   -- every realized collection has the iterator floor (an alias borrows the canonical's, not its own)
  UNION ALL SELECT id, 'countable'  FROM base_collection WHERE to_regprocedure('fiber_count('  || id || '_fiber)') IS NOT NULL
  UNION ALL SELECT id, 'decidable'  FROM base_collection WHERE to_regprocedure('contains_in_fiber(' || id || '_fiber, ' || carrier || ')') IS NOT NULL
                                          AND id NOT IN (SELECT collection FROM base_bounded_membership)   -- bounded ⇒ only semi-decidable
  UNION ALL SELECT collection, 'bounded_membership' FROM base_bounded_membership
  UNION ALL SELECT id, 'indexable'  FROM base_collection WHERE to_regprocedure('fiber_unrank(' || id || '_fiber, rank_index)') IS NOT NULL
  UNION ALL SELECT id, 'samplable'  FROM base_collection WHERE NOT unbounded AND to_regprocedure('fiber_count(' || id || '_fiber)') IS NOT NULL
  UNION ALL SELECT id, 'steppable'  FROM base_collection WHERE to_regprocedure('successor('   || id || '_fiber, ' || carrier || ')') IS NOT NULL OR to_regprocedure('fiber_unrank(' || id || '_fiber, rank_index)') IS NOT NULL
  UNION ALL SELECT id, 'reversible' FROM base_collection WHERE to_regprocedure('predecessor(' || id || '_fiber, ' || carrier || ')') IS NOT NULL OR to_regprocedure('fiber_unrank(' || id || '_fiber, rank_index)') IS NOT NULL
  -- a category entails its required traits (its axioms) — e.g. `mathematical` requires `immutable`
  UNION ALL SELECT cc.collection, r.trait
            FROM base_collection_category cc JOIN base_category bc ON bc.id = cc.category
                 CROSS JOIN LATERAL unnest(bc.requires) AS r(trait)
),
closure(collection, trait) AS (
  SELECT collection, trait FROM seed
  UNION
  SELECT cl.collection, i.imp
  FROM closure cl JOIN base_trait t ON t.id = cl.trait
       CROSS JOIN LATERAL unnest(t.implies) AS i(imp)
)
SELECT DISTINCT collection, trait FROM closure;

-- monotonicity predicate for the sorted-family checks (mathlib List.Sorted r): is `a` ordered under `rel`, one of
-- '<' '<=' '>' '>='? Empty and singleton arrays are vacuously sorted.
CREATE FUNCTION seq_sorted(a int[], rel text) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(bool_and(CASE rel
           WHEN '<'  THEN a[i] <  a[i+1]
           WHEN '<=' THEN a[i] <= a[i+1]
           WHEN '>'  THEN a[i] >  a[i+1]
           WHEN '>=' THEN a[i] >= a[i+1]
         END), true)
  FROM generate_subscripts(a, 1) i WHERE i < array_length(a, 1)
$$;

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('traits','repetition_free (editorial) marks the Finset-likes, not multisets','eq','k_subsets:t multisets:f subsets:t','the refinement is data, no proof',$q$
    SELECT string_agg(c || ':' || CASE WHEN EXISTS (SELECT 1 FROM base_collection_trait WHERE collection = c AND trait = 'repetition_free')
                                       THEN 't' ELSE 'f' END, ' ' ORDER BY c)
    FROM unnest(ARRAY['subsets','k_subsets','multisets']) c $q$),
  ('traits','generic (derived) marks parameterized constructions with a hole (words), not concrete instances','eq','binary_words:f subsets:f words:t','from base_collection_construction',$q$
    SELECT string_agg(c || ':' || CASE WHEN EXISTS (SELECT 1 FROM base_collection_trait WHERE collection = c AND trait = 'generic')
                                       THEN 't' ELSE 'f' END, ' ' ORDER BY c)
    FROM unnest(ARRAY['subsets','words','binary_words']) c $q$),
  ('traits','has_glyph tracks carrier_renders_svg exactly — no collection can drift from the real glyph_svg overloads','eq','true','the trait is keyed on the derived capability, not the base_glyph hint table',$q$
    SELECT bool_and(EXISTS (SELECT 1 FROM base_collection_trait t WHERE t.collection = c.id AND t.trait = 'has_glyph')
                     = carrier_renders_svg(c.carrier))::text
    FROM base_catalog c $q$);

-- ── the sorted family (editorial) ────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('traits','sorted marks the monotone carriers (finsets/multisets/partitions), not permutations','eq','integer_partitions:t k_subsets:t multisets:t permutations:f','the umbrella trait, closed up from the direction leaves',$q$
    SELECT string_agg(c || ':' || CASE WHEN EXISTS (SELECT 1 FROM base_collection_trait WHERE collection = c AND trait = 'sorted')
                                       THEN 't' ELSE 'f' END, ' ' ORDER BY c)
    FROM unnest(ARRAY['k_subsets','multisets','integer_partitions','permutations']) c $q$),
  ('traits','strictly_increasing (finsets): every subsets(5) element lists members strictly ascending','eq','true','sampled over the whole handle, incl. the empty set + singletons (vacuously sorted)',$q$
    SELECT bool_and(seq_sorted(((e).value).members, '<'))::text FROM fibers(subsets(5)) f, LATERAL elements(f) e $q$),
  ('traits','strictly_increasing (k_subsets): every k_subsets(6,3) element is strictly ascending','eq','true','a bounded fiber sampled in full',$q$
    SELECT bool_and(seq_sorted(((e).value).members, '<'))::text FROM fibers(k_subsets(6,3)) f, LATERAL elements(f) e $q$),
  ('traits','weakly_increasing (multisets): every multisets(3,4) element is sorted ascending with repetition','eq','true','non-strict — repeats allowed, so ≤ not <',$q$
    SELECT bool_and(seq_sorted(((e).value).elements, '<='))::text FROM fibers(multisets(3,4)) f, LATERAL elements(f) e $q$),
  ('traits','weakly_decreasing (integer_partitions): every integer_partitions(9) element has non-increasing parts','eq','true','the partition shape, over a whole fiber',$q$
    SELECT bool_and(seq_sorted(((e).value).parts, '>='))::text FROM fibers(integer_partitions(9)) f, LATERAL elements(f) e $q$),
  ('traits','the predicate discriminates: permutations(4) are NOT all sorted (only the identity is strictly ascending)','eq','false','a real property, not vacuously true — an unsorted collection fails it',$q$
    SELECT bool_and(seq_sorted(((e).value).image, '<'))::text FROM fibers(permutations(4)) f, LATERAL elements(f) e $q$);

-- ── capability ladder + sampler (2026-08-28) ───────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('capabilities','every realized collection is enumerable (the iterator floor is universal)','eq','true','level-0 capability = all REALIZED collections (an alias, #101, borrows the canonical''s floor rather than carrying its own)',$q$
    SELECT ((SELECT count(DISTINCT collection) FROM base_collection_trait WHERE trait = 'enumerable')
          = (SELECT count(*) FROM base_collection WHERE alias_of IS NULL))::text $q$),
  ('capabilities','k_subsets carries the full ladder: count + membership + direct unrank + samplable','eq','countable,decidable,enumerable,indexable,samplable','fiber_count + contains_in_fiber + fiber_unrank + finite',$q$
    SELECT string_agg(trait, ',' ORDER BY trait) FROM base_collection_trait
    WHERE collection = 'k_subsets' AND trait IN ('enumerable','countable','decidable','indexable','samplable') $q$),
  ('capabilities','factorial_numbers is indexable (ord! is O(1)) + decidable, but NOT countable/samplable (unbounded)','eq','countable:f decidable:t indexable:t samplable:f','an infinite sequence with a direct term',$q$
    SELECT string_agg(t || ':' || CASE WHEN EXISTS (SELECT 1 FROM base_collection_trait WHERE collection='factorial_numbers' AND trait=t) THEN 't' ELSE 'f' END, ' ' ORDER BY t)
    FROM unnest(ARRAY['countable','decidable','indexable','samplable']) t $q$),
  ('capabilities','element_at (direct unrank) AGREES with the iterator over a whole fiber','eq','true','the fiber_unrank accel must match fiber_elements',$q$
    SELECT bool_and((element_at(f, r)).value = (unrank(k_subsets(5,2), r)).value)::text
    FROM fibers(k_subsets(5,2)) f, generate_series(0, 9) r $q$),
  ('capabilities','direct terms: element_at square@10 = 100, catalan@6 = 132, factorial@5 = 120','eq','100|132|120','fiber_unrank on the ungraded closed-form sequences',$q$
    SELECT (element_at((SELECT f FROM fibers(square_numbers()) f), 10)).value::text || '|' ||
           (element_at((SELECT f FROM fibers(catalan_numbers()) f), 6)).value::text || '|' ||
           (element_at((SELECT f FROM fibers(factorial_numbers()) f), 5)).value::text $q$),
  ('capabilities','random_element(k_subsets(5,2)) is ALWAYS a valid member (property over many draws)','eq','true','uniform sampling stays in the collection',$q$
    SELECT bool_and((random_element(k_subsets(5,2))).value <@ k_subsets(5,2))::text FROM generate_series(1, 40) $q$),
  ('capabilities','random_element over the whole k_subsets(5) handle is always a member too (fiber-weighted)','eq','true','the handle sampler picks a fiber weighted by size, then within it',$q$
    SELECT bool_and((random_element(k_subsets(5))).value <@ k_subsets(5))::text FROM generate_series(1, 40) $q$),
  ('capabilities','random_element refuses an uncountable fiber (∞ ⇒ NULL, no uniform draw)','eq','true','factorial_numbers is one infinite fiber',$q$
    SELECT (random_element(factorial_numbers()) IS NULL)::text $q$),
  ('capabilities','element_at is bounds-guarded like unrank: ord >= cardinality ⇒ NULL, not garbage','eq','true','out-of-range rank yields NULL, in-range yields an element (ord < 0 is impossible — rank_index is ≥0)',$q$
    SELECT (element_at((SELECT f FROM fibers(k_subsets(5,2)) f), 100) IS NULL
        AND element_at((SELECT f FROM fibers(k_subsets(5,2)) f), 9) IS NOT NULL)::text $q$),
  ('capabilities','the position types: rank (rank_index_range, singleton [r,r]) | ordinality (flat) | omega_ordinality (ω-CNF) | address (fiber coords)','eq','[2,2]|2|ω^2·4 + ω·2 + 2|{4,2}','a located element binds rank to a singleton range; ordinality = lower(rank)',$q$
    SELECT (unrank(k_subsets(4,2), 2)).rank::text || '|' ||
           ordinality(unrank(k_subsets(4,2), 2))::text || '|' ||
           notation(omega_ordinality(unrank(k_subsets(4,2), 2))) || '|' ||
           address((unrank(k_subsets(4,2), 2)).fiber)::text $q$),
  ('capabilities','range(fiber, lo, hi) is a lazy range element; unfold streams it to points (indexable fast path)','eq','[2,5]|4|true','k_subsets(5,2): rank [2,5], 4 points, value = the head at lo',$q$
    SELECT (range((SELECT f FROM fibers(k_subsets(5,2)) f), 2, 5)).rank::text || '|' ||
           (SELECT count(*) FROM unfold(range((SELECT f FROM fibers(k_subsets(5,2)) f), 2, 5)))::text || '|' ||
           ((range((SELECT f FROM fibers(k_subsets(5,2)) f), 2, 5)).value = (element_at((SELECT f FROM fibers(k_subsets(5,2)) f), 2)).value)::text $q$),
  ('capabilities','unfold of a located (point) element = itself','eq','1','a singleton [r,r] range unfolds to one element',$q$
    SELECT (SELECT count(*) FROM unfold(unrank(k_subsets(5,2), 3)))::text $q$),
  ('capabilities','range/unfold on a SCAN collection (no fiber_unrank): involutions(4) [1,3] streams 3','eq','3','the scan path windows the floor to the range',$q$
    SELECT (SELECT count(*) FROM unfold(range((SELECT f FROM fibers(involutions(4)) f), 1, 3)))::text $q$),
  ('capabilities','next/prev via a value→value successor (primes — no unrank): after the 4th prime 7 → 11, before → 5','eq','11|5','the case the successor capability is for',$q$
    SELECT (next(unrank(prime_numbers(), 3))).value::text || '|' || (prev(unrank(prime_numbers(), 3))).value::text $q$),
  ('capabilities','next via a direct unrank (k_subsets, indexable): after rank 3 comes rank 4','eq','true','the element_at step path',$q$
    SELECT (ordinality(next(unrank(k_subsets(5,2), 3))) = 4)::text $q$),
  ('capabilities','prev_in_fiber at rank 0 is NULL (bottom of the fiber floor)','eq','true','the within-fiber step has no predecessor before rank 0',$q$
    SELECT (prev_in_fiber(unrank(k_subsets(5,2), 0)) IS NULL)::text $q$),
  ('capabilities','GLOBAL prev crosses the boundary: before rank 0 of k_subsets(5,2) is the LAST element of the prior fiber (5,1)','eq','5,1|4','next(fiber) odometer supplies the previous fiber; prev takes its top element',$q$
    WITH p AS (SELECT prev(unrank(k_subsets(5,2), 0)) e)
    SELECT ((e).fiber).n || ',' || ((e).fiber).k || '|' || ordinality(e)::text FROM p $q$),
  ('capabilities','GLOBAL next crosses the boundary: after the last element of k_subsets(5,2) is the FIRST of the next fiber (5,3)','eq','5,3|0','at a fiber''s top edge next walks to the next fiber''s rank 0',$q$
    WITH n AS (SELECT next(unrank(k_subsets(5,2), 9)) e)
    SELECT ((e).fiber).n || ',' || ((e).fiber).k || '|' || ordinality(e)::text FROM n $q$),
  ('capabilities','next(fiber)/prev(fiber) — the generic N-axis grade odometer (carry at k=n)','eq','5,3|5,1|6,0','one data-driven next(anyelement)/prev(anyelement) walks any collection over any number of axes; no trait needed',$q$
    SELECT (next(ROW(5,2)::k_subsets_fiber)).n||','||(next(ROW(5,2)::k_subsets_fiber)).k
      ||'|'||(prev(ROW(5,2)::k_subsets_fiber)).n||','||(prev(ROW(5,2)::k_subsets_fiber)).k
      ||'|'||(next(ROW(5,5)::k_subsets_fiber)).n||','||(next(ROW(5,5)::k_subsets_fiber)).k $q$),
  ('capabilities','steppable/reversible: primes (successor) + k_subsets (unrank) yes; involutions (scan-only) no','eq','involutions:f k_subsets:t prime_numbers:t','the forward-step capability',$q$
    SELECT string_agg(c || ':' || CASE WHEN EXISTS (SELECT 1 FROM base_collection_trait WHERE collection=c AND trait='steppable') THEN 't' ELSE 'f' END, ' ' ORDER BY c)
    FROM unnest(ARRAY['prime_numbers','k_subsets','involutions']) c $q$);

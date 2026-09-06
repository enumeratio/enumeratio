-- requires: traits, identities, maps
-- The unified PROPERTY mechanism (#306): one vocabulary + a per-subject-kind applicability allowlist + one
-- implies-closed read surface spanning collections, functions, and maps. See
-- https://github.com/enumeratio/enumeratio/wiki/Property-Vocabulary for the full design.
--
-- The insight: "a map is a bijection", "a function is commutative", "a collection is indexable" are all one shape —
-- subject carries a named property, closed upward over `implies`. base_trait already IS that object (id/title/
-- description/implies), so this file GENERALIZES base_trait from "collection traits" into "the property vocabulary"
-- rather than inventing a new abstraction. Three parallel systems fold in:
--   1. collection traits   — base_collection_trait (already implies-closed) — unchanged, just re-tagged 'collection'.
--   2. function attributes  — base_function_attribute_manual (#305) — projected in, and given the implies-closure it
--                             lacked. The legacy NOUN ids (associativity/…) map to the shared ADJECTIVE ids
--                             (associative/…), matching the house style (finite/enumerable/sorted are adjectives).
--   3. map booleans         — base_map.is_bijection/is_order_iso + the `inverse = map_id` self-inverse signal —
--                             projected in ADDITIVELY: the booleans stay the write surface + source of truth (they
--                             are load-bearing — is_order_iso gates rank transfer), and the property view READS
--                             from them, the way collection capabilities are introspected from pg_proc. Zero writer
--                             changes, zero reader breakage; the columns just gain a second consumer.
-- The eventual physical merge (base_function_attribute → base_trait; the booleans → a compat view over base_property)
-- is a staged codemod, tracked in the wiki — not this file, which is purely additive.

-- ── the shared vocabulary (added to base_trait; all new ids, no collision, no existing row edited) ─────────────
-- Adding rows never perturbs base_collection_trait: a collection is only ever SEEDED with a property by a collection
-- registry, and none of these are ever seeded onto a collection — the applicability allowlist below forbids it.
-- `implies` is the payoff: order_iso ⇒ bijective ⇒ injective ∧ surjective resolves for free, like has_glyph ⇒ visual.
INSERT INTO base_trait (id, title, description, implies) VALUES
  ('injective',     'injective',     'Distinct inputs map to distinct outputs — f(a)=f(b) ⇒ a=b.',                          '{}'),
  ('surjective',    'surjective',    'Every codomain value is hit — the image is all of the codomain.',                     '{}'),
  ('bijective',     'bijective',     'Injective and surjective — invertible. base_map.kind refines the non-bijective cases (embedding/surjection/general).', '{injective, surjective}'),
  ('monotonic',     'monotonic',     'Order-preserving with respect to the subjects'' rank orders — a ≤ b ⇒ f(a) ≤ f(b).', '{}'),
  ('antimonotonic', 'antimonotonic', 'Order-reversing — a ≤ b ⇒ f(a) ≥ f(b).',                                             '{}'),
  ('order_iso',     'order isomorphism', 'A bijection whose image reproduces the codomain''s rank order (the k-th domain element maps to the k-th codomain element). The property that gates whether rank_id transfers (#94); strictly stronger than bijective.', '{bijective, monotonic}'),
  ('involutive',    'involutive',    'Self-inverse — f∘f = id (reverse, conjugate, inverse). Necessarily a bijection.',    '{bijective}'),
  ('idempotent',    'idempotent',    'f∘f = f (unary) or x∘x = x (binary/semilattice). Distinct from involutive and from one_identity — gcd(a,a)=a.', '{}'),
  ('associative',   'associative',   'f(f(a,b),c) = f(a,f(b,c)) for an n-ary endo-operation — Wolfram Language Flat.',      '{}'),
  ('commutative',   'commutative',   'Argument order is immaterial — Wolfram Language Orderless.',                          '{}'),
  ('distributive',  'distributive',  'a·(b+c) = a·b + a·c — one operation distributes over another.',                       '{}'),
  ('absorptive',    'absorptive',    'The lattice absorption law: a ∨ (a ∧ b) = a and a ∧ (a ∨ b) = a.',                    '{}'),
  ('threadable',    'threadable',    'Threads elementwise over list/array arguments — Wolfram Language Listable.',          '{}'),
  ('one_identity',  'one-identity',  'The single-argument application of a variadic head collapses to its argument, f(x) ≡ x (WL OneIdentity). A rewrite/normalization rule, NOT idempotency — the two are orthogonal.', '{}'),
  ('volatile',      'volatile',      'Impure — the value depends on more than its arguments (pg provolatile = ''v''). No curated identity is volatile yet (random_element is a realizer function, not an identity ledger row) — vocabulary.', '{}');

-- ── the applicability allowlist ──────────────────────────────────────────────────────────────────────────────
-- Which properties are LEGAL on which subject kind — a shared vocabulary needs to say "a collection is never
-- commutative". subject_kind's vocabulary matches base_reference.subject_kind. The FK is single (base_trait), so
-- there is genuinely one vocabulary. This is the enforcement point: the base_property view below is CERTIFIED (by an
-- example) to emit only allowlisted (subject_kind, property) pairs — a cross-table applicability rule is not a
-- single-row CHECK Postgres can enforce, so it is certified, not constrained (mirrors the arity-2 attribute
-- guideline check in function_impls.sql). No `pack` column — base_trait / base_collection_trait_manual predate the
-- pack split and opt out of it; this table is part of that subsystem (pack-specific applicability is a later concern).
CREATE TABLE base_property_kind (
  property     text NOT NULL REFERENCES base_trait,
  subject_kind text NOT NULL CHECK (subject_kind IN ('collection','function','map','structure')),
  PRIMARY KEY (property, subject_kind)
);

-- collection-only: the capability ladder + the structural editorial traits. Nothing else's business.
INSERT INTO base_property_kind (property, subject_kind)
  SELECT trait, 'collection' FROM unnest(ARRAY[
    'finite','graded','has_stats','has_maps','has_glyph','has_polytope','visual','immutable','repetition_free',
    'generic','no_closed_form_count','enumerable','countable','decidable','bounded_membership','indexable',
    'samplable','steppable','reversible','sorted','weakly_increasing','weakly_decreasing','strictly_increasing',
    'strictly_decreasing']) trait;

-- map: shape + order + involution properties.
INSERT INTO base_property_kind (property, subject_kind)
  SELECT prop, 'map' FROM unnest(ARRAY[
    'injective','surjective','bijective','monotonic','antimonotonic','order_iso','involutive','idempotent']) prop;

-- function: the #305 algebra attributes (as adjectives) + the shape/rewrite/purity words.
INSERT INTO base_property_kind (property, subject_kind)
  SELECT prop, 'function' FROM unnest(ARRAY[
    'associative','commutative','distributive','idempotent','involutive','injective','surjective','bijective',
    'threadable','one_identity','volatile']) prop;

-- structure: algebraic-structure laws (base_structure axioms — reserved vocabulary, no assignments wired yet).
INSERT INTO base_property_kind (property, subject_kind)
  SELECT prop, 'structure' FROM unnest(ARRAY[
    'associative','commutative','distributive','absorptive','idempotent']) prop;

-- ── the unified read surface — (subject_kind, subject, property), implies-closed across all three kinds ────────
-- subject follows the base_reference convention: a collection is its id; a map is <collection>.<map_id>; a function
-- is its id. The three arms derive differently on purpose (collections introspect pg_proc, functions are editorial,
-- maps read the booleans), so they are unioned as SEEDS, then one closure walks base_trait.implies over all of them.
-- base_collection_trait is already closed, so re-closing it is idempotent (DISTINCT drops the dups).
CREATE VIEW base_property AS
WITH RECURSIVE seed(subject_kind, subject, property) AS (
    -- 1. collections (already implies-closed upstream)
            SELECT 'collection', collection, trait FROM base_collection_trait
    -- 2. functions — legacy noun-id (#305) → shared adjective id
  UNION ALL SELECT 'function', m.function, CASE m.attribute
                     WHEN 'associativity' THEN 'associative'
                     WHEN 'commutativity' THEN 'commutative'
                     WHEN 'idempotency'   THEN 'idempotent'
                     WHEN 'threadability' THEN 'threadable'
                     ELSE m.attribute            -- one_identity keeps its id
                   END
            FROM base_function_attribute_manual m
    -- 3. maps — projected from the load-bearing booleans + the self-inverse signal (additive; booleans stay source of truth)
  UNION ALL SELECT 'map', collection || '.' || map_id, 'bijective'  FROM base_map WHERE is_bijection
  UNION ALL SELECT 'map', collection || '.' || map_id, 'order_iso'  FROM base_map WHERE is_order_iso
  UNION ALL SELECT 'map', collection || '.' || map_id, 'involutive' FROM base_map WHERE inverse = map_id
),
closure(subject_kind, subject, property) AS (
  SELECT subject_kind, subject, property FROM seed
  UNION
  SELECT c.subject_kind, c.subject, i.imp
  FROM closure c JOIN base_trait t ON t.id = c.property
       CROSS JOIN LATERAL unnest(t.implies) AS i(imp)
)
SELECT DISTINCT subject_kind, subject, property FROM closure;

-- ── examples ─────────────────────────────────────────────────────────────────────────────────────────────────
-- Core-only: every subject referenced below is a CORE collection/function/map (integer_partitions/permutations/gcd),
-- so these hold under the core self-containment probe (run.mts --packs core) as well as the full run.
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('properties','the allowlist is the enforcement point: base_property NEVER emits an (subject_kind, property) pair the allowlist forbids','eq','true','a collection can never be commutative — certified, since a cross-table applicability rule is not a single-row CHECK',$q$
    SELECT (NOT EXISTS (
      SELECT 1 FROM base_property p
      LEFT JOIN base_property_kind k ON k.property = p.property AND k.subject_kind = p.subject_kind
      WHERE k.property IS NULL))::text $q$),
  ('properties','the vocabulary is one table: every allowlisted property is a real base_trait row (single FK, one vocabulary)','eq','true','base_property_kind.property REFERENCES base_trait — so there is genuinely one vocabulary, not three',$q$
    SELECT (NOT EXISTS (SELECT 1 FROM base_property_kind k LEFT JOIN base_trait t ON t.id = k.property WHERE t.id IS NULL))::text $q$),
  ('properties','the allowlist forbids a collection being commutative (the headline invariant)','eq','true','shared words, per-kind legal subset',$q$
    SELECT (NOT EXISTS (SELECT 1 FROM base_property_kind WHERE property = 'commutative' AND subject_kind = 'collection'))::text $q$),
  ('properties','functions fold in (#305): gcd carries associative + commutative + idempotent, as adjectives via base_property','eq','associative,commutative,idempotent','base_function_attribute_manual projected + noun→adjective mapped',$q$
    SELECT string_agg(property, ',' ORDER BY property) FROM base_property WHERE subject_kind = 'function' AND subject = 'gcd' $q$),
  ('properties','maps fold in with implies-closure: a bijection entails injective ∧ surjective (integer_partitions.conjugate)','eq','bijective,injective,involutive,surjective','projected from is_bijection + inverse=map_id, then closed over base_trait.implies',$q$
    SELECT string_agg(property, ',' ORDER BY property) FROM base_property WHERE subject_kind = 'map' AND subject = 'integer_partitions.conjugate' $q$),
  ('properties','involutions become DATA, not prose: conjugate/reverse/inverse are derived involutive (self-inverse ⇒ inverse = map_id) — a FLOOR, packs may add more','eq','true','the issue''s explicit ask — the prose involutions absorbed; containment not exact count (a pack involution would extend the set)',$q$
    SELECT (array_agg(subject ORDER BY subject) @> ARRAY['integer_partitions.conjugate','permutations.inverse','permutations.reverse'])::text
    FROM base_property WHERE subject_kind = 'map' AND property = 'involutive' $q$),
  ('properties','the vocabulary closure is real: order_iso ⇒ bijective ⇒ injective ∧ surjective (the rank-transfer gate entails all four)','eq','bijective,injective,monotonic,surjective','pure-vocabulary implies walk over base_trait, no assignment needed',$q$
    WITH RECURSIVE cl(p) AS (
      SELECT 'order_iso' UNION
      SELECT i.imp FROM cl JOIN base_trait t ON t.id = cl.p CROSS JOIN LATERAL unnest(t.implies) i(imp))
    SELECT string_agg(p, ',' ORDER BY p) FROM cl WHERE p <> 'order_iso' $q$);

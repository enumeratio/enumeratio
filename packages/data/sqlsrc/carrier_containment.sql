-- requires: realizer, meta-collections, constructions
-- requires-tag: collection
-- CARRIER CONTAINMENT — a Sage-style inclusion partial order over the catalog's carrier TYPES (the `carriers`
-- meta-collection: permutation, finset, word, numeric, …). Composite-record carriers have no meaningful native
-- order (pg's `<` on a composite falls back to row-literal text, which says nothing about structural inclusion),
-- so `a ⊇ b` ("carrier a contains carrier b") is defined here as DATA and closed transitively.
--
-- Every edge is GROUNDED in structure the catalog already records — we assert containment only where it is
-- justified, and leave the rest to the editorial layer or defer it (see REPORT at the foot of this file):
--   • reflexive        — every carrier contains itself.
--   • pg domain base   — a DOMAIN carrier's values ARE values of its base type (pg_type.typbasetype), so the base
--                        carrier contains the domain carrier: numeric ⊇ integer_number, numeric ⊇ cardinal.
--   • construction     — base_collection_construction: a construction's concrete instance sits inside its GENERIC
--                        form (same construction, α pinned vs a hole). word (α = Fin b) ⊇ binary_word (α = Fin 2).
--   • editorial        — base_carrier_containment: hand-verified canonical embeddings between DISTINCT carrier
--                        types that the catalog does not link mechanically (the number tower ℤ ↪ ℚ ↪ ℚ(i)).
--
-- NB restriction parentage (base_collection_parent / base_restrict) contributes NOTHING here: a restriction shares
-- its parent's carrier by construction, so its edges live ENTIRELY inside one carrier. That specialization order is
-- a COLLECTION-level relation (base_collection_ancestry) — carrier containment is necessarily the coarser view.

-- ── editorial layer: curated canonical inclusions the recorded structure does not link ─────────────────────────
-- container ⊇ contained. `basis` records the embedding that justifies it. No FK (load-order-free, mirroring
-- base_collection_meta); a guard example below asserts every id names a real carrier. Keep rows to unambiguous,
-- textbook structural embeddings — this is an assertion of fact, not a guess.
CREATE TABLE base_carrier_containment (
  container text NOT NULL,   -- the LARGER carrier (⊇)
  contained text NOT NULL,   -- the SMALLER carrier (⊆)
  basis     text,            -- the canonical embedding that justifies the inclusion
  PRIMARY KEY (container, contained)
);
INSERT INTO base_carrier_containment (container, contained, basis) VALUES
  ('rational_number',  'integer_number',  'ℤ ↪ ℚ,   n ↦ n/1'),
  ('gaussian_integer', 'integer_number',  'ℤ ↪ ℤ[i], n ↦ n + 0i'),
  ('gaussian_rational','rational_number', 'ℚ ↪ ℚ(i), q ↦ q + 0i'),
  ('gaussian_rational','gaussian_integer','ℤ[i] ↪ ℚ(i)');

-- ── the direct containment edges, unioned from every justified source (container ⊇ contained) ──────────────────
CREATE VIEW base_carrier_containment_edge AS
  -- reflexive: every carrier contains itself
  SELECT DISTINCT carrier AS container, carrier AS contained, 'reflexive'::text AS basis FROM base_collection
  UNION
  -- pg domain: base type ⊇ domain (both must be carriers)
  SELECT bt.typname, t.typname, 'domain: ' || t.typname || ' ⊆ ' || bt.typname
    FROM pg_type t JOIN pg_type bt ON bt.oid = t.typbasetype
    WHERE t.typtype = 'd'
      AND t.typname  IN (SELECT carrier FROM base_collection)
      AND bt.typname IN (SELECT carrier FROM base_collection)
  UNION
  -- construction: the generic form's carrier ⊇ a concrete instance's carrier (same construction, distinct carriers)
  SELECT gen.carrier, inst.carrier, 'construction: ' || g.construction
    FROM base_collection_construction g
    JOIN base_collection gen  ON gen.id = g.collection AND g.generic
    JOIN base_collection_construction i ON i.construction = g.construction AND NOT i.generic
    JOIN base_collection inst ON inst.id = i.collection
    WHERE gen.carrier <> inst.carrier
  UNION
  -- editorial curated inclusions
  SELECT container, contained, coalesce(basis, 'editorial') FROM base_carrier_containment;

-- ── the partial order: reflexive-transitive closure of the edges (container ⊇ contained) ───────────────────────
CREATE VIEW base_carrier_order AS
  WITH RECURSIVE closure(container, contained) AS (
    SELECT container, contained FROM base_carrier_containment_edge
    UNION
    SELECT c.container, e.contained
      FROM closure c JOIN base_carrier_containment_edge e ON e.container = c.contained)
  SELECT DISTINCT container, contained FROM closure;

-- carrier_contains(a, b): does carrier a contain carrier b (b ⊆ a)? The queryable order — use this instead of a
-- (meaningless) `<` on two carrier values.
CREATE FUNCTION carrier_contains(a text, b text) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM base_carrier_order WHERE container = a AND contained = b) $$;

-- ── surface the order on the `carriers` meta-collection as explorer columns ────────────────────────────────────
CREATE FUNCTION meta_carrier_contains(v text) RETURNS int LANGUAGE sql STABLE AS $$   -- proper carriers strictly below v
  SELECT count(*)::int FROM base_carrier_order WHERE container = v AND contained <> v $$;
CREATE FUNCTION meta_carrier_within(v text) RETURNS int LANGUAGE sql STABLE AS $$     -- proper carriers strictly above v
  SELECT count(*)::int FROM base_carrier_order WHERE contained = v AND container <> v $$;
INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('carriers', 'contains', 'meta_carrier_contains', 'Contains',  'natural_numbers'),
  ('carriers', 'within',   'meta_carrier_within',   'Within',    'natural_numbers');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('carrier_containment','reflexive: every carrier contains itself','eq','true','a ⊇ a',$q$
    SELECT (carrier_contains('permutation','permutation') AND carrier_contains('numeric','numeric'))::text $q$),
  ('carrier_containment','construction: word ⊇ binary_word (α = Fin b ⊇ Fin 2), not the reverse','eq','true|false','the subset ⊆ finset-style edge, derived from base_collection_construction',$q$
    SELECT carrier_contains('word','binary_word')::text || '|' || carrier_contains('binary_word','word')::text $q$),
  ('carrier_containment','pg domain: numeric ⊇ integer_number and numeric ⊇ cardinal (base type ⊇ its domains)','eq','true|true','derived from pg_type.typbasetype',$q$
    SELECT carrier_contains('numeric','integer_number')::text || '|' || carrier_contains('numeric','cardinal')::text $q$),
  ('carrier_containment','transitivity: gaussian_rational ⊇ integer_number via ℤ↪ℚ↪ℚ(i) and ℤ↪ℤ[i]↪ℚ(i)','eq','true','closure over the editorial number tower',$q$
    SELECT carrier_contains('gaussian_rational','integer_number')::text $q$),
  ('carrier_containment','antisymmetry: no distinct carriers each contain the other','eq','0','the relation is a genuine partial order',$q$
    SELECT count(*)::text FROM base_carrier_order a JOIN base_carrier_order b
      ON a.container = b.contained AND a.contained = b.container WHERE a.container <> a.contained $q$),
  ('carrier_containment','incomparable carriers stay incomparable: permutation vs integer_partition, neither way','eq','false|false','only justified edges are asserted',$q$
    SELECT carrier_contains('permutation','integer_partition')::text || '|' || carrier_contains('integer_partition','permutation')::text $q$),
  ('carrier_containment','restriction parentage adds NO carrier edge: every base_restrict child shares its parent''s carrier','eq','0','why the carrier order is coarser than base_collection_ancestry',$q$
    SELECT count(*)::text FROM base_collection_parent p
      JOIN base_collection ch ON ch.id = p.collection
      JOIN base_collection pa ON pa.id = p.parent
      WHERE ch.carrier <> pa.carrier $q$),
  ('carrier_containment','editorial rows name real carriers (both endpoints)','eq','0','the curated layer stays grounded',$q$
    SELECT count(*)::text FROM base_carrier_containment e
      WHERE e.container NOT IN (SELECT carrier FROM base_collection)
         OR e.contained NOT IN (SELECT carrier FROM base_collection) $q$);

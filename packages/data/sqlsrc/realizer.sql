-- The realizer: turns a collection declared as DATA (carrier + grade chain) + a hand-authored per-fiber FLOOR
-- engine into the generated handle → fiber → element types and the derived surface. Grades form a fixed chain;
-- each declares lo/hi exprs (over earlier grade args g1,g2,…) used when left unbound. A handle binds each grade
-- to a point, a sub-range, or its full [lo,hi] range.
--
-- Every collection OWNS its typed <coll>_fiber (named typed axes, or (unit unit) for an ungraded singleton); see the
-- fiber redesign in https://github.com/enumeratio/enumeratio/wiki/Grading. Only the ordered floor engine is required; count + contains are optional.

-- alias_of: set only on a TRUE ALIAS (#101) — a collection that IS another collection under a second id (a synonym,
-- a deprecated rename left resolvable), not a distinct sibling that merely shares math with it. NULL for every
-- ordinarily-realized collection. See base_alias below, right after base_realize.
CREATE TABLE base_collection (id text PRIMARY KEY, carrier text NOT NULL, unbounded boolean NOT NULL DEFAULT false,
                              alias_of text REFERENCES base_collection,
                              pack text NOT NULL DEFAULT coalesce(current_setting('enumeratio.pack', true), 'core') REFERENCES base_pack);
CREATE TRIGGER base_collection_pack_guard BEFORE UPDATE OR DELETE ON base_collection FOR EACH ROW EXECUTE FUNCTION base_guard_pack();

-- ── finalizers (#283 phase 1.3) — the answer for load-time whole-catalog sweeps ─────────────────────────────
-- Two core files used to sweep EVERY collection at their own load time (documentation.sql's COMMENT loop,
-- base_stat_derived.sql's composition pass). Under packs that breaks silently: a core-time sweep can't see a
-- pack's collections, because the pack's files load LATER. A finalizer is the fix — a registry row naming a
-- function to run AFTER a pack's own files, once the whole pack (not just this file) is on the table.
-- scope 'collection': fn(coll text) runs once per collection owned by the pack (base_collection.pack = $1) — the
--   shape for "comment every collection", "derive every collection's X". scope 'pack': fn(pack text) runs ONCE,
--   for a sweep that isn't shaped per-collection at all (a bounded pass over a small curated registry, e.g.
--   base_stat_derived — filtering that registry BY pack is the fn's own job, not this table's).
CREATE TABLE base_finalizer (id text PRIMARY KEY, fn regproc NOT NULL, description text NOT NULL,
                             scope text NOT NULL DEFAULT 'collection' CHECK (scope IN ('collection', 'pack')));

-- base_pack_finalize(pack): runs every registered finalizer for one pack's collections. Core calls this itself at
-- the tail of its own load (wired at the end of the last core file, sqlsrc/meta-collections.stats.sql — the
-- per-pack loader that will call this after EACH pack's files doesn't exist yet; another agent is building it).
CREATE FUNCTION base_pack_finalize(p_pack text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE f base_finalizer%ROWTYPE; coll text;
BEGIN
  FOR f IN SELECT * FROM base_finalizer ORDER BY id LOOP
    IF f.scope = 'pack' THEN
      EXECUTE format('SELECT %s(%L)', f.fn, p_pack);
    ELSE
      FOR coll IN SELECT id FROM base_collection WHERE base_collection.pack = p_pack LOOP
        EXECUTE format('SELECT %s(%L)', f.fn, coll);
      END LOOP;
    END IF;
  END LOOP;
END $$;

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('finalizer', 'base_pack_finalize on a pack owning no collections is a safe no-op', 'ok', NULL,
   'a "collection"-scope finalizer''s inner loop finds nothing to iterate; a "pack"-scope finalizer still fires '
   'once but must tolerate finding no rows for the pack — neither should raise', $q$ SELECT base_pack_finalize('__nonexistent_pack__') $q$);

-- base_grade: the ordered param positions of a collection. Each position has a ROLE (#67): 'axis' selects a FIBER
-- inside one collection (a grade — recoverable from an element, so it carries a base_stat, may be ranged into a
-- triangle, and unfolds its default [lo,hi] range when unbound), 'param' selects WHICH collection (a family
-- parameter — NOT recoverable from an element, so no stat/triangle, no default range; unbound ⇒ the family skeleton,
-- never a fiber unfold). `admissible` is a text predicate on the bound value ('k >= 2', 'gap % 2 = 0'), param-only.
-- Invariants (suite-asserted in constructions.sql, not triggers): role='param' ⇒ lo_expr IS NULL AND hi_expr IS NULL
-- AND no base_stat over the axis AND no base_triangle; role='axis' with lo/hi NULL stays legal (an open axis).
CREATE TABLE base_grade (collection text NOT NULL REFERENCES base_collection, pos int NOT NULL, name text NOT NULL,
                         lo_expr text, hi_expr text,
                         role text NOT NULL DEFAULT 'axis' CHECK (role IN ('axis', 'param')),
                         admissible text,
                         PRIMARY KEY (collection, pos));
-- base_collection_parent: the SPECIALIZATION edge of the collection family tree — a base_restrict child records the
-- parent it filters + the predicate it filters by (its carrier edge already lives in base_collection.carrier). A child
-- has at most one parent; chains close transitively via base_collection_ancestry. Siblings over a shared carrier (same
-- carrier, no parent edge — e.g. plane_partitions / boxed_plane_partitions) are NOT recorded here; the carrier IS their
-- common ancestor.
-- The three *_fn columns are OPTIONAL accel hooks (issue #89): a restriction normally inherits its count/unrank/sample
-- from the parent (filter-the-floor), but a child whose accelerated form genuinely DIFFERS (e.g. odd_partitions has a
-- closed form q(n)=A000009 the parent partition_number doesn't) attaches its own. Each names a function on the PARENT
-- fiber: count_fn(<parent>_fiber) RETURNS numeric, unrank_fn(<parent>_fiber, rank_index) RETURNS <carrier>. count_fn +
-- unrank_fn are wired (base_restrict synthesizes the child's fiber_count / fiber_unrank, which base_realize then picks
-- up); sample_fn is reserved (recorded, not yet wired).
CREATE TABLE base_collection_parent (collection text PRIMARY KEY REFERENCES base_collection,
                                     parent text NOT NULL REFERENCES base_collection, predicate text NOT NULL,
                                     count_fn text, unrank_fn text, sample_fn text);
-- a collection and ALL its restriction ancestors (parent edges closed transitively). The carrier is the ultimate root
-- of every collection (in base_collection.carrier), so it is not repeated here — this is the specialization chain only.
CREATE VIEW base_collection_ancestry AS
  WITH RECURSIVE up(collection, ancestor, depth) AS (
    SELECT collection, parent, 1 FROM base_collection_parent
    UNION ALL
    SELECT u.collection, cp.parent, u.depth + 1 FROM up u JOIN base_collection_parent cp ON cp.collection = u.ancestor)
  SELECT collection, ancestor, depth FROM up;
-- base_monotonic_sequence: opt-in marker — this collection's floor is a NON-DECREASING sequence, so base_realize can
-- SYNTHESIZE a scanning contains_in_fiber (walk fiber_unrank(0),(1),… until a term meets the value ∈, or passes it ∉).
-- Declared BEFORE base_realize; used only when the collection has no hand-written contains_in_fiber but has fiber_unrank.
CREATE TABLE base_monotonic_sequence (collection text PRIMARY KEY);

-- base_bounded_membership: opt-in marker for a NON-monotonic sequence whose membership is only SEMI-decidable. A scan
-- can never prove absence (a later term may dip back to the value), so base_realize synthesizes a BOUNDED-scan
-- contains_in_fiber: it walks the first `scan_terms` terms and returns true on a hit; on a miss it answers false only
-- for v <= `value_ceiling` (the author asserts every term with value <= value_ceiling occurs within scan_terms, so a
-- miss there is a real absence), and NULL/unknown for v > value_ceiling. Never a false negative. Declared BEFORE
-- base_realize; used only when the collection has no hand-written contains_in_fiber. Backs the `bounded_membership` trait.
CREATE TABLE base_bounded_membership (collection text PRIMARY KEY, value_ceiling numeric NOT NULL, scan_terms int NOT NULL);

-- base_no_membership: collections that DELIBERATELY have no membership predicate — membership is not a meaningful
-- question (an internal descriptor catalog, not a set defined by a predicate over a carrier domain), as opposed to
-- merely lacking an implementation. Documentary + a guard: base_realize never synthesizes contains for these.
CREATE TABLE base_no_membership (collection text PRIMARY KEY, reason text NOT NULL);

-- base_collection_meta: the human-facing name + one-line description per collection, kept OUT of the per-collection
-- files (a single data-driven seed, see collection-meta.sql). No FK on `collection` so the seed loads independent of
-- collection load order; base_catalog surfaces title/description via a LEFT JOIN (id is the fallback name).
CREATE TABLE base_collection_meta (collection text PRIMARY KEY, title text, description text);

-- base_oeis: the OEIS annotation registry — one row per distinguished integer sequence (keyed by its A-number),
-- with a KaTeX `formula`, a one-line `blurb`, and `provenance` when the sequence is a slice (row/column/diagonal)
-- of a number triangle. `collection` links to the already-realized collection it annotates (its enumeration or its
-- size sequence), or NULL for a metadata-only sequence with no collection yet. No FK on `collection` (load order is
-- free, mirroring base_collection_meta); the seed lives in oeis.sql.
CREATE TABLE base_oeis (a_number text PRIMARY KEY, collection text, name text, formula text, blurb text, provenance text);

-- Number domains — the typed, arbitrary-precision kinds of number, each a restriction over numeric (int32 is far
-- too small for combinatorial indices). These are the axis types for graded fibers (default natural_number); a
-- collection may widen an axis where it supports it. Exact-vs-approximate and the fraction/rational family (a
-- (numerator, denominator) pair, restricted per kind) are a broader roadmap — see the number-types design.
CREATE DOMAIN natural_number AS numeric CHECK (VALUE IS NULL OR (VALUE >= 0 AND VALUE = trunc(VALUE)));   -- ℕ, incl 0
CREATE DOMAIN integer_number AS numeric CHECK (VALUE IS NULL OR VALUE = trunc(VALUE));                    -- ℤ
-- Per-axis range types (typed, not int4range/numrange). Uncanonicalized (continuous over numeric): always emit '[]'.
CREATE TYPE natural_range AS RANGE (subtype = natural_number, subtype_opclass = numeric_ops);
CREATE TYPE integer_range AS RANGE (subtype = integer_number, subtype_opclass = numeric_ops);
CREATE DOMAIN unit AS boolean CHECK (VALUE);   -- the singleton (terminal) type: an ungraded collection has exactly one fiber, of type (unit unit)

-- Constrained-integer INDEX domains (the `_index` convention: a bounded, 0-based, ≥0 integer position). Kept minimal
-- and 0-based on purpose — pg array SUBSCRIPTS are 1-based by convention but support arbitrary lower bounds, so where
-- we own an array we build it 0-based and `rank` IS the subscript (no ±1). The SIGNED bases (Laurent places / sparse
-- tensor coords) are deferred until first use — see the number-types roadmap.
--   term_index (int32, ≥0) — a term place / dense-array index (what sequence term funcs like catalan_number(r) take).
--   rank_index (int64, ≥0) — an element's enumeration RANK (what unrank takes; element.rank ranges over it). NULL-able.
CREATE DOMAIN term_index AS int    CHECK (VALUE IS NULL OR VALUE >= 0);
CREATE DOMAIN rank_index AS bigint CHECK (VALUE IS NULL OR VALUE >= 0);
-- rank_index_range — the one range type we need for now: element.rank is a range over it, a singleton [r,r] for a
-- located element and [lo,hi] for a range element (subtype_opclass spelled out, mirroring natural_range).
CREATE TYPE rank_index_range AS RANGE (subtype = rank_index, subtype_opclass = int8_ops);
CREATE FUNCTION rank_point(r rank_index) RETURNS rank_index_range LANGUAGE sql IMMUTABLE AS $$ SELECT rank_index_range(r, r, '[]') $$;   -- the singleton [r,r] a located element binds to
-- (ordinality(el) — the flat position — returns a `natural_number`: a finite ordinal IS a natural number, so there
-- is no separate finite_ordinal_number type. It is always finite, unlike `cardinal` (which carries ∞).
-- omega_ordinality() is the STRUCTURED ω^ω form.)
-- cardinal — a COUNT: a finite cardinal (a non-negative integer), ℵ₀ ('infinity'), or unknown-ahead-of-time (NULL).
-- This is what cardinality() returns; numeric arithmetic already gives the right cardinal sums (ℵ₀ + n = ℵ₀).
CREATE DOMAIN cardinal AS numeric CHECK (VALUE IS NULL OR (VALUE >= 0 AND VALUE = trunc(VALUE)));
-- omega_ordinal — a fiber ADDRESS read as an omega_ordinal < ω^ω: a flat array of natural coefficients [a₁,…,aₘ] denoting
-- Σ aᵢ·ω^(m−i), so the lexicographic order of same-length addresses IS the omega_ordinal order (the global fiber order).
-- fiber_address() returns this; the empty array is 0 (a singleton fiber). ::text stays the raw array; notation() is the CNF display.
CREATE FUNCTION ordinal_valid(v numeric[]) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT v IS NULL OR NOT EXISTS (SELECT 1 FROM unnest(v) x WHERE x IS NULL OR x < 0 OR x <> trunc(x)) $$;
CREATE DOMAIN omega_ordinal AS numeric[] CHECK (ordinal_valid(VALUE));
CREATE FUNCTION notation(o omega_ordinal) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$   -- Cantor normal form, e.g. {4,2} → 'ω·4 + 2'
  DECLARE m int := coalesce(array_length(o, 1), 0); i int; e int; c numeric; parts text[] := '{}';
  BEGIN
    IF o IS NULL THEN RETURN NULL; END IF;
    FOR i IN 1..m LOOP
      c := o[i]; e := m - i;
      CONTINUE WHEN c = 0;
      parts := parts || CASE
        WHEN e = 0 THEN c::text
        WHEN e = 1 THEN CASE WHEN c = 1 THEN 'ω' ELSE 'ω·' || c::text END
        ELSE CASE WHEN c = 1 THEN 'ω^' || e::text ELSE 'ω^' || e::text || '·' || c::text END
      END;
    END LOOP;
    RETURN CASE WHEN array_length(parts, 1) IS NULL THEN '0' ELSE array_to_string(parts, ' + ') END;
  END $$;

-- base_stat: the statistics registry — a per-element → numeric value function per collection (a "stat" in the
-- FindStat sense). value_fn is a <fn>(<carrier>) RETURNS numeric/int the collection file defines; the client
-- projects it as a column via value_fn((element).value). stat_id is the user-facing name (e.g. 'inversions').
CREATE TABLE base_stat (collection text NOT NULL REFERENCES base_collection, stat_id text NOT NULL,
                        value_fn text NOT NULL, title text, codomain text, PRIMARY KEY (collection, stat_id),
                        pack text NOT NULL DEFAULT coalesce(current_setting('enumeratio.pack', true), 'core') REFERENCES base_pack,
                        relabel_invariant boolean NOT NULL DEFAULT false); -- #274 B6: true iff the stat's value is unchanged by relabelling
                                                                            -- the underlying species' atoms (a species-theoretic trait, not
                                                                            -- just a per-collection curiosity — cycles/blocks/fixed-point counts
                                                                            -- survive any permutation of the labels)
CREATE TRIGGER base_stat_pack_guard BEFORE UPDATE OR DELETE ON base_stat FOR EACH ROW EXECUTE FUNCTION base_guard_pack();

-- base_repr: the representations registry — named alternate renderings of a collection's elements (permutation
-- one-line vs cycle notation, set partition RGS vs blocks, Dyck word vs parens). render_fn is a <fn>(<carrier>)
-- RETURNS text; `canonical` marks the one that matches render()/the notation codec. The client's -R flag picks a
-- repr (a flattened repr+format axis).
-- MEDIUM: a repr can carry sibling rows — same (collection, repr), a different `medium` — spelling it for a
-- different line-space target (unicode default; 'latex' for KaTeX, 'ascii' for plain-ASCII media). PRIMARY KEY is
-- (collection, repr, medium), so the unicode row is untouched by adding a medium sibling: every existing row keeps
-- its implicit medium='unicode' via the column DEFAULT, and every pre-existing render stays byte-identical. Most
-- reprs carry ONLY the unicode row (nothing to translate); register a sibling only where the medium genuinely
-- changes the spelling (representations.sql). `alphabet` optionally names which named alphabet (base_species.sql-
-- style atom naming) the row assumes — a printer-option axis, not yet dispatched (the ALPHABET phase is separate;
-- this column is schema-only for now, populated where a row is written specifically for one alphabet).
-- parse_fn is the OPTIONAL inverse — a <fn>(text) RETURNS <carrier> input grammar for that representation (cycle
-- notation → the permutation, an arithmetic string → the value). It's a property of the REPRESENTATION: a repr with a
-- parser accepts text in its own form and yields the carrier every repr of that element shares, so the reprs are
-- interchangeable inputs. Like render_fn it takes/produces the carrier, so it carrier-inherits (base_repr_resolved).
-- SCOPE mirrors base_map: a `carrier`-scoped repr (default) is a rendering of the carrier and inherits to every
-- collection over it; a `collection`-scoped repr reads structure private to THIS collection (the Stern–Brocot /
-- Calkin–Wilf rational a bit word encodes) and must NOT leak onto its carrier siblings.
-- NOT covered here: the ambient-set ("x ∈ S₄") notation (wire_set_notation below) has its own katex/asciimath
-- symbol spellings (fiber_symbol_katex/_asciimath, representations.sql) that are NOT base_repr rows — their
-- render_fn shape takes the FIBER, not the carrier, so they don't fit this table's render_fn(<carrier>) contract.
-- Folding ambient notation into the medium axis is a further design step, deliberately left open (#138).
CREATE TABLE base_repr (collection text NOT NULL REFERENCES base_collection, repr text NOT NULL,
                        render_fn text NOT NULL, title text, canonical boolean NOT NULL DEFAULT false,
                        parse_fn text,
                        scope text NOT NULL DEFAULT 'carrier' CHECK (scope IN ('carrier','collection')),
                        medium text NOT NULL DEFAULT 'unicode' CHECK (medium IN ('unicode','latex','ascii')),
                        alphabet text,
                        PRIMARY KEY (collection, repr, medium));

-- base_map: the maps registry — a morphism from one collection to another. mapping_fn is a <fn>(<domain_carrier>)
-- RETURNS <codomain_carrier>; the client projects the image in the codomain's own form via
-- render_value(mapping_fn((element).value)). codomain names the target collection (for linking/typing).
-- SCOPE distinguishes two kinds (see https://github.com/enumeratio/enumeratio/wiki/Maps-and-Bijections): a `carrier`-scoped map (default) is a
-- function of the carrier and INHERITS to every collection over that carrier (base_map_resolved); a `collection`-
-- scoped map is bound to THIS domain collection and does NOT carrier-inherit — it is a specific relation between two
-- collections (Euler's distinct↔odd, RSK, …). A collection-scoped bijection carries `inverse` (the paired map_id,
-- the reverse direction), `is_bijection`, and `is_order_iso` — both DECLARED properties, verified by an example on a
-- window where both sides are finite + enumerable (mirrors order_isomorphism-is-only-checkable-sometimes). is_order_iso
-- ⊃ is_bijection: an order isomorphism is a bijection whose image reproduces the codomain's rank order (the k-th
-- element of the domain fiber maps to the k-th element of the codomain fiber), e.g. binary_words_by_weight ↔ k_subsets.
-- kind (#300 D6): the map's SHAPE — 'bijection' (invertible), 'embedding' (injective, not surjective — e.g. Lehmer ↪
-- factoradic), 'surjection', or 'general'. is_bijection stays the derived boolean (kind='bijection' ⇔ is_bijection);
-- kind refines the non-bijective cases the boolean can't name. Defaults 'general' (existing rows keep is_bijection as
-- their source of truth); set kind explicitly for embeddings/surjections.
CREATE TABLE base_map (collection text NOT NULL REFERENCES base_collection, map_id text NOT NULL,
                       mapping_fn text NOT NULL, codomain text NOT NULL, title text, findstat text,
                       scope text NOT NULL DEFAULT 'carrier' CHECK (scope IN ('carrier','collection')),
                       inverse text, is_bijection boolean NOT NULL DEFAULT false, is_order_iso boolean NOT NULL DEFAULT false,
                       kind text NOT NULL DEFAULT 'general' CHECK (kind IN ('bijection','embedding','surjection','general')),
                       PRIMARY KEY (collection, map_id),
                       pack text NOT NULL DEFAULT coalesce(current_setting('enumeratio.pack', true), 'core') REFERENCES base_pack);
CREATE TRIGGER base_map_pack_guard BEFORE UPDATE OR DELETE ON base_map FOR EACH ROW EXECUTE FUNCTION base_guard_pack();

-- base_catalog: the client-facing metadata surface — one row per collection with its carrier, whether it is
-- unbounded (∞), and its grade chain (the ordered grade names). The client reads this to list collections,
-- describe their shape, and build constructors positionally (size = grade 1, then the rest of the chain).
CREATE VIEW base_catalog AS
  SELECT c.id, c.carrier, c.unbounded,
         coalesce((SELECT array_agg(g.name ORDER BY g.pos) FROM base_grade g WHERE g.collection = c.id), '{}') AS grades,
         m.title, m.description, c.alias_of
    FROM base_collection c LEFT JOIN base_collection_meta m ON m.collection = c.id;

-- base_polytope: a collection whose ELEMENTS are the faces of a polytope (set compositions → the permutahedron,
-- signed subsets → the cross-polytope). The vertices are simply the dim-0 faces; a face's coordinate is the
-- barycentre of the vertices it spans, doubled so it stays an exact integer vector (the viewer halves and
-- projects). Three functions on the carrier drive it: dim_fn (face dimension), point_fn (the doubled coordinate),
-- contains_fn(big, small) (does face `big` contain face `small` — used with `small` a dim-0 vertex). One registry,
-- one generic viewer.
CREATE TABLE base_polytope (collection text PRIMARY KEY REFERENCES base_collection,
                            dim_fn text NOT NULL, point_fn text NOT NULL, contains_fn text NOT NULL, title text);

-- base_glyph: a carrier's cast into PAGE space — the SVG glyph KIND a viewer draws it as (a Ferrers diagram for a
-- partition, a lattice path for a Dyck/Motzkin path, cells for a binary word / subset). Keyed by CARRIER, so every
-- collection sharing that carrier inherits the glyph. This is the page-space sibling of base_polytope (scene space)
-- and base_repr (line/text space): all three declare a cast of the same element DATA into a different space. `kind`
-- names a renderer the client provides; SVG generation stays in the viewer for now (data here, drawing there).
CREATE TABLE base_glyph (carrier text PRIMARY KEY, kind text NOT NULL, title text,
                         pack text NOT NULL DEFAULT coalesce(current_setting('enumeratio.pack', true), 'core') REFERENCES base_pack);
CREATE TRIGGER base_glyph_pack_guard BEFORE UPDATE OR DELETE ON base_glyph FOR EACH ROW EXECUTE FUNCTION base_guard_pack();

-- base_trait: named capabilities / categories a collection can carry — real objects with a description and, like
-- Rust supertraits or Sage supercategories, `implies` edges (a trait entails others). Most assignments are DERIVED
-- from the registries (base_collection_trait, in traits.sql), then closed transitively over `implies`. The
-- vocabulary organizes the ever-growing collection list (filter/group by trait) and hints at shared interfaces.
CREATE TABLE base_trait (id text PRIMARY KEY, title text, description text NOT NULL, implies text[] NOT NULL DEFAULT '{}');

-- base_tag: the ORGANIZATIONAL classification vocabulary — the family/kind buckets a collection sits in (figurate,
-- prime_family, partition, path, …), distinct from base_trait (capabilities a collection HAS). Tags are editorial,
-- expected to grow large, and a collection carries many; `implies` closes them (figurate ⇒ integer_sequence ⇒ number).
-- The explorer filters the collection list by tag. See tags.sql for the vocabulary + assignment + the read view.
CREATE TABLE base_tag (id text PRIMARY KEY, title text, description text NOT NULL, implies text[] NOT NULL DEFAULT '{}');
-- collection → tag, the editorial assignments (FK on tag catches typos; none on collection so load order is free).
CREATE TABLE base_collection_tag_manual (collection text NOT NULL, tag text NOT NULL REFERENCES base_tag,
                                         PRIMARY KEY (collection, tag));

-- base_category: a classification a collection BELONGS to (vs base_trait, capabilities it HAS). Like a Sage category
-- (and unlike a Rust trait) it is hierarchical — a collection sits at ~one primary category and inherits its
-- `parents` — and it can REQUIRE traits (its axioms: `mathematical` requires `immutable`), the way an operator family
-- groups the operator classes its members must implement. The coarse mathematical/internal split is the top for now;
-- the finer category-theoretic lattice (Sets ⊃ Posets ⊃ Lattices ⊃ Groups) layers on later, with base_map as its
-- morphisms. Purely-organizational buckets (lattice_paths, trees) are a SEPARATE tag layer — kept out of here so the
-- category-theoretic picture stays clean.
CREATE TABLE base_category (id text PRIMARY KEY, title text, description text NOT NULL,
                            parents text[] NOT NULL DEFAULT '{}', requires text[] NOT NULL DEFAULT '{}');

-- base_internal: collections that are NOT mathematical objects — the catalog/config surfaced as collections (glyphs,
-- and later polyhedra, traits, …). They land in the `internal` category (mutable, not immutable); everything else is
-- `mathematical`. A collection appears here exactly when it enumerates the library's own machinery, not math.
CREATE TABLE base_internal (collection text PRIMARY KEY);

-- ambient-set (membership) notation: if a collection defines fiber_symbol(<coll>_fiber) → the ambient set's symbol
-- for a fiber (e.g. '2^[3]', 'C(5,3)', 'S₄'), wire the generic set_notation(<coll>_element) = the element IN its
-- ambient set, "<element> ∈ <symbol>" (the math membership rendering). base_realize calls this at the end; a
-- collection whose fiber type only exists AFTER realize (a base_restrict child) defines fiber_symbol then calls this.
-- Idempotent: no-op if there's no symbol, or set_notation is already wired.
CREATE FUNCTION wire_set_notation(coll text) RETURNS void LANGUAGE plpgsql AS $w$
BEGIN
  IF to_regprocedure(format('fiber_symbol(%I)', coll || '_fiber')) IS NOT NULL
     AND to_regprocedure(format('set_notation(%I)', coll || '_element')) IS NULL THEN
    EXECUTE format('CREATE FUNCTION set_notation(e %I) RETURNS text LANGUAGE sql IMMUTABLE AS $b$ SELECT render_value((e).value) || %L || fiber_symbol((e).fiber) $b$',
                   coll || '_element', ' ∈ ');
  END IF;
END $w$;

-- evaluated-notation ("<notation> = <value>"): the sibling of set_notation for a carrier whose canonical notation is a
-- SYMBOLIC form that reduces to a number — an integer_factorization renders 2^2·3, and value() evaluates it to 12, so
-- the located element renders "2^2·3 = 12" (the notation ⊕ the value it evaluates to). Wired iff the carrier defines an
-- evaluator value(<carrier>) RETURNS numeric; a plain number carrier (notation IS the value) defines no such fn and is
-- skipped, so eval_notation never degenerates to "12 = 12". base_realize calls this at the end. Idempotent.
CREATE FUNCTION wire_eval_notation(coll text) RETURNS void LANGUAGE plpgsql AS $w$
DECLARE carrier text;
BEGIN
  SELECT c.carrier INTO carrier FROM base_collection c WHERE id = coll;
  IF to_regprocedure(format('value(%s)', carrier)) IS NOT NULL
     AND to_regprocedure(format('eval_notation(%I)', coll || '_element')) IS NULL THEN
    EXECUTE format('CREATE FUNCTION eval_notation(e %I) RETURNS text LANGUAGE sql IMMUTABLE AS $b$ SELECT render_value((e).value) || %L || value((e).value)::text $b$',
                   coll || '_element', ' = ');
  END IF;
END $w$;

-- set-builder rendering: a fiber as a set-builder (KaTeX), e.g. k_subsets(4,2) → "\{\, S \subseteq [4] : |S| = 2 \,\}".
-- Generic — dispatched by the fiber's CARRIER (base_set_builder registry) over the fiber's grade axes read as a jsonb
-- {axis: value} map, mirroring the next/prev odometer. One function for every collection; a builder_fn per carrier reads
-- the axes and returns the math. Carriers with no registered builder (most) return NULL. See representations.sql for the
-- finset builder + registration.
CREATE TABLE base_set_builder (carrier text PRIMARY KEY, builder_fn text NOT NULL,   -- builder_fn: <fn>(jsonb axes) RETURNS text (KaTeX)
                               pack text NOT NULL DEFAULT coalesce(current_setting('enumeratio.pack', true), 'core') REFERENCES base_pack);
CREATE TRIGGER base_set_builder_pack_guard BEFORE UPDATE OR DELETE ON base_set_builder FOR EACH ROW EXECUTE FUNCTION base_guard_pack();
CREATE FUNCTION set_builder(f anyelement) RETURNS text LANGUAGE plpgsql STABLE AS $$
DECLARE coll text := substring(pg_typeof(f)::text FROM '^(.*)_fiber$'); v_carrier text; bfn text; out text;
BEGIN
  IF coll IS NULL THEN RETURN NULL; END IF;                                   -- not a <coll>_fiber value
  SELECT c.carrier INTO v_carrier FROM base_collection c WHERE id = coll;
  SELECT builder_fn INTO bfn FROM base_set_builder b WHERE b.carrier = v_carrier;
  IF bfn IS NULL THEN RETURN NULL; END IF;                                    -- carrier has no set-builder template
  EXECUTE format('SELECT %I($1)', bfn) INTO out USING to_jsonb(f);
  RETURN out;
END $$;

-- grade_bound(expr, vals, names): evaluate one base_grade lo/hi expression against a fiber's current axis values. The
-- expr references axes by position placeholder g<pos> (g1 = the pos-1 axis, g2 the pos-2, …); NULL expr = unbounded.
-- Our own data, EXECUTEd like the rest of the realizer. Substitutes high→low so g10 can't clobber g1.
CREATE FUNCTION grade_bound(expr text, vals jsonb, names text[]) RETURNS numeric LANGUAGE plpgsql STABLE AS $$
DECLARE s text := expr; i int; r numeric;
BEGIN
  IF expr IS NULL THEN RETURN NULL; END IF;
  FOR i IN REVERSE array_length(names, 1)..1 LOOP
    s := replace(s, 'g' || i, coalesce(vals ->> names[i], '0'));
  END LOOP;
  EXECUTE 'SELECT (' || s || ')::numeric' INTO r;
  RETURN r;
END $$;

-- next(fiber) / prev(fiber): the generic grade ODOMETER — ONE implementation for every graded collection, over ANY
-- number of axes (mixed radix: step the innermost axis; when it passes its hi, carry outward and reset the inner axes
-- to their lo). Data-driven from base_grade, so more axes need no new code — a per-collection version once baked ≤2 in
-- here, which was never a real limit. An unbounded innermost axis always steps (never carries); an ungraded or fully-
-- carried fiber → NULL. Non-fiber args (elements, carriers) fall through to NULL, and the typed <coll>_element next/prev
-- win by exact-match resolution — this is a floor, not a ceiling. Fibers are always walkable: no capability trait.
CREATE FUNCTION next(f anyelement) RETURNS anyelement LANGUAGE plpgsql STABLE AS $$
DECLARE
  coll text := substring(pg_typeof(f)::text FROM '^(.*)_fiber$');
  names text[]; los text[]; his text[]; out jsonb := to_jsonb(f);
  n int; i int; k int; cur numeric; hi numeric;
BEGIN
  IF coll IS NULL THEN RETURN NULL; END IF;                                          -- not a <coll>_fiber value
  SELECT array_agg(name ORDER BY pos), array_agg(lo_expr ORDER BY pos), array_agg(hi_expr ORDER BY pos)
    INTO names, los, his FROM base_grade WHERE collection = coll;
  n := coalesce(array_length(names, 1), 0);                                          -- ungraded (n=0) ⇒ loop is empty ⇒ NULL
  FOR i IN REVERSE n..1 LOOP
    cur := (out ->> names[i])::numeric;
    hi  := grade_bound(his[i], out, names);
    IF hi IS NULL OR cur < hi THEN                                                   -- room to step this axis
      out := jsonb_set(out, ARRAY[names[i]], to_jsonb(cur + 1));
      FOR k IN i + 1 .. n LOOP                                                       -- reset every inner axis to its lo
        out := jsonb_set(out, ARRAY[names[k]], to_jsonb(coalesce(grade_bound(los[k], out, names), 0)));
      END LOOP;
      RETURN jsonb_populate_record(f, out);
    END IF;
  END LOOP;
  RETURN NULL;                                                                       -- carried past the top: no next fiber
END $$;

-- clamp_fiber(fiber): the fiber itself with every axis raised to its lo bound (given the outer axes) — the FIRST valid
-- fiber at or after it. A handle's lower corner ROW(lower(axis)…) can sit below an inner axis's lo_expr (a range built
-- with lower 0 on an axis whose lo is 1, or one that depends on the outer axis); the odometer walks start here so they
-- never visit a fiber the odometer itself would not produce. Same data-driven shape as next/prev.
CREATE FUNCTION clamp_fiber(f anyelement) RETURNS anyelement LANGUAGE plpgsql STABLE AS $$
DECLARE
  coll text := substring(pg_typeof(f)::text FROM '^(.*)_fiber$');
  names text[]; los text[]; out jsonb := to_jsonb(f); n int; i int; cur numeric; lo numeric;
BEGIN
  IF coll IS NULL THEN RETURN f; END IF;
  SELECT array_agg(name ORDER BY pos), array_agg(lo_expr ORDER BY pos) INTO names, los FROM base_grade WHERE collection = coll;
  n := coalesce(array_length(names, 1), 0);
  FOR i IN 1..n LOOP
    cur := (out ->> names[i])::numeric;
    lo  := coalesce(grade_bound(los[i], out, names), 0);
    IF cur IS NULL OR cur < lo THEN out := jsonb_set(out, ARRAY[names[i]], to_jsonb(lo)); END IF;
  END LOOP;
  RETURN jsonb_populate_record(f, out);
END $$;

CREATE FUNCTION prev(f anyelement) RETURNS anyelement LANGUAGE plpgsql STABLE AS $$
DECLARE
  coll text := substring(pg_typeof(f)::text FROM '^(.*)_fiber$');
  names text[]; los text[]; his text[]; out jsonb := to_jsonb(f);
  n int; i int; k int; cur numeric; lo numeric; hik numeric;
BEGIN
  IF coll IS NULL THEN RETURN NULL; END IF;
  SELECT array_agg(name ORDER BY pos), array_agg(lo_expr ORDER BY pos), array_agg(hi_expr ORDER BY pos)
    INTO names, los, his FROM base_grade WHERE collection = coll;
  n := coalesce(array_length(names, 1), 0);
  FOR i IN REVERSE n..1 LOOP
    cur := (out ->> names[i])::numeric;
    lo  := coalesce(grade_bound(los[i], out, names), 0);
    IF cur > lo THEN                                                                 -- room to step down this axis
      out := jsonb_set(out, ARRAY[names[i]], to_jsonb(cur - 1));
      FOR k IN i + 1 .. n LOOP                                                       -- reset every inner axis to its hi (its last)
        hik := grade_bound(his[k], out, names);
        IF hik IS NULL THEN RETURN NULL; END IF;                                     -- inner axis unbounded ⇒ no last fiber ⇒ prev undefined
        out := jsonb_set(out, ARRAY[names[k]], to_jsonb(hik));
      END LOOP;
      RETURN jsonb_populate_record(f, out);
    END IF;
  END LOOP;
  RETURN NULL;
END $$;

-- random_inhabitant_jsonb(type): a random jsonb value shaped to fit `type`, walking the type structure — arrays
-- become a random-length jsonb array of inhabitants, composites an object over their fields, domains recurse to
-- their base type, and base scalars draw a small random literal. It's the shape engine behind random_element(carrier)
-- (#303): jsonb_populate_record(NULL::carrier, random_inhabitant_jsonb('carrier')) materializes a random INHABITANT
-- of the carrier TYPE — well-formed for the type, but NOT necessarily a canonical/valid collection element (a random
-- image int[] need not be a permutation). That is deliberate: it's the generator seam for quickcheck and negative
-- tests. Ranges/lengths are arbitrary small constants (type inhabitants, not tuned distributions). VOLATILE.
CREATE FUNCTION random_inhabitant_jsonb(t regtype) RETURNS jsonb LANGUAGE plpgsql VOLATILE AS $$
DECLARE ty pg_type; n int; arr jsonb := '[]'::jsonb; obj jsonb := '{}'::jsonb; a record;
BEGIN
  SELECT * INTO ty FROM pg_type WHERE oid = t;
  IF ty.typtype = 'd' THEN                                    -- domain: draw for the base type
    RETURN random_inhabitant_jsonb(ty.typbasetype::regtype);
  ELSIF ty.typcategory = 'A' AND ty.typelem <> 0 THEN         -- array: 0..4 random elements
    n := floor(random() * 5)::int;
    FOR i IN 1..n LOOP arr := arr || jsonb_build_array(random_inhabitant_jsonb(ty.typelem::regtype)); END LOOP;
    RETURN arr;
  ELSIF ty.typtype = 'c' THEN                                 -- composite: an object over its live fields
    FOR a IN SELECT attname, atttypid FROM pg_attribute
             WHERE attrelid = ty.typrelid AND attnum > 0 AND NOT attisdropped ORDER BY attnum LOOP
      obj := obj || jsonb_build_object(a.attname, random_inhabitant_jsonb(a.atttypid::regtype));
    END LOOP;
    RETURN obj;
  END IF;
  RETURN CASE ty.typname                                      -- base scalars
    WHEN 'int2' THEN to_jsonb(floor(random() * 20)::int)  WHEN 'int4' THEN to_jsonb(floor(random() * 20)::int)
    WHEN 'int8' THEN to_jsonb(floor(random() * 20)::int)  WHEN 'bool' THEN to_jsonb(random() < 0.5)
    WHEN 'numeric' THEN to_jsonb(round((random() * 100)::numeric, 2))
    WHEN 'float4' THEN to_jsonb(round((random() * 100)::numeric, 2))
    WHEN 'float8' THEN to_jsonb(round((random() * 100)::numeric, 2))
    WHEN 'text' THEN to_jsonb(substr(md5(random()::text), 1, 1 + floor(random() * 6)::int))
    WHEN 'varchar' THEN to_jsonb(substr(md5(random()::text), 1, 1 + floor(random() * 6)::int))
    WHEN 'bpchar' THEN to_jsonb(substr(md5(random()::text), 1, 1))
    ELSE 'null'::jsonb END;                                   -- unknown scalar ⇒ null field (partial, not a crash)
END $$;

CREATE FUNCTION base_realize(coll text) RETURNS void LANGUAGE plpgsql AS $realize$
DECLARE
  c base_collection%ROWTYPE; g record; carrier text; grade_count int;
  ctor_args text := ''; ctor_vals text := ''; fibers_from text := ''; fibers_addr text := '';
  fibers_body text; card_fiber text; notation_fn text;
  htext_parts text := ''; open_parts text := '';   -- handle ::text axis fragments; open-handle (unbounded-upper) test
  lower_fields text := '';   -- `lower((h).axis), …` — the fiber at the handle's own lower bound on every axis;
                              -- elements(handle) walks forward from here when the handle is open (#175)
  val_select text;   -- how carriers(handle) projects a value: composite carrier expands (.*), scalar/domain stays one column
  handle_fields text := ''; elem_srf text; a1_ptype text; a1_rtype text; addr_fields text := ''; addr_expr text;
  has_fiber_unrank boolean;   -- fiber_unrank(fiber, rank_index) registered ⇒ element_at/unrank/random_element/range all take the O(1) jump path
  within_h text := '';        -- `f lies inside h's ranges` (every axis); the odometer walks (fibers(h, n) / elements(h, slice)) filter on it
  past_h text := 'false';     -- `f's OUTERMOST axis is past h's upper` — where an odometer walk over a closed handle stops
  first_fiber text;           -- the fiber at h's lower bound on every axis (the unit fiber when ungraded)
  slice_emit text;            -- elements(h, slice): how one fiber's [a, b) is emitted — element_at jumps, or a prefix scan
BEGIN
  SELECT * INTO c FROM base_collection WHERE id = coll; carrier := c.carrier;
  SELECT count(*) INTO grade_count FROM base_grade WHERE collection = coll;

  -- types: the collection OWNS its typed <coll>_fiber (named typed axes, or (unit unit) for an ungraded singleton).
  -- Introspect it → handle (one range per axis: natural_number → natural_range) → element (fiber, ordinality, value).
  SELECT string_agg(format('%I %s', a.attname, replace(format_type(a.atttypid, a.atttypmod), '_number', '_range')), ', ' ORDER BY a.attnum)
    INTO handle_fields
    FROM pg_type t JOIN pg_attribute a ON a.attrelid = t.typrelid
   WHERE t.typname = coll || '_fiber' AND a.attnum > 0 AND NOT a.attisdropped;
  EXECUTE format('CREATE TYPE %I AS (%s)', coll, handle_fields);
  -- element = (fiber, rank, value). `rank` (rank_index, the within-fiber enumeration rank) and `value` are both
  -- nullable: (rank,value) present = resolved; (rank, ∅) = a thunk (unrank to resolve); (∅, value) = value-identified
  -- (rank(el) fills it lazily / NULL past bigint); (∅,∅) is reserved. `ordinality(element)` (generated below) is the
  -- structured ω-omega_ordinal fiber_address ⊕ rank; `.rank` resolves to it by functional notation.
  EXECUTE format('CREATE TYPE %I AS (fiber %I, rank rank_index_range, value %s)', coll || '_element', coll || '_fiber', carrier);

  -- Canonical serialization: register a per-carrier ::text CAST from its notation fn (once per carrier, guarded on
  -- pg_cast), so value::text IS the canonical form. render_value(v) = v::text (carriers with no notation keep the
  -- built-in ::text); render(element) coerces the value. Also renders a map's image in the codomain's own form.
  notation_fn := CASE
    WHEN to_regprocedure(format('notation(%s)', carrier)) IS NOT NULL THEN 'notation'
    WHEN to_regprocedure(format('%I(%s)', carrier || '_notation', carrier)) IS NOT NULL THEN carrier || '_notation'
    ELSE NULL END;
  IF notation_fn IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_cast WHERE castsource = carrier::regtype AND casttarget = 'text'::regtype) THEN
    EXECUTE format('CREATE CAST (%s AS text) WITH FUNCTION %I(%s) AS ASSIGNMENT', carrier, notation_fn, carrier);
  END IF;
  IF to_regprocedure(format('render_value(%s)', carrier)) IS NULL THEN
    EXECUTE format('CREATE FUNCTION render_value(v %s) RETURNS text LANGUAGE sql IMMUTABLE AS $b$ SELECT v::text $b$', carrier);
  END IF;
  EXECUTE format('CREATE FUNCTION render(e %I) RETURNS text LANGUAGE sql IMMUTABLE AS $b$ SELECT render_value((e).value) $b$', coll || '_element');
  PERFORM wire_set_notation(coll);    -- wire "<element> ∈ <symbol>" if fiber_symbol was defined before realize
  PERFORM wire_eval_notation(coll);   -- wire "<notation> = <value>" if the carrier has an evaluator value(<carrier>)

  -- ctor params stay positional (g1,g2 — lo/hi_expr text still resolves); handle FIELDS are named + typed per axis
  -- (natural_range). No −1 on the unfold: the numeric range is uncanonicalized '[]', so upper() is the inclusive bound.
  FOR g IN
    SELECT bg.pos, bg.name, bg.lo_expr, bg.hi_expr, format_type(a.atttypid, a.atttypmod) AS ptype,
           replace(format_type(a.atttypid, a.atttypmod), '_number', '_range') AS rtype
      FROM base_grade bg JOIN pg_type t ON t.typname = coll || '_fiber'
           JOIN pg_attribute a ON a.attrelid = t.typrelid AND a.attname = bg.name AND a.attnum > 0
     WHERE bg.collection = coll ORDER BY bg.pos
  LOOP
    IF g.pos = 1 THEN a1_ptype := g.ptype; a1_rtype := g.rtype; END IF;
    ctor_args := ctor_args || format('%sg%s %s DEFAULT NULL', CASE WHEN ctor_args = '' THEN '' ELSE ', ' END, g.pos, g.ptype);
    -- an unbound axis takes its declared [lo, hi]; a hi_expr that depends on an EARLIER axis is NULL (open) whenever that
    -- axis is itself unbound — `greatest(g1 - 1, 0)` would otherwise read 0 for g1 = NULL (greatest skips NULLs) and pin
    -- the inner axis shut. The odometer walks re-bound it per fiber from base_grade (clamp_fiber / next), so an open
    -- outer axis with a dependent inner one unfolds exactly the fibers the bound constructor would.
    ctor_vals := ctor_vals || format('%sCASE WHEN g%s IS NULL THEN %I(%s, %s, ''[]'') ELSE %I(g%s, g%s, ''[]'') END',
                   CASE WHEN ctor_vals = '' THEN '' ELSE ', ' END, g.pos, g.rtype, coalesce(g.lo_expr, '0'),
                   CASE WHEN g.hi_expr IS NULL THEN 'g' || g.pos
                        WHEN g.hi_expr ~ 'g[0-9]+' THEN format('CASE WHEN %s THEN NULL ELSE (%s) END',
                          (SELECT string_agg(m[1] || ' IS NULL', ' OR ') FROM regexp_matches(g.hi_expr, '(g[0-9]+)', 'g') m), g.hi_expr)
                        ELSE g.hi_expr END,
                   g.rtype, g.pos, g.pos);
    fibers_from := fibers_from || format('%sgenerate_series(lower((h).%I)::numeric, upper((h).%I)::numeric, 1) a%s',
                     CASE WHEN fibers_from = '' THEN '' ELSE ', ' END, g.name, g.name, g.pos);
    fibers_addr := fibers_addr || format('%sa%s', CASE WHEN fibers_addr = '' THEN '' ELSE ', ' END, g.pos);
    addr_fields := addr_fields || format('%s(f).%I', CASE WHEN addr_fields = '' THEN '' ELSE ', ' END, g.name);
    -- handle ::text: per-axis `name=<v>` (point) / `name=lo..hi` (range) / `name=lo..` (unbounded upper) fragment
    htext_parts := htext_parts || CASE WHEN htext_parts = '' THEN '' ELSE ' || '', '' || ' END ||
      format('%1$L || ''='' || CASE '
             'WHEN lower(%2$s) IS NOT DISTINCT FROM upper(%2$s) THEN lower(%2$s)::text '
             'WHEN lower(%2$s) IS NULL THEN ''..'' || upper(%2$s)::text '
             'WHEN upper(%2$s) IS NULL THEN lower(%2$s)::text || ''..'' '
             'ELSE lower(%2$s)::text || ''..'' || upper(%2$s)::text END', g.name, format('(h).%I', g.name));
    -- an unbounded upper on any axis makes the handle OPEN (its fibers don't unfold): carriers/unnest RAISE on it
    open_parts := open_parts || CASE WHEN open_parts = '' THEN '' ELSE ' OR ' END || format('upper((h).%I) IS NULL', g.name);
    lower_fields := lower_fields || format('%slower((h).%I)', CASE WHEN lower_fields = '' THEN '' ELSE ', ' END, g.name);
    within_h := within_h || CASE WHEN within_h = '' THEN '' ELSE ' AND ' END ||
      format('(lower((h).%1$I) IS NULL OR (f).%1$I >= lower((h).%1$I)) AND (upper((h).%1$I) IS NULL OR (f).%1$I <= upper((h).%1$I))', g.name);
    IF g.pos = 1 THEN past_h := format('(upper((h).%1$I) IS NOT NULL AND (f).%1$I > upper((h).%1$I))', g.name); END IF;
    -- <axis>(element): the axis value straight off the element (e.size, not ((e).fiber).size) — a grade axis is a
    -- property of every element in the fiber, and the query view's grade COLUMNS read it this way.
    EXECUTE format('CREATE FUNCTION %I(e %I) RETURNS %s LANGUAGE sql IMMUTABLE AS $b$ SELECT ((e).fiber).%I $b$',
                   g.name, coll || '_element', g.ptype, g.name);
  END LOOP;
  IF within_h = '' THEN within_h := 'true'; END IF;
  first_fiber := CASE WHEN grade_count = 0 THEN 'ROW(true)' ELSE format('clamp_fiber(ROW(%s)::%I)', lower_fields, coll || '_fiber') END;

  -- constructor(s)
  IF grade_count = 0 THEN   -- singleton: no axes, one unit fiber/handle
    EXECUTE format('CREATE FUNCTION %I() RETURNS %I LANGUAGE sql IMMUTABLE AS $b$ SELECT ROW(true)::%I $b$', coll, coll, coll);
  ELSE             -- named range fields → ROW(range1, range2, …); single-axis also gets a typed (lo,hi) range ctor
    EXECUTE format('CREATE FUNCTION %I(%s) RETURNS %I LANGUAGE sql IMMUTABLE AS $b$ SELECT ROW(%s)::%I $b$', coll, ctor_args, coll, ctor_vals, coll);
    IF grade_count = 1 THEN
      EXECUTE format('CREATE FUNCTION %I(lo %s, hi %s) RETURNS %I LANGUAGE sql IMMUTABLE AS $b$ SELECT ROW(%I(lo, hi, ''[]''))::%I $b$', coll, a1_ptype, a1_ptype, coll, a1_rtype, coll);
    END IF;
  END IF;

  -- handle ::text — the readable CONSTRUCTOR form: coll(axis=lo..hi, …), or coll() when ungraded. Replaces the raw
  -- record/range wire format (set_partitions(6) shows `set_partitions(n=6)`, not `("[6,6]")`). A per-handle-type CAST
  -- (the type is fresh per collection, so no guard) makes handle::text canonical, mirroring the per-carrier ::text cast.
  IF grade_count = 0 THEN
    EXECUTE format('CREATE FUNCTION %I(h %I) RETURNS text LANGUAGE sql IMMUTABLE AS $b$ SELECT %L $b$', coll || '_handle_text', coll, coll || '()');
  ELSE
    EXECUTE format('CREATE FUNCTION %I(h %I) RETURNS text LANGUAGE sql IMMUTABLE AS $b$ SELECT %L || ''('' || (%s) || '')'' $b$', coll || '_handle_text', coll, coll, htext_parts);
  END IF;
  EXECUTE format('CREATE CAST (%I AS text) WITH FUNCTION %I(%I) AS ASSIGNMENT', coll, coll || '_handle_text', coll);

  -- fibers(handle): unfold the grade ranges into point fibers (ungraded ⇒ the single unit fiber)
  IF grade_count = 0 THEN fibers_body := format('SELECT ROW(true)::%I', coll || '_fiber');
  ELSE           fibers_body := format('SELECT ROW(%s)::%I FROM %s', fibers_addr, coll || '_fiber', fibers_from);
  END IF;
  EXECUTE format('CREATE FUNCTION fibers(h %I) RETURNS SETOF %I LANGUAGE sql STABLE AS $b$ %s $b$', coll, coll || '_fiber', fibers_body);
  -- fibers(handle, fiber_limit): the first fiber_limit fibers of the handle in address order — STREAMING, so it also
  -- works on an OPEN handle (an axis with a NULL upper), where fibers(h) above yields nothing (its generate_series
  -- unfold is STRICT on the NULL bound). Walks the generic next(fiber) odometer from the handle's lower fiber, keeping
  -- the fibers inside h; a closed handle just takes fibers(h). The query view's GROUP BY <axes> reads a collection's
  -- counting sequence off this without touching an element.
  EXECUTE format(
    'CREATE FUNCTION fibers(h %1$I, fiber_limit int) RETURNS SETOF %2$I LANGUAGE plpgsql STABLE AS $b$ '
    'DECLARE f %2$I; got int := 0; iter int := 0; BEGIN '
    'IF NOT (%3$s) THEN RETURN QUERY SELECT (ff).* FROM fibers(h) ff ORDER BY fiber_address(ff) LIMIT fiber_limit; RETURN; END IF; '
    'f := %4$s::%2$I; '
    'WHILE got < fiber_limit AND f IS NOT NULL AND iter < 1000000 LOOP '
    'IF %5$s THEN EXIT; END IF; '
    'IF %6$s THEN RETURN NEXT f; got := got + 1; END IF; '
    'f := next(f); iter := iter + 1; '
    'END LOOP; END $b$',
    coll, coll || '_fiber', CASE WHEN open_parts = '' THEN 'false' ELSE open_parts END, first_fiber, past_h, within_h);

  -- fiber_address(fiber): the ordered axis values as numeric[] (empty {} for a singleton)
  addr_expr := format('ARRAY[%s]::numeric[]', addr_fields);
  EXECUTE format('CREATE FUNCTION fiber_address(f %I) RETURNS omega_ordinal LANGUAGE sql IMMUTABLE AS $b$ SELECT %s $b$', coll || '_fiber', addr_expr);

  -- next(fiber) / prev(fiber) are NOT generated per collection — a single generic, data-driven odometer
  -- (next(anyelement)/prev(anyelement), defined once above base_realize) walks the grade axes of ANY collection over
  -- ANY number of axes. This <coll>_fiber value resolves to it by polymorphism; a specific override would win if ever
  -- registered.

  -- address(fiber): the fiber's structured coordinates TYPED as rank_index[] (the same axis values fiber_address
  -- returns as a bare omega_ordinal). The element-level analogue is omega_ordinality — address extended by the rank.
  EXECUTE format('CREATE FUNCTION address(f %I) RETURNS rank_index[] LANGUAGE sql IMMUTABLE AS $b$ SELECT ARRAY[%s]::rank_index[] $b$', coll || '_fiber', addr_fields);

  -- The element''s POSITIONS — four notions, each computable from the element alone except the last:
  --   rank(e)              its position WITHIN ITS FIBER in canonical order, 0-based — what element_at(fiber, rank) inverts
  --   address(e)           the compound: the fiber''s coordinates ⊕ rank, as rank_index[] ({4,2,1}) — spelled `4.2.1`
  --   omega_ordinality(e)  the same compound as a Cantor-normal-form ordinal < ω^ω (ω²·4 + ω·2 + 1), totally ordered
  --   ordinality           its 1-based position in a RESULT SET — pg WITH ORDINALITY / row_number(); a property of a
  --                        query, not of an element, so it is computed per statement (the client), never generated here.
  -- The fiber has the compound halves: address(f) (rank_index[]) and fiber_address(f) (omega_ordinal).
  EXECUTE format('CREATE FUNCTION rank(e %I) RETURNS rank_index LANGUAGE sql IMMUTABLE AS $b$ SELECT lower((e).rank) $b$', coll || '_element');
  EXECUTE format('CREATE FUNCTION address(e %I) RETURNS rank_index[] LANGUAGE sql IMMUTABLE AS $b$ SELECT address((e).fiber) || lower((e).rank) $b$', coll || '_element');
  -- ordinality(element): LEGACY spelling of rank(e) (same 0-based within-fiber value, as a natural_number) — kept for the
  -- floors and examples written before the result-set sense was separated; prefer rank(e).
  EXECUTE format('CREATE FUNCTION ordinality(e %I) RETURNS natural_number LANGUAGE sql IMMUTABLE AS $b$ SELECT lower((e).rank)::natural_number $b$', coll || '_element');

  -- omega_ordinality(element): the STRUCTURED global position as an omega_ordinal < ω^ω — the fiber ADDRESS with the
  -- within-fiber rank (the range''s lower bound) appended as the finest coordinate (address ⊕ rank). NULL for a rankless element.
  EXECUTE format('CREATE FUNCTION omega_ordinality(e %I) RETURNS omega_ordinal LANGUAGE sql IMMUTABLE AS $b$ '
                 'SELECT CASE WHEN lower((e).rank) IS NULL THEN NULL ELSE (fiber_address((e).fiber) || lower((e).rank)::numeric)::omega_ordinal END $b$',
                 coll || '_element');

  -- elements(fiber): wrap the floor engine; ordinality by emission order. `s` = bare whole-row carrier alias (keeps the
  -- SRF from expanding a composite carrier into columns). element_limit = paging emit-limit, NOT the fiber's size.
  elem_srf := 'fiber_elements(f, element_limit)';
  EXECUTE format('CREATE FUNCTION elements(f %I, element_limit int DEFAULT 5000) RETURNS SETOF %I LANGUAGE sql STABLE AS $b$ '
                 'SELECT ROW(f, rank_point((row_number() OVER () - 1)::rank_index), s)::%I FROM %s s $b$',
                 coll || '_fiber', coll || '_element', coll || '_element', elem_srf);
  -- elements(handle): flat-map over fibers, globally ordered. The combined order is DATA-DRIVEN from the grade chain:
  -- fiber_address (the axis values in base_grade.pos order, as an omega_ordinal) picks the fiber, then the within-fiber
  -- rank (emission order). This is the grade axes ⊕ the sort — not the element composite's accidental field order.
  --
  -- An OPEN handle (an axis with upper() IS NULL — #175's default "whole" graded collection, browsed across every n)
  -- can't take that path: fibers(h) unfolds via generate_series(lower, upper, 1), and a NULL upper makes that a
  -- no-row STRICT call — the SAME trap the cardinality(handle) fix (commit 1c1311c) already worked around for
  -- cardinality, but that fix didn't reach elements()/window() paging, which silently returned zero rows. Instead,
  -- start at the fiber sitting at the handle's own lower bound on every axis and STREAM forward via the generic
  -- next(fiber) odometer (data-driven from base_grade, already used elsewhere for exactly this walk) until
  -- element_limit elements have been pulled — never materializing "all" fibers, which for an open axis don't exist.
  -- An axis the odometer's own base_grade bounds leave inherently unbounded (hi_expr NULL, e.g. partition size) never
  -- carries, so the walk is a straight ascending ray on it — and stops once the OUTERMOST axis passes the handle's
  -- upper bound (a ranged outer axis with an open inner one, e.g. k_subsets(n=0..4) with k free, is finite and ends).
  -- A second SIMULTANEOUSLY open axis (rare — the client
  -- can't produce it today, since Handle.built()'s "trailing unbound" ctor convention drops a bound axis behind an
  -- unbound one) is effectively pinned at its lower bound rather than dovetailed — a real but incomplete slice, not
  -- an error, and a fine default until a genuine multi-axis open walk is worth building.
  --
  -- The BARREN-FIBER BUDGET (`dry`, #254) is what makes that slice terminate. `got` only advances on a fiber that
  -- yields something, so a ray of empty fibers never reaches element_limit and the walk ran to the 1e6 iteration
  -- backstop instead — 20s+, i.e. a hang. Two shapes hit it: a collection empty off one grade value
  -- (singleton_species is nonempty only at n=1), and the pinned-inner-axis slice above (multisets pins n=0 and rays
  -- on k, where every fiber past k=0 is empty). Neither has a next element in the handle's own fiber_address order,
  -- so stopping and returning what was found is the honest answer, not a truncation of something reachable.
  -- The budget counts barren fibers CUMULATIVELY, never resetting, so the total walk is bounded by
  -- element_limit + 1000 fibers; a productive fiber is never cut off by it.
  EXECUTE format(
    'CREATE FUNCTION elements(h %I, element_limit int DEFAULT 5000) RETURNS SETOF %I LANGUAGE plpgsql STABLE AS $b$ '
    'DECLARE f %I; got int := 0; d int; iter int := 0; dry int := 0; BEGIN '
    'IF NOT (%s) THEN '
    'RETURN QUERY SELECT (e).* FROM fibers(h) ff, LATERAL elements(ff, element_limit) e ORDER BY fiber_address(ff), (e).rank LIMIT element_limit; '
    'RETURN; '
    'END IF; '
    'f := clamp_fiber(ROW(%s)::%I); '
    'WHILE got < element_limit AND f IS NOT NULL AND iter < 1000000 AND dry < 1000 LOOP '
    'IF %s THEN EXIT; END IF; '
    'RETURN QUERY SELECT (e).* FROM elements(f, element_limit - got) e; '
    'GET DIAGNOSTICS d = ROW_COUNT; IF d = 0 THEN dry := dry + 1; END IF; got := got + d; f := next(f); iter := iter + 1; '
    'END LOOP; '
    'END $b$',
    coll, coll || '_element', coll || '_fiber',
    CASE WHEN open_parts = '' THEN 'false' ELSE open_parts END,
    lower_fields, coll || '_fiber', past_h);

  -- cardinality(fiber): the count accel if present; else ∞ if unbounded; else count the floor (unbounded window)
  IF to_regprocedure(format('fiber_count(%I)', coll || '_fiber')) IS NOT NULL THEN
    card_fiber := 'SELECT fiber_count(f)';
  ELSIF c.unbounded THEN
    card_fiber := 'SELECT ''infinity''::numeric';
  ELSE
    card_fiber := format('SELECT count(*)::numeric FROM %s v', replace(elem_srf, 'element_limit', '2147483647'));
  END IF;
  EXECUTE format('CREATE FUNCTION cardinality(f %I) RETURNS cardinal LANGUAGE sql STABLE AS $b$ %s $b$', coll || '_fiber', card_fiber);
  -- cardinality(handle): sum over fibers(h) — EXCEPT an open handle (an axis with upper() IS NULL, incl. the
  -- fully-ungraded WHOLE handle where every bound is NULL) can't unfold via fibers()'s generate_series: a NULL
  -- bound makes it a no-row STRICT call, so the naive sum silently saw zero fibers and coalesced to 0. Guard it the
  -- same way carriers()/unnest() already detect "open" below (open_parts), and report the ∞ sentinel instead —
  -- matching the c.unbounded ⇒ 'infinity'::numeric convention a single unbounded fiber already reports.
  EXECUTE format('CREATE FUNCTION cardinality(h %I) RETURNS cardinal LANGUAGE sql STABLE AS $b$ '
                 'SELECT CASE WHEN %s THEN ''infinity''::numeric '
                 'ELSE (SELECT coalesce(sum(cardinality(f)), 0) FROM fibers(h) f) END $b$',
                 coll, CASE WHEN open_parts = '' THEN 'false' ELSE open_parts END);

  -- element_at(fiber, ord): direct fiber access (capability layer 3). Generated iff the collection provides the
  -- OPTIONAL fiber_unrank(fiber, ord) accel — the ord-th element WITHOUT iterating (a term(r) formula, a combinatorial
  -- unrank, …). Absent ⇒ callers scan via elements(); the `indexable` capability trait reports which collections have it.
  has_fiber_unrank := to_regprocedure(format('fiber_unrank(%I, rank_index)', coll || '_fiber')) IS NOT NULL;
  IF has_fiber_unrank THEN
    -- bounds-guarded like unrank(handle, r): NULL for ord < 0 or ord >= the fiber's cardinality (∞ ⇒ any ord >= 0 is in range).
    EXECUTE format('CREATE FUNCTION element_at(f %I, ord rank_index) RETURNS %I LANGUAGE sql STABLE AS $b$ '
                   'SELECT CASE WHEN ord >= 0 AND ord < cardinality(f) THEN ROW(f, rank_point(ord), fiber_unrank(f, ord))::%I END $b$',
                   coll || '_fiber', coll || '_element', coll || '_element');
  END IF;

  -- unrank(handle, r): the r-th element in global order. r is a rank_index (bigint). Accelerated path (when the
  -- collection registers fiber_unrank, so element_at was just wired above): locate the containing fiber by walking
  -- fibers(h) in global order and comparing r against each fiber's cumulative cardinality run (a la
  -- random_element(handle) below), then jump straight to it via element_at — no elements() materialization at all.
  -- `prior` = the running total BEFORE this fiber (empty-window sum is NULL ⇒ coalesce to 0 for the first fiber);
  -- a fiber with infinite cardinality makes every later fiber's `prior` infinite too, so a finite r naturally can
  -- never match past it — same "an infinite fiber swallows the rest" behavior the naive scan has always had.
  -- Falls back to the sequential scan (capped at int — can't materialize > 2^31 rows) when no accel is registered.
  IF has_fiber_unrank THEN
    EXECUTE format('CREATE FUNCTION unrank(h %I, r rank_index) RETURNS %I LANGUAGE sql STABLE AS $b$ '
                   'WITH cum AS (SELECT f, '
                   'sum(cardinality(f)) OVER (ORDER BY fiber_address(f) ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) prior, '
                   'sum(cardinality(f)) OVER (ORDER BY fiber_address(f)) run '
                   'FROM fibers(h) f WHERE cardinality(f) IS NOT NULL AND cardinality(f) > 0) '
                   'SELECT element_at(f, (r - coalesce(prior, 0))::rank_index) FROM cum '
                   'WHERE r >= coalesce(prior, 0) AND r < run LIMIT 1 $b$',
                   coll, coll || '_element');
  ELSE
    EXECUTE format('CREATE FUNCTION unrank(h %I, r rank_index) RETURNS %I LANGUAGE sql STABLE AS $b$ SELECT e FROM elements(h, least(r + 1, 2147483647)::int) e ORDER BY fiber_address((e).fiber), (e).rank OFFSET r LIMIT 1 $b$', coll, coll || '_element');
  END IF;

  -- elements(handle, slice): the elements at GLOBAL positions in `slice` (a rank_index_range over the handle's canonical
  -- order — the same index unrank(h, r) takes), so a window is a first-class value: elements(h, '[24,48)'). Walks the
  -- fibers by the odometer (works on an OPEN handle), skips whole fibers by cardinality, and jumps straight to each
  -- element via element_at when fiber_unrank exists — else scans only that fiber's prefix. Nothing past the slice's
  -- upper bound is ever materialized; the client's paging (OFFSET over elements(h, first+count)) can retire onto this.
  -- Carries the same barren-fiber budget as elements(h, element_limit) above, for the same reason — here a fiber is
  -- barren when it adds nothing to `run`, which covers both an empty fiber and one outside the handle's ranges.
  slice_emit := CASE WHEN has_fiber_unrank
    THEN 'RETURN QUERY SELECT (element_at(f, i::rank_index)).* FROM generate_series(a::bigint, (b - 1)::bigint) i; GET DIAGNOSTICS d = ROW_COUNT;'
    ELSE 'RETURN QUERY SELECT (e).* FROM elements(f, least(b, 2147483647)::int) e OFFSET a LIMIT (b - a); GET DIAGNOSTICS d = ROW_COUNT;' END;
  EXECUTE format(
    'CREATE FUNCTION elements(h %1$I, s rank_index_range) RETURNS SETOF %2$I LANGUAGE plpgsql STABLE AS $b$ '
    'DECLARE f %3$I; lo numeric; hi numeric; run numeric := 0; r0 numeric; c numeric; a numeric; b numeric; d int; iter int := 0; dry int := 0; BEGIN '
    'IF isempty(s) THEN RETURN; END IF; '
    'IF upper(s) IS NULL THEN RAISE EXCEPTION ''elements(handle, slice): the slice needs a finite upper bound''; END IF; '
    'lo := coalesce(lower(s), 0) + CASE WHEN lower(s) IS NOT NULL AND NOT lower_inc(s) THEN 1 ELSE 0 END; '
    'hi := upper(s) + CASE WHEN upper_inc(s) THEN 1 ELSE 0 END; '
    'f := %4$s::%3$I; '
    'WHILE f IS NOT NULL AND run < hi AND iter < 1000000 AND dry < 1000 LOOP '
    'IF %5$s THEN EXIT; END IF; '
    'r0 := run; '
    'IF %6$s THEN '
    'c := cardinality(f); a := greatest(lo - run, 0); b := hi - run; d := 0; '
    'IF c IS NOT NULL THEN b := least(b, c); END IF; '
    'IF a < b THEN %7$s END IF; '
    'run := run + CASE WHEN c IS NULL THEN a + d ELSE c END; '
    'END IF; '
    'IF run = r0 THEN dry := dry + 1; END IF; '
    'f := next(f); iter := iter + 1; '
    'END LOOP; END $b$',
    coll, coll || '_element', coll || '_fiber', first_fiber, past_h, within_h, slice_emit);

  -- random_element(fiber): a uniform-random element, or NULL when the fiber is empty / uncountable (∞) / unknown-count
  -- (the count accel absent AND the floor would not terminate). Uses the direct fiber_unrank (O(1)) if present, else
  -- scans to the random omega_ordinal via elements(). VOLATILE (draws random()).
  IF has_fiber_unrank THEN
    EXECUTE format('CREATE FUNCTION random_element(f %I) RETURNS %I LANGUAGE sql VOLATILE AS $b$ '
                   'SELECT ROW(f, rank_point(o), fiber_unrank(f, o))::%I FROM (SELECT floor(random() * c)::rank_index o FROM (SELECT cardinality(f) c) x '
                   'WHERE c IS NOT NULL AND c > 0 AND c < ''infinity''::numeric) t $b$',
                   coll || '_fiber', coll || '_element', coll || '_element');
  ELSE
    EXECUTE format('CREATE FUNCTION random_element(f %I) RETURNS %I LANGUAGE sql VOLATILE AS $b$ '
                   'SELECT (SELECT e FROM elements(f, least(o + 1, 2147483647)::int) e ORDER BY e OFFSET o LIMIT 1) '   -- ORDER BY e = by rank, matching unrank
                   'FROM (SELECT floor(random() * c)::rank_index o FROM (SELECT cardinality(f) c) x '
                   'WHERE c IS NOT NULL AND c > 0 AND c < ''infinity''::numeric) p $b$',
                   coll || '_fiber', coll || '_element');
  END IF;

  -- random_element(handle): pick a fiber weighted by its cardinality, then a uniform element within it — uniform over
  -- ALL elements. NULL when every in-range fiber is empty / uncountable / unknown-count.
  EXECUTE format('CREATE FUNCTION random_element(h %I) RETURNS %I LANGUAGE sql VOLATILE AS $b$ '
                 'WITH cum AS (SELECT f, sum(cardinality(f)) OVER (ORDER BY fiber_address(f)) run FROM fibers(h) f '
                 'WHERE cardinality(f) IS NOT NULL AND cardinality(f) > 0 AND cardinality(f) < ''infinity''::numeric), '
                 'pick AS (SELECT floor(random() * (SELECT max(run) FROM cum)) r WHERE (SELECT max(run) FROM cum) > 0) '
                 'SELECT random_element(f) FROM cum, pick WHERE run > r ORDER BY run LIMIT 1 $b$',
                 coll, coll || '_element');

  -- random_elements(handle|fiber, n): the PLURAL of random_element — n independent uniform draws WITH replacement
  -- (the quickcheck sampling contract: iid, so repeats are expected and correct). Each draw delegates to the
  -- singular, inheriting its refusal (a draw that would be non-uniform yields NULL); the NULLs are filtered, so an
  -- undrawable handle/fiber (empty / ∞ / unknown-count) yields ZERO rows rather than n NULL rows — same "refuses,
  -- never fakes" behavior as the singular, just vacuous instead of NULL. #303.
  EXECUTE format('CREATE FUNCTION random_elements(h %1$I, n int) RETURNS SETOF %2$I LANGUAGE sql VOLATILE AS $b$ '
                 'SELECT e FROM (SELECT random_element(h) e FROM generate_series(1, greatest(n, 0))) t WHERE e IS NOT NULL $b$',
                 coll, coll || '_element');
  EXECUTE format('CREATE FUNCTION random_elements(f %1$I, n int) RETURNS SETOF %2$I LANGUAGE sql VOLATILE AS $b$ '
                 'SELECT e FROM (SELECT random_element(f) e FROM generate_series(1, greatest(n, 0))) t WHERE e IS NOT NULL $b$',
                 coll || '_fiber', coll || '_element');

  -- random_element(carrier): a uniform-ish random INHABITANT of the carrier TYPE — the arg is a type witness
  -- (call as random_element(NULL::<carrier>)), not an operand. Synthesized from the carrier's field types via
  -- random_inhabitant_jsonb, so the result is well-formed for the type but NOT necessarily a canonical/valid element
  -- (a random image int[] need not be a permutation) — the generator seam for quickcheck and negative tests, distinct
  -- from random_element(handle) which draws a genuine member. Generated ONCE per distinct carrier (the existence
  -- guard also means a carrier's own SQL file can hand-author an override that wins). Composite carriers only — a
  -- scalar/domain carrier is skipped here (no field structure to populate; hand-author if one is ever wanted). #303.
  IF (SELECT typtype FROM pg_type WHERE typname = carrier) = 'c'
     AND NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_type pt ON pt.oid = p.proargtypes[0]
                     WHERE p.proname = 'random_element' AND p.pronargs = 1 AND pt.typname = carrier) THEN
    EXECUTE format('CREATE FUNCTION random_element(x %1$s) RETURNS %1$s LANGUAGE sql VOLATILE AS $b$ '
                   'SELECT jsonb_populate_record(NULL::%1$s, random_inhabitant_jsonb(%2$L::regtype)) $b$', carrier, carrier);
  END IF;

  -- an_element(handle|fiber) / some_elements(handle, n): the DETERMINISTIC example accessors (Sage's an_element /
  -- some_elements). Unlike random_element these are stable across calls and cheap — an_element is just the first
  -- element in canonical order (unrank(h,0) / rank-0 of the fiber), some_elements the first n. NULL / empty when the
  -- collection is empty. These return enumeration-order representatives; a PROTOTYPICAL-vs-edge-curated variant is a
  -- separate metadata layer (#304, open). #304.
  EXECUTE format('CREATE FUNCTION an_element(h %1$I) RETURNS %2$I LANGUAGE sql STABLE AS $b$ SELECT unrank(h, 0::rank_index) $b$',
                 coll, coll || '_element');
  IF has_fiber_unrank THEN
    EXECUTE format('CREATE FUNCTION an_element(f %1$I) RETURNS %2$I LANGUAGE sql STABLE AS $b$ SELECT element_at(f, 0::rank_index) $b$',
                   coll || '_fiber', coll || '_element');
  ELSE
    EXECUTE format('CREATE FUNCTION an_element(f %1$I) RETURNS %2$I LANGUAGE sql STABLE AS $b$ SELECT e FROM elements(f, 1) e ORDER BY e LIMIT 1 $b$',
                   coll || '_fiber', coll || '_element');
  END IF;
  EXECUTE format('CREATE FUNCTION some_elements(h %1$I, n int DEFAULT 5) RETURNS SETOF %2$I LANGUAGE sql STABLE AS $b$ SELECT * FROM elements(h, greatest(n, 0)) $b$',
                 coll, coll || '_element');
  EXECUTE format('CREATE FUNCTION some_elements(f %1$I, n int DEFAULT 5) RETURNS SETOF %2$I LANGUAGE sql STABLE AS $b$ SELECT * FROM elements(f, greatest(n, 0)) $b$',
                 coll || '_fiber', coll || '_element');

  -- carriers(handle) / unnest(handle): the bound handle's elements' CARRIER VALUES as a set (the raw math objects,
  -- globally ordered). Defined only for a FINITE, CLOSED handle — an open axis (unbounded upper) or an infinite/unknown
  -- cardinality RAISES (an infinite handle has no materializable carrier set). `unnest` is the idiomatic pg alias: a
  -- bound handle is ≈ a lazy array of its carriers, so unnest(h) streams them just like unnest(anyarray).
  val_select := CASE WHEN (SELECT typtype FROM pg_type WHERE typname = carrier) = 'c' THEN '((e).value).*' ELSE '(e).value' END;
  EXECUTE format('CREATE FUNCTION carriers(h %1$I) RETURNS SETOF %2$s LANGUAGE plpgsql STABLE AS $b$ '
                 'BEGIN IF %3$s THEN RAISE EXCEPTION ''carriers(%%): open or infinite handle has no finite carrier set'', %5$L; END IF; '
                 'RETURN QUERY SELECT %4$s FROM elements(h, 2147483647) e; END $b$',
                 coll, carrier,
                 CASE WHEN open_parts = '' THEN '' ELSE '(' || open_parts || ') OR ' END
                   || 'cardinality(h) IS NULL OR cardinality(h) = ''infinity''::numeric',
                 val_select, coll);
  EXECUTE format('CREATE FUNCTION unnest(h %1$I) RETURNS SETOF %2$s LANGUAGE sql STABLE AS $b$ SELECT * FROM carriers(h) $b$', coll, carrier);

  -- range(fiber, lo, hi): a RANGE element — rank bound to [lo,hi], value = the HEAD (the element at lo). unfold()
  -- streams it as located points (a point [r,r] unfolds to itself). Both take the fiber_unrank jump-per-rank fast
  -- path when present, else scan the floor and window to the range. This is the (rank_range, head) lazy range.
  IF has_fiber_unrank THEN
    EXECUTE format('CREATE FUNCTION range(f %I, lo rank_index, hi rank_index) RETURNS %I LANGUAGE sql STABLE AS $b$ '
                   'SELECT ROW(f, rank_index_range(lo, hi, ''[]''), fiber_unrank(f, lo))::%I $b$',
                   coll || '_fiber', coll || '_element', coll || '_element');
    EXECUTE format('CREATE FUNCTION unfold(e %I) RETURNS SETOF %I LANGUAGE sql STABLE AS $b$ '
                   'SELECT ROW((e).fiber, rank_point(r), fiber_unrank((e).fiber, r))::%I FROM generate_series(lower((e).rank)::bigint, upper((e).rank)::bigint) r $b$',
                   coll || '_element', coll || '_element', coll || '_element');
  ELSE
    EXECUTE format('CREATE FUNCTION range(f %I, lo rank_index, hi rank_index) RETURNS %I LANGUAGE sql STABLE AS $b$ '
                   'SELECT ROW(f, rank_index_range(lo, hi, ''[]''), (SELECT (el).value FROM elements(f, (lo + 1)::int) el ORDER BY el OFFSET lo LIMIT 1))::%I $b$',
                   coll || '_fiber', coll || '_element', coll || '_element');
    EXECUTE format('CREATE FUNCTION unfold(e %I) RETURNS SETOF %I LANGUAGE sql STABLE AS $b$ '
                   'SELECT el FROM elements((e).fiber, least(upper((e).rank) + 1, 2147483647)::int) el WHERE lower((el).rank) >= lower((e).rank) $b$',
                   coll || '_element', coll || '_element');
  END IF;

  -- next_in_fiber / prev_in_fiber: the adjacent element WITHIN the fiber. Dispatch cheapest-first: an explicit
  -- value→value successor / predecessor hook (works even on a rank-less element) → element_at(rank±1) when indexable →
  -- else scan (next only — a forward-only floor cannot cheaply reverse, so prev_in_fiber has no scan fallback). NULL
  -- at the fiber ends; the boundary-crossing next/prev below turn that NULL into the adjacent fiber''s edge element.
  IF to_regprocedure(format('successor(%I, %s)', coll || '_fiber', carrier)) IS NOT NULL THEN
    EXECUTE format('CREATE FUNCTION next_in_fiber(e %I) RETURNS %I LANGUAGE sql STABLE AS $b$ '
                   'SELECT ROW((e).fiber, CASE WHEN lower((e).rank) IS NULL THEN NULL ELSE rank_point(lower((e).rank) + 1) END, s)::%I '
                   'FROM (SELECT successor((e).fiber, (e).value) s) t WHERE s IS NOT NULL $b$',
                   coll || '_element', coll || '_element', coll || '_element');
  ELSIF to_regprocedure(format('fiber_unrank(%I, rank_index)', coll || '_fiber')) IS NOT NULL THEN
    EXECUTE format('CREATE FUNCTION next_in_fiber(e %I) RETURNS %I LANGUAGE sql STABLE AS $b$ SELECT element_at((e).fiber, lower((e).rank) + 1) $b$',
                   coll || '_element', coll || '_element');
  ELSE
    EXECUTE format('CREATE FUNCTION next_in_fiber(e %I) RETURNS %I LANGUAGE sql STABLE AS $b$ '
                   'SELECT el FROM elements((e).fiber, (lower((e).rank) + 2)::int) el ORDER BY el OFFSET lower((e).rank) + 1 LIMIT 1 $b$',
                   coll || '_element', coll || '_element');
  END IF;
  DECLARE has_pred bool := to_regprocedure(format('predecessor(%I, %s)', coll || '_fiber', carrier)) IS NOT NULL;
          has_unrank bool := to_regprocedure(format('fiber_unrank(%I, rank_index)', coll || '_fiber')) IS NOT NULL;
          el text := coll || '_element'; fb text := coll || '_fiber';
  BEGIN
    IF has_pred THEN
      EXECUTE format('CREATE FUNCTION prev_in_fiber(e %I) RETURNS %I LANGUAGE sql STABLE AS $b$ '
                     'SELECT ROW((e).fiber, CASE WHEN lower((e).rank) IS NULL THEN NULL ELSE rank_point(lower((e).rank) - 1) END, s)::%I '
                     'FROM (SELECT predecessor((e).fiber, (e).value) s) t WHERE s IS NOT NULL $b$', el, el, el);
    ELSIF has_unrank THEN
      EXECUTE format('CREATE FUNCTION prev_in_fiber(e %I) RETURNS %I LANGUAGE sql STABLE AS $b$ SELECT CASE WHEN lower((e).rank) > 0 THEN element_at((e).fiber, lower((e).rank) - 1) END $b$', el, el);
    END IF;

    -- GLOBAL next(element) — cross fiber boundaries. next_in_fiber first; at the fiber''s top edge, walk to the next
    -- fiber (grade odometer) and take ITS first element. Skips any empty fibers. Universal — every collection steps.
    EXECUTE format('CREATE FUNCTION next(e %1$I) RETURNS %1$I LANGUAGE plpgsql STABLE AS $b$ '
                   'DECLARE n %1$I; f %2$I; BEGIN '
                   'n := next_in_fiber(e); IF n IS NOT NULL THEN RETURN n; END IF; '
                   'f := next((e).fiber); '
                   'WHILE f IS NOT NULL LOOP n := (SELECT x FROM elements(f) x LIMIT 1); '
                   'IF n IS NOT NULL THEN RETURN n; END IF; f := next(f); END LOOP; '
                   'RETURN NULL; END $b$', el, fb);

    -- GLOBAL prev(element) — the mirror. Generated only when the fiber is reversible (predecessor OR indexable); at the
    -- fiber''s bottom edge, walk to the previous fiber and take ITS last element (cardinality-1 when indexed, else a scan).
    IF has_pred OR has_unrank THEN
      EXECUTE format('CREATE FUNCTION prev(e %1$I) RETURNS %1$I LANGUAGE plpgsql STABLE AS $b$ '
                     'DECLARE p %1$I; f %2$I; BEGIN '
                     'p := prev_in_fiber(e); IF p IS NOT NULL THEN RETURN p; END IF; '
                     'f := prev((e).fiber); '
                     'WHILE f IS NOT NULL LOOP %3$s '
                     'IF p IS NOT NULL THEN RETURN p; END IF; f := prev(f); END LOOP; '
                     'RETURN NULL; END $b$', el, fb,
                     CASE WHEN has_unrank
                       THEN 'p := element_at(f, (cardinality(f) - 1)::rank_index);'
                       ELSE 'p := (SELECT x FROM elements(f) x ORDER BY x DESC LIMIT 1);' END);
    END IF;
  END;

  -- monotonic-sequence contains: for a collection DECLARED non-decreasing (base_monotonic_sequence) that has fiber_unrank
  -- but no hand-written membership test, SYNTHESIZE contains_in_fiber by scanning the terms — fiber_unrank(0),(1),… —
  -- until one equals the value (∈) or passes it (∉, since a non-decreasing sequence never comes back down). This feeds
  -- the generated contains(handle) / <@ below like any hand-written predicate would.
  IF to_regprocedure(format('contains_in_fiber(%I, %s)', coll || '_fiber', carrier)) IS NULL
     AND coll NOT IN (SELECT collection FROM base_no_membership)
     AND EXISTS (SELECT 1 FROM base_monotonic_sequence WHERE collection = coll)
     AND to_regprocedure(format('fiber_unrank(%I, rank_index)', coll || '_fiber')) IS NOT NULL THEN
    EXECUTE format('CREATE FUNCTION contains_in_fiber(f %1$I, v %2$s) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $b$ '
                   'DECLARE r int := 0; t %2$s; BEGIN '
                   'IF v IS NULL THEN RETURN false; END IF; '
                   'LOOP t := fiber_unrank(f, r::rank_index); '
                   'IF t = v THEN RETURN true; END IF; IF t > v THEN RETURN false; END IF; '
                   'r := r + 1; END LOOP; END $b$', coll || '_fiber', carrier);
  END IF;

  -- bounded-membership contains: for a NON-monotonic sequence declared in base_bounded_membership (and lacking a
  -- hand-written test), SYNTHESIZE a semi-decidable contains_in_fiber — scan the first scan_terms terms; hit ⇒ true;
  -- miss ⇒ false only when v <= value_ceiling (fully covered by the scan), else NULL/unknown. Uses fiber_elements
  -- (universal), so it works whether or not the collection has a direct fiber_unrank.
  IF to_regprocedure(format('contains_in_fiber(%I, %s)', coll || '_fiber', carrier)) IS NULL
     AND coll NOT IN (SELECT collection FROM base_no_membership)
     AND EXISTS (SELECT 1 FROM base_bounded_membership WHERE collection = coll) THEN
    DECLARE bm base_bounded_membership%ROWTYPE;
    BEGIN
      SELECT * INTO bm FROM base_bounded_membership WHERE collection = coll;
      EXECUTE format('CREATE FUNCTION contains_in_fiber(f %1$I, v %2$s) RETURNS boolean LANGUAGE plpgsql STABLE AS $b$ '
                     'BEGIN '
                     'IF v IS NULL THEN RETURN false; END IF; '
                     'IF EXISTS (SELECT 1 FROM fiber_elements(f, %3$s) t WHERE t = v) THEN RETURN true; END IF; '
                     'IF v <= %4$L::numeric THEN RETURN false; END IF; '   -- fully covered ⇒ real absence
                     'RETURN NULL; END $b$',                               -- past the ceiling ⇒ unknown
                     coll || '_fiber', carrier, bm.scan_terms, bm.value_ceiling);
    END;
  END IF;

  -- contains(handle, value): generated iff the collection provides contains_in_fiber. In the handle iff some bound
  -- fiber contains it; member_of / <@ / @> wrap it. Bounded-membership collections get a THREE-VALUED existential
  -- (true if some fiber contains it, else NULL if any fiber is unknown, else false) so the semi-decidable NULL is
  -- not collapsed to false by EXISTS; every other collection keeps the plain boolean EXISTS form.
  IF to_regprocedure(format('contains_in_fiber(%I, %s)', coll || '_fiber', carrier)) IS NOT NULL THEN
    IF coll IN (SELECT collection FROM base_bounded_membership) THEN
      EXECUTE format('CREATE FUNCTION contains(h %I, v %s) RETURNS boolean LANGUAGE sql STABLE AS $b$ '
                     'SELECT CASE WHEN bool_or(c = true) THEN true '
                     '            WHEN count(*) FILTER (WHERE c IS NULL) > 0 THEN NULL '
                     '            ELSE false END '
                     'FROM (SELECT contains_in_fiber(f, v) c FROM fibers(h) f) t $b$', coll, carrier);
    ELSE
      EXECUTE format('CREATE FUNCTION contains(h %I, v %s) RETURNS boolean LANGUAGE sql STABLE AS $b$ '
                     'SELECT EXISTS (SELECT 1 FROM fibers(h) f WHERE contains_in_fiber(f, v)) $b$', coll, carrier);
    END IF;
  END IF;
  IF to_regprocedure(format('contains(%I, %s)', coll, carrier)) IS NOT NULL THEN
    EXECUTE format('CREATE FUNCTION member_of(v %s, h %I) RETURNS boolean LANGUAGE sql STABLE AS $b$ SELECT contains(h, v) $b$', carrier, coll);
    EXECUTE format('CREATE OPERATOR <@ (LEFTARG = %s, RIGHTARG = %I, FUNCTION = member_of)', carrier, coll);
    EXECUTE format('CREATE OPERATOR @> (LEFTARG = %I, RIGHTARG = %s, FUNCTION = contains)', coll, carrier);
  END IF;
END $realize$;

-- base_alias(coll, canonical): register `coll` as a TRUE ALIAS of an already-realized `canonical` collection (#101,
-- the #31 type-model spike) — the SAME math object, reachable under a second id, not a distinct sibling that merely
-- shares math with it (do NOT use this for order-iso siblings like k_subsets/binary_words_by_weight — pg composites
-- are nominal and their distinct order is the point; base_map's is_order_iso already covers that relationship).
--
-- Deliberately the mirror of base_restrict: it copies the canonical's carrier/unbounded/grade-chain into base_collection/
-- base_grade (so base_catalog can list + describe the alias) but SKIPS base_realize entirely — no <coll>_fiber /
-- <coll>_element types, no constructor, no generated surface. An alias borrows the canonical's whole tower rather than
-- minting a duplicate one; nothing downstream should ever construct `coll` at the SQL level. The explorer router
-- resolves an alias route to its canonical BEFORE the client touches the (nonexistent) realized surface (App.vue's
-- watch(coll)); a caller that somehow reaches the SQL layer directly with an alias id gets a plain "does not exist"
-- error from pg, same as any other unrealized name — there is no silent forwarding constructor to fall back on.
-- base_family_point (#67): the POINT relation — a collection is a point of a family, obtained by binding some of the
-- family's params/axes to constants. `bindings` is {axis_name: value}; a PARTIAL binding (fewer than all params) is a
-- sub-family. Distinct from base_collection.alias_of (a whole-collection synonym): a family point may own its own
-- realized tower (twin_primes) OR be a pure pointer (cube_free_numbers, no tower). resolveFrom reads it both ways
-- (prime_pairs(gap => 2) ⇄ twin_primes). Pack-attributed + guarded like base_map/base_stat so a pack may record a
-- point onto a core family.
CREATE TABLE base_family_point (
  collection text PRIMARY KEY REFERENCES base_collection,      -- the point (twin_primes, cube_free_numbers, binary_words)
  family     text NOT NULL REFERENCES base_collection,         -- the family handle (prime_pairs, k_free_integers, words)
  bindings   jsonb NOT NULL,                                   -- {"gap": 2}; a partial binding is a sub-family
  pack text NOT NULL DEFAULT coalesce(current_setting('enumeratio.pack', true), 'core') REFERENCES base_pack);
CREATE TRIGGER base_family_point_pack_guard BEFORE UPDATE OR DELETE ON base_family_point FOR EACH ROW EXECUTE FUNCTION base_guard_pack();

CREATE FUNCTION base_alias(coll text, canonical text) RETURNS void LANGUAGE plpgsql AS $a$
DECLARE c base_collection%ROWTYPE;
BEGIN
  SELECT * INTO c FROM base_collection WHERE id = canonical;
  IF c.id IS NULL THEN RAISE EXCEPTION 'base_alias: canonical collection % not found', canonical; END IF;
  IF c.alias_of IS NOT NULL THEN RAISE EXCEPTION 'base_alias: % is itself an alias of % — alias to the canonical directly, no chains', canonical, c.alias_of; END IF;
  INSERT INTO base_collection (id, carrier, unbounded, alias_of) VALUES (coll, c.carrier, c.unbounded, canonical);
  INSERT INTO base_grade SELECT coll, pos, name, lo_expr, hi_expr, role, admissible FROM base_grade WHERE collection = canonical;
END $a$;

-- base_alias(coll, family, bindings): a POINTER point — a synonym for `family` with `bindings` pinned, realizing NO
-- tower. The alias's grade chain = the family's chain MINUS the bound params. Records the base_family_point row too.
CREATE FUNCTION base_alias(coll text, family text, bindings jsonb) RETURNS void LANGUAGE plpgsql AS $a$
DECLARE c base_collection%ROWTYPE;
BEGIN
  SELECT * INTO c FROM base_collection WHERE id = family;
  IF c.id IS NULL THEN RAISE EXCEPTION 'base_alias: family collection % not found', family; END IF;
  IF c.alias_of IS NOT NULL THEN RAISE EXCEPTION 'base_alias: % is itself an alias of % — alias to the canonical directly, no chains', family, c.alias_of; END IF;
  INSERT INTO base_collection (id, carrier, unbounded, alias_of) VALUES (coll, c.carrier, c.unbounded, family);
  INSERT INTO base_grade SELECT coll, pos, name, lo_expr, hi_expr, role, admissible FROM base_grade
   WHERE collection = family AND NOT (bindings ? name);        -- drop the bound params from the point's visible chain
  INSERT INTO base_family_point (collection, family, bindings) VALUES (coll, family, bindings);
END $a$;

-- base_restrict(coll, parent, predicate[, scan_factor]): derive a new collection = the parent FILTERED by a
-- boolean predicate on the carrier. Same carrier + grade chain as the parent; the floor filters the parent's
-- floor (realizer re-ranks); contains = parent-contains AND predicate. The parent relationship is manifest (this
-- is a specialization). predicate is a function name <predicate>(<carrier>) RETURNS boolean.
-- scan_factor: for an UNBOUNDED parent (no fiber_count — an infinite floor like natural_numbers) the child cannot
-- scan the whole fiber, so it over-scans the parent's floor to element_limit*scan_factor and filters that window
-- (same "generous bound" the hand floors used; density must survive it). Ignored for bounded parents, which scan
-- the exact fiber_count.
-- count_fn / unrank_fn / sample_fn: OPTIONAL accel hooks (issue #89) for a restriction whose accelerated form genuinely
-- DIFFERS from filter-the-parent. Each names a function on the PARENT fiber — count_fn(<parent>_fiber) RETURNS numeric,
-- unrank_fn(<parent>_fiber, rank_index) RETURNS <carrier>. When present, base_restrict synthesizes the child's
-- fiber_count / fiber_unrank delegating to them, so base_realize wires the accelerated cardinality / element_at path
-- instead of counting the filtered floor. Absent ⇒ current behavior (inherit + filter). sample_fn is reserved (recorded,
-- unwired — uniform sampling already falls out of unrank_fn). Pass by name to skip scan_factor, e.g. count_fn => '…'.
--
-- params (#67, B2): a PARAMETER restriction — a whole FAMILY of restricts, one per binding of the params. The child's
-- fiber = the parent's fiber ⊕ one natural_number field per param (each a new role='param' grade position, appended
-- after the parent's chain). The predicate is PARAM-aware: <predicate>(<carrier>, <p1> natural_number[, <p2> …]) — one
-- extra arg per param, in order (NOT the child fiber type, which base_restrict mints internally, so the predicate can
-- be defined before the call). The floor scans the parent projection of the fiber (params dropped) and filters by
-- predicate(v, (f).p1, …); the density (hence scan_factor) may vary with the params. `admissibles` (parallel to
-- params) sets each param axis's base_grade.admissible. This is k_almost_primes' hand-authored big_omega(v) = (f).k
-- made a one-liner. Param + accel hooks (count_fn/unrank_fn) is not yet supported (the #89 accel is param-agnostic).
CREATE FUNCTION base_restrict(coll text, parent text, predicate text, scan_factor int DEFAULT 8,
                              count_fn text DEFAULT NULL, unrank_fn text DEFAULT NULL, sample_fn text DEFAULT NULL,
                              params text[] DEFAULT '{}', admissibles text[] DEFAULT '{}') RETURNS void LANGUAGE plpgsql AS $r$
DECLARE p base_collection%ROWTYPE; carrier text; window_expr text;
        child_fields text; parent_row text;
        parent_attnames text[]; parent_field_defs text; parent_proj text; parent_is_unit boolean;
        param_field_defs text; param_args text; i int; next_pos int;
BEGIN
  SELECT * INTO p FROM base_collection WHERE id = parent; carrier := p.carrier;
  INSERT INTO base_collection VALUES (coll, carrier, p.unbounded);
  INSERT INTO base_collection_parent VALUES (coll, parent, predicate, count_fn, unrank_fn, sample_fn);   -- the specialization edge + accel hooks, as data
  INSERT INTO base_grade SELECT coll, pos, name, lo_expr, hi_expr, role, admissible FROM base_grade WHERE collection = parent;

  IF array_length(params, 1) IS NULL THEN
    -- ── the unary case (unchanged): child fiber mirrors the parent's axes exactly ──────────────────────────────
    -- the child owns a typed fiber mirroring the parent's axes; its hooks dispatch on it and delegate to the parent's,
    -- filtered by the predicate (every collection owns a typed fiber, so the parent's typed hooks always exist).
    SELECT string_agg(format('%I %s', a.attname, format_type(a.atttypid, a.atttypmod)), ', ' ORDER BY a.attnum),
           string_agg(format('(f).%I', a.attname), ', ' ORDER BY a.attnum)
      INTO child_fields, parent_row
      FROM pg_type t JOIN pg_attribute a ON a.attrelid = t.typrelid
     WHERE t.typname = parent || '_fiber' AND a.attnum > 0 AND NOT a.attisdropped;
    EXECUTE format('CREATE TYPE %I AS (%s)', coll || '_fiber', child_fields);
    parent_row := format('ROW(%s)::%I', parent_row, parent || '_fiber');   -- rebuild the parent fiber from the child's
    window_expr := CASE WHEN to_regprocedure(format('fiber_count(%I)', parent || '_fiber')) IS NOT NULL
                        THEN format('coalesce((SELECT fiber_count(%s)), 2147483647)::int', parent_row)
                        WHEN p.unbounded THEN format('(element_limit * %s)', scan_factor)   -- infinite floor: over-scan
                        ELSE '2147483647' END;                                               -- bounded but uncounted: whole fiber
    -- The floor: scan the parent's fiber and filter. When the child supplies BOTH accel hooks, build it from the
    -- unrank instead (#299) — for a restriction the comparison is known and lopsided, because the alternative is
    -- scanning a STRICTLY LARGER parent to find a sparse subset. boolean_permutations(10) filters 10! = 3,628,800
    -- permutations down to F(11) = 89: 199s scanning, 14ms unranking.
    --
    -- This is deliberately NOT the general rule #299 asked for (prefer fiber_unrank wherever a collection has one).
    -- Unranking per row is O(N · cost(unrank)) and a recurrence unrank is O(ord), so a full window costs O(N²)
    -- where the sequential floor costs O(N); routing the whole catalog through unrank took the selfcert sweep from
    -- 4 stalled collections to 10, and 331s to 499s. A restriction is the case where the scan being replaced is
    -- known to be the expensive one.
    IF count_fn IS NOT NULL AND unrank_fn IS NOT NULL THEN
      EXECUTE format('CREATE FUNCTION fiber_elements(f %1$I, element_limit int) RETURNS SETOF %2$s LANGUAGE sql STABLE AS $b$ '
                     'SELECT %3$I(%5$s, i::rank_index) '
                     'FROM generate_series(0, least(%4$I(%5$s), element_limit::numeric)::bigint - 1) i $b$',
                     coll || '_fiber', carrier, unrank_fn, count_fn, parent_row);
    ELSE
      EXECUTE format('CREATE FUNCTION fiber_elements(f %I, element_limit int) RETURNS SETOF %s LANGUAGE sql STABLE AS $b$ '
                     'SELECT v FROM fiber_elements(%s, %s) v WHERE %I(v) LIMIT element_limit $b$',
                     coll || '_fiber', carrier, parent_row, window_expr, predicate);
    END IF;
    IF to_regprocedure(format('contains_in_fiber(%I, %s)', parent || '_fiber', carrier)) IS NOT NULL THEN
      EXECUTE format('CREATE FUNCTION contains_in_fiber(f %I, v %s) RETURNS boolean LANGUAGE sql STABLE AS $b$ '
                     'SELECT contains_in_fiber(%s, v) AND %I(v) $b$', coll || '_fiber', carrier, parent_row, predicate);
    END IF;
    -- optional accel hooks (#89): synthesize the child's fiber_count / fiber_unrank from the supplied PARENT-fiber funcs
    -- BEFORE base_realize, so its accelerated cardinality / element_at path is wired instead of the filter-the-floor scan.
    IF count_fn IS NOT NULL THEN
      EXECUTE format('CREATE FUNCTION fiber_count(f %I) RETURNS numeric LANGUAGE sql STABLE AS $b$ SELECT %I(%s) $b$',
                     coll || '_fiber', count_fn, parent_row);
    END IF;
    IF unrank_fn IS NOT NULL THEN
      EXECUTE format('CREATE FUNCTION fiber_unrank(f %I, ord rank_index) RETURNS %s LANGUAGE sql STABLE AS $b$ SELECT %I(%s, ord) $b$',
                     coll || '_fiber', carrier, unrank_fn, parent_row);
    END IF;
  ELSE
    -- ── the PARAMETER case (#67 B2): child fiber = parent fiber ⊕ the params; predicate is (carrier, child_fiber) ──
    IF count_fn IS NOT NULL OR unrank_fn IS NOT NULL THEN
      RAISE EXCEPTION 'base_restrict: params + accel hooks (count_fn/unrank_fn) not supported — a param-restrict uses the scan path';
    END IF;
    SELECT array_agg(a.attname ORDER BY a.attnum),
           string_agg(format('%I %s', a.attname, format_type(a.atttypid, a.atttypmod)), ', ' ORDER BY a.attnum),
           string_agg(format('(f).%I', a.attname), ', ' ORDER BY a.attnum)
      INTO parent_attnames, parent_field_defs, parent_proj
      FROM pg_type t JOIN pg_attribute a ON a.attrelid = t.typrelid
     WHERE t.typname = parent || '_fiber' AND a.attnum > 0 AND NOT a.attisdropped;
    parent_is_unit := (parent_attnames = ARRAY['unit']);   -- ungraded parent: (unit unit) — drop it from the child fiber
    param_field_defs := (SELECT string_agg(format('%I natural_number', prm), ', ') FROM unnest(params) prm);
    param_args := (SELECT string_agg(format('(f).%I', prm), ', ') FROM unnest(params) prm);   -- how the predicate reads each param
    IF parent_is_unit THEN
      child_fields := param_field_defs;                                     -- child fiber = params only
      parent_row := format('ROW(true)::%I', parent || '_fiber');           -- the parent's singleton unit fiber
    ELSE
      child_fields := parent_field_defs || ', ' || param_field_defs;        -- parent axes ⊕ params
      parent_row := format('ROW(%s)::%I', parent_proj, parent || '_fiber'); -- parent fiber projected out of the child's
    END IF;
    EXECUTE format('CREATE TYPE %I AS (%s)', coll || '_fiber', child_fields);
    -- append the params as role='param' grade positions (base_realize builds the handle arg per position, by fiber name)
    SELECT coalesce(max(pos), 0) INTO next_pos FROM base_grade WHERE collection = coll;
    FOR i IN 1 .. array_length(params, 1) LOOP
      INSERT INTO base_grade (collection, pos, name, lo_expr, hi_expr, role, admissible)
      VALUES (coll, next_pos + i, params[i], NULL, NULL, 'param',
              CASE WHEN array_length(admissibles, 1) >= i THEN admissibles[i] ELSE NULL END);
    END LOOP;
    window_expr := CASE WHEN to_regprocedure(format('fiber_count(%I)', parent || '_fiber')) IS NOT NULL
                        THEN format('coalesce((SELECT fiber_count(%s)), 2147483647)::int', parent_row)
                        WHEN p.unbounded THEN format('(element_limit * %s)', scan_factor)   -- infinite floor: over-scan
                        ELSE '2147483647' END;
    EXECUTE format('CREATE FUNCTION fiber_elements(f %I, element_limit int) RETURNS SETOF %s LANGUAGE sql STABLE AS $b$ '
                   'SELECT v FROM fiber_elements(%s, %s) v WHERE %I(v, %s) LIMIT element_limit $b$',
                   coll || '_fiber', carrier, parent_row, window_expr, predicate, param_args);
    IF to_regprocedure(format('contains_in_fiber(%I, %s)', parent || '_fiber', carrier)) IS NOT NULL THEN
      EXECUTE format('CREATE FUNCTION contains_in_fiber(f %I, v %s) RETURNS boolean LANGUAGE sql STABLE AS $b$ '
                     'SELECT contains_in_fiber(%s, v) AND %I(v, %s) $b$', coll || '_fiber', carrier, parent_row, predicate, param_args);
    END IF;
  END IF;
  PERFORM base_realize(coll);
END $r$;

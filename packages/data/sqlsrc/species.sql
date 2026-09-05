-- requires: permutations, set_partitions, realizer
-- (the cyclic_permutations examples moved to packs/permutations-plus/species.permutations-plus.sql — #283
-- phase 3 — since cyclic_permutations INHERITS the permutation-carrier reprs registered here via base_repr_resolved,
-- no explicit row is needed, but the examples that call cyclic_permutations() directly must load after it)
-- SPECIES NOTATION — an element read as an algebraic expression in the ATOMIC species, with its actual labels
-- (the element-level companion to the EGF species algebra: permutations = E∘C, set partitions = E∘E₊, …).
--
-- The convention (established here, reused by every species repr):
--   • an atom on a label set is  Sym[{a,b,c}]  — the Sym-structure on labels {a,b,c}; Sym ∈ {X,E,E+,C,L}
--       X = singleton, E = set, E+ = nonempty set, C = cycle, L = linear order
--   • product (·)          = juxtaposition:  X[{2}]X[{3}]X[{1}]
--   • composition (∘)      = nesting the inner atoms as the label "elements" of the outer:  E[{E+[{1,3}],E+[{2}]}]
--   • the empty structure  = the empty product '1'  (composition forms render their own empty, e.g. E[{}])
-- ASCII throughout (matching representations.sql); a KaTeX spelling is a later medium/alphabet phase.
--
-- MODELLING (the new-collection-vs-repr question this batch raises): a species reading is a rendering of a carrier
-- value, so when the reading is valid for EVERY value of the carrier it is a plain base_repr — carrier-keyed, and
-- inherited by every collection over that carrier (base_repr_resolved). The three readings below are all
-- carrier-wide:  L = X·X·…  is any one-line word;  E∘C = ∏ C[cycle]  is any permutation's cycle decomposition;
-- E∘E₊  is any set partition. So permutation_species / cyclic_permutation_species / set_partition_species are
-- reprs, NOT new collections — cyclic_permutations simply INHERITS the E∘C repr, where a single cycle collapses to
-- the lone atom C[{…}]. Only the atomic species X has no underlying combinatorial carrier and a different
-- enumeration (one structure, at n=1 only), so singleton_species is a genuine collection with its own carrier.

-- ── L = X·X·… : a permutation as a linear order, its one-line word as a product of singletons ────────────────
CREATE FUNCTION permutation_species_notation(p permutation) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(string_agg('X[{' || v || '}]', '' ORDER BY o), '1')
  FROM unnest((p).image) WITH ORDINALITY AS t(v, o) $$;

-- ── E∘C = ∏ C[cycle] : a permutation as its set of cycles, each written from its least element ───────────────
CREATE FUNCTION permutation_cycle_species_notation(p permutation) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE n int := coalesce(array_length((p).image,1),0); seen boolean[] := array_fill(false, ARRAY[greatest(n,1)]);
          out text := ''; i int; j int; cyc text;
  BEGIN
    FOR i IN 1..n LOOP                                        -- i is the least unseen label ⇒ each cycle starts there
      IF NOT seen[i] THEN
        j := i; cyc := '';
        LOOP
          seen[j] := true;
          cyc := cyc || CASE WHEN cyc = '' THEN '' ELSE ',' END || j::text;
          j := (p).image[j];
          EXIT WHEN j = i;
        END LOOP;
        out := out || 'C[{' || cyc || '}]';
      END IF;
    END LOOP;
    RETURN CASE WHEN n = 0 THEN '1' ELSE out END;
  END $$;

-- ── E∘E₊ : a set partition as the set-structure on the set of its nonempty blocks ────────────────────────────
CREATE FUNCTION set_partition_species_notation(p set_partition) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT 'E[{' || coalesce(string_agg(blk, ',' ORDER BY g), '') || '}]'
  FROM (
    SELECT (p).rgs[i] AS g, 'E+[{' || string_agg(i::text, ',' ORDER BY i) || '}]' AS blk   -- blocks in first-appearance order
    FROM generate_subscripts((p).rgs, 1) i GROUP BY (p).rgs[i]) s $$;

-- ── X : the atomic singleton species — one structure, only at n = 1 (its own carrier + enumeration) ──────────
CREATE TYPE singleton AS (point int);                        -- the sole labelled point (always 1 at n=1)
CREATE FUNCTION notation(s singleton) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'X[{' || (s).point || '}]' $$;

CREATE TYPE singleton_species_fiber AS (n natural_number);   -- typed fiber; axis: n
CREATE FUNCTION fiber_elements(f singleton_species_fiber, element_limit int) RETURNS SETOF singleton LANGUAGE sql STABLE AS $$
  SELECT ROW(1)::singleton WHERE (f).n = 1 LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f singleton_species_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT (CASE WHEN (f).n = 1 THEN 1 ELSE 0 END)::numeric $$;
CREATE FUNCTION contains_in_fiber(f singleton_species_fiber, v singleton) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT (f).n = 1 AND (v).point = 1 $$;

INSERT INTO base_collection VALUES ('singleton_species', 'singleton');
INSERT INTO base_grade VALUES ('singleton_species', 1, 'n', NULL, NULL);
SELECT base_realize('singleton_species');

-- ── register the reprs (species readings are carrier-keyed ⇒ inherited by every collection over the carrier) ──
INSERT INTO base_repr (collection, repr, render_fn, title, canonical) VALUES
  ('permutations','species','permutation_species_notation','Species notation (linear order, L = X·X·…)',false),
  ('permutations','cycle_species','permutation_cycle_species_notation','Species notation (set of cycles, E∘C)',false),
  ('set_partitions','species','set_partition_species_notation','Species notation (E∘E₊)',false),
  ('singleton_species','species','notation','Species notation (atomic X)',true);

-- ── examples ─────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('species','permutation as L: 231 → X[{2}]X[{3}]X[{1}], identity 123 → X[{1}]X[{2}]X[{3}]','eq','X[{2}]X[{3}]X[{1}]|X[{1}]X[{2}]X[{3}]','one-line word as a product of singletons',$q$
    SELECT permutation_species_notation(ROW(ARRAY[2,3,1])::permutation) || '|' ||
           permutation_species_notation(ROW(ARRAY[1,2,3])::permutation) $q$),
  ('species','empty permutation → the empty product 1','eq','1','no factors',$q$
    SELECT permutation_species_notation(ROW(ARRAY[]::int[])::permutation) $q$),
  ('species','permutation as E∘C: single cycle 2341 → C[{1,2,3,4}], 2143 → C[{1,2}]C[{3,4}]','eq','C[{1,2,3,4}]|C[{1,2}]C[{3,4}]','cycle decomposition, each from its least element',$q$
    SELECT permutation_cycle_species_notation(ROW(ARRAY[2,3,4,1])::permutation) || '|' ||
           permutation_cycle_species_notation(ROW(ARRAY[2,1,4,3])::permutation) $q$),
  ('species','E∘C: identity 123 → C[{1}]C[{2}]C[{3}] (three fixed-point 1-cycles)','eq','C[{1}]C[{2}]C[{3}]','fixed points are singleton cycles',$q$
    SELECT permutation_cycle_species_notation(ROW(ARRAY[1,2,3])::permutation) $q$),
  ('species','set partition as E∘E₊: {0,1,0} → E[{E+[{1,3}],E+[{2}]}], all-together {0,0,0} → E[{E+[{1,2,3}]}]','eq','E[{E+[{1,3}],E+[{2}]}]|E[{E+[{1,2,3}]}]','set of nonempty blocks, first-appearance order',$q$
    SELECT set_partition_species_notation(ROW(ARRAY[0,1,0])::set_partition) || '|' ||
           set_partition_species_notation(ROW(ARRAY[0,0,0])::set_partition) $q$),
  ('species','empty set partition (n=0) → E[{}]','eq','E[{}]','the set-structure on the empty set of blocks',$q$
    SELECT set_partition_species_notation(ROW(ARRAY[]::int[])::set_partition) $q$),
  ('species','singleton_species X: cardinality is 1 at n=1, 0 elsewhere (n=0..3)','eq','0,1,0,0','the atomic species exists only on a 1-element label set',$q$
    SELECT string_agg(cardinality(singleton_species(n))::text, ',' ORDER BY n) FROM generate_series(0,3) n $q$),
  ('species','singleton_species(1) has one element rendering X[{1}]','eq','X[{1}]','the canonical species render of the atom',$q$
    SELECT render(unrank(singleton_species(1), 0)) $q$),
  ('species','singleton_species(2) is empty (unrank out of range → NULL)','eq','','no X-structure on a 2-element set',$q$
    SELECT coalesce(render(unrank(singleton_species(2), 0)), '') $q$),
  ('species','contains: the atom {1} ∈ singleton_species(1), ∉ singleton_species(2)','eq','true|false','membership follows the enumeration',$q$
    SELECT contains(singleton_species(1), ROW(1)::singleton)::text || '|' ||
           contains(singleton_species(2), ROW(1)::singleton)::text $q$);

-- per-collection living example (suite = the collection id, so its collection is tagged) ──────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('singleton_species','the atomic species X: cardinality 1 at n=1, 0 elsewhere (n=0..3); atom {1} ∈ at n=1','eq','0,1,0,0|true','one structure, on a 1-element label set only',$q$
    SELECT (SELECT string_agg(cardinality(singleton_species(n))::text, ',' ORDER BY n) FROM generate_series(0,3) n) || '|' ||
           contains(singleton_species(1), ROW(1)::singleton)::text $q$);

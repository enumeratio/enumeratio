-- requires: permutations, integer_partitions, integer_compositions, dyck_paths, set_partitions, perfect_matchings, subsets, k_subsets, integer_factorizations, binary_words, finsets, signed_permutations, signed_subsets, set_compositions, surjections, parking_functions, seed.render_corpus
-- representations — Phase 3 of the catalog port: named alternate renderings, registered in base_repr so the
-- client's -R flag can pick one (permutation cycle notation, set-partition blocks, Dyck parens). render_fn takes
-- the CARRIER; the client calls render_fn((element).value). The `canonical` repr matches the default render()
-- codec. (This is the C-ext repr+format axis, flattened.) A repr can carry medium siblings (base_repr.medium,
-- default 'unicode') — same (collection, repr), a render_fn spelled for a different line-space target; the
-- `oneline` katex sibling below is the first one (#138), joined by `parts` (integer_compositions), `blocks`
-- (set_partitions), and the `members` repr (finsets, carrier-inherited to subsets/k_subsets) (#141). The
-- alphabet axis stays schema-only for now.
-- NOT given a sibling: integer_partitions `parts` ("3+2+1"), dyck_paths `parens` ("(())()"), and permutations
-- `cycle` ("(1 2 3)") — digits/+/parens need no escaping in KaTeX or asciimath, so their unicode spelling is
-- already valid math-media text and the base_repr fallback (unicode when a medium sibling is absent) renders
-- them correctly as-is; a sibling row with an identical string would add a row without changing any output
-- (same reasoning as the coinciding fiber_symbol spellings noted below). set_notation_katex/asciimath (the
-- "<element> ∈ <symbol>" membership rendering) is likewise NOT added: wire_set_notation generates it per
-- <coll>_element via render_value ⊕ fiber_symbol, not as a render_fn(<carrier>) — outside base_repr's contract,
-- same carve-out #138 already made for fiber_symbol_katex/_asciimath.
-- #141 (coverage expansion) adds FIVE more collections, each getting a fresh canonical unicode `base_repr` row
-- (none had one before — their default rendering ran through render()/notation() directly) plus its katex
-- sibling: signed_permutations `oneline` (bars negatives \overline{k}, tuple-parenthesized — the standard
-- hyperoctahedral-group bar notation), signed_subsets `members` (escapes braces + bars negatives, carrier-
-- inherited to cross_polytope), set_compositions `blocks` (escapes braces, keeps block ORDER as a parenthesized
-- tuple — unlike set_partitions' unordered outer braces — carrier-inherited to permutahedron), and the plain
-- parenthesized-tuple move (same as `parts`/`oneline` above) for surjections `tuple` (carrier-inherited to
-- surjections_onto_k) and parking_functions `tuple` (carrier-inherited to non_decreasing_parking_functions). All
-- five asciimath spellings coincide with the existing unicode default (bare braces/commas/minus signs already
-- render correctly there — confirmed against the render-corpus oracle), so none get an `ascii` sibling — same
-- "nothing to translate" reasoning as `parts`/`blocks`/`members` above. Considered and SKIPPED as not confident/
-- standard enough: k_colored_permutations (the corpus's color-exponent word notation is a different convention
-- from our own image:colors separator notation, not a mechanical escape); dissection (the corpus has no real
-- element-level katex oracle for it, just the ambient symbol repeated); prufer_sequences' `sequence` repr (⟨…⟩
-- angle brackets already parse as plain unicode text in KaTeX — nothing to escape, so a macro sibling would be
-- decorative, not corrective).

-- ── new alternate renderings ────────────────────────────────────────────────────────────────────────────
-- permutation cycle notation: decompose the one-line image into disjoint cycles, e.g. {2,3,1} → "(1 2 3)".
CREATE FUNCTION perm_cycles(p permutation) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE n int := coalesce(array_length((p).image,1),0); seen boolean[] := array_fill(false, ARRAY[greatest(n,1)]);
          out text := ''; i int; j int; cyc text;
  BEGIN
    FOR i IN 1..n LOOP
      IF NOT seen[i] THEN
        j := i; cyc := '';
        LOOP
          seen[j] := true;
          cyc := cyc || CASE WHEN cyc = '' THEN '' ELSE ' ' END || j::text;
          j := (p).image[j];
          EXIT WHEN j = i;
        END LOOP;
        out := out || '(' || cyc || ')';
      END IF;
    END LOOP;
    RETURN out;
  END $$;

-- Dyck path as balanced parentheses: +1 → '(', -1 → ')'.
CREATE FUNCTION dyck_parens(d dyck_path) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(string_agg(CASE WHEN s = 1 THEN '(' ELSE ')' END, '' ORDER BY o), '')
  FROM unnest((d).steps) WITH ORDINALITY AS t(s, o) $$;

-- integer partition in exponential / multiplicity form: each distinct part with its multiplicity as an exponent
-- (multiplicity 1 omitted), largest first — 3+2+2+1 → "3 2^2 1". Inherited by every integer_partition collection.
CREATE FUNCTION integer_partition_frequency(p integer_partition) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(string_agg(CASE WHEN m = 1 THEN part::text ELSE part || '^' || m END, ' ' ORDER BY part DESC), '0')
  FROM (SELECT x AS part, count(*)::int AS m FROM unnest((p).parts) x GROUP BY x) g $$;

-- perfect matching as arcs: the pairs [a1,b1,a2,b2,…] read as (a1,b1)(a2,b2)…. Inherited by non_crossing_matchings.
CREATE FUNCTION perfect_matching_arcs(m perfect_matching) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(string_agg('(' || (m).pairs[2*i-1] || ',' || (m).pairs[2*i] || ')', '' ORDER BY i), '')
  FROM generate_series(1, coalesce(array_length((m).pairs,1),0)/2) i $$;

-- ── rich-text (pure-unicode) renderings, one per carrier — the line-space cast of a glyph, no SVG ─────────
-- These are CARRIER renderings (they inherit to every collection over the carrier), the text-space siblings of
-- base_glyph's page-space figures. Registered carrier-scoped below.

-- binary word as a filled/empty dot indicator, MSB first: 1 → ●, 0 → ○, e.g. {1,0,1} → "●○●". (Nonzero counts as
-- set, so the ternary binary_word variants still read cleanly.) Empty word → ε.
CREATE FUNCTION binary_word_dots(w binary_word) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(string_agg(CASE WHEN b = 0 THEN '○' ELSE '●' END, '' ORDER BY o), 'ε')
  FROM unnest((w).bits) WITH ORDINALITY t(b, o) $$;

-- finite set as a membership indicator over its ground [n] (or, for the ℕ-ground finset, up to its largest member):
-- position i is ● if i ∈ S else ○, e.g. ({1,3},4) → "●○●○". The empty set (no ground, no members) → ∅.
CREATE FUNCTION finset_dots(s finset) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(string_agg(CASE WHEN i = ANY((s).members) THEN '●' ELSE '○' END, '' ORDER BY i), '∅')
  FROM generate_series(1, coalesce((s).n, (SELECT max(m) FROM unnest((s).members) m), 0)) i $$;

-- composition as stars-and-bars — the gap-cut bijection made visible (composition_from_mask, integer_compositions.sql):
-- each part is a run of ● cells, the cut gaps are │ bars, e.g. {2,1,3} → "●●│●│●●●". Empty composition → ε.
CREATE FUNCTION composition_bars(c composition) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(string_agg(repeat('●', p), '│' ORDER BY o), 'ε')
  FROM unnest((c).parts) WITH ORDINALITY t(p, o) $$;

-- integer partition as a box-art Ferrers diagram: one row of ■ cells per part, largest on top (parts are descending),
-- rows newline-separated, e.g. {3,1} → "■■■⏎■". The empty partition → ∅.
CREATE FUNCTION integer_partition_ferrers(p integer_partition) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(string_agg(repeat('■', part), E'\n' ORDER BY o), '∅')
  FROM unnest((p).parts) WITH ORDINALITY t(part, o) $$;

-- ── permutation input grammars (parse_fn: text → the permutation carrier) ───────────────────────────────
-- The inverse of the two permutation reprs. A grammar is a property of the REPRESENTATION, and both forms address the
-- same permutation element, so they are interchangeable inputs: perm_from_oneline('3 4 1 2') and
-- perm_from_cycles('(1 3)(2 4)') build the identical permutation. (Second concrete input grammar; the arithmetic
-- evaluator — buildExprSql in @enumeratio/client — is the first. See the roadmap note in maps-and-bijections.)

-- one-line form: the image sequence. Accepts separated ('3 4 1 2', '3,4,1,2', '[3, 4, 1, 2]') and, for n ≤ 9, the
-- bare concatenated digits ('3412') that one_line()/notation() renders for n ≤ 9 — so parse∘render round-trips the
-- canonical form. Past n = 9 bare digits are ambiguous (#70: '12 3' vs '1 23' both read '123'), so one_line()/notation()
-- switches to the space-separated form there instead — already handled by the separated-tokens branch below, so
-- parse∘render stays round-trippable past n = 9 too, just via the separated grammar rather than bare digits.
CREATE FUNCTION perm_from_oneline(s text) RETURNS permutation LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE body text := btrim(regexp_replace(s, '[\[\]]', '', 'g')); img int[];
  BEGIN
    IF btrim(body) = '' THEN RETURN ROW('{}'::int[])::permutation; END IF;
    IF body ~ '[\s,]' THEN                                        -- separated tokens
      img := ARRAY(SELECT t::int FROM regexp_split_to_table(btrim(body), '[\s,]+') t WHERE t <> '');
    ELSIF body ~ '^[0-9]+$' THEN                                  -- concatenated single digits
      img := ARRAY(SELECT d::int FROM regexp_split_to_table(body, '') d);
    ELSE
      RAISE EXCEPTION 'not a one-line permutation: %', s;
    END IF;
    RETURN ROW(img)::permutation;
  END $$;

-- cycle notation: disjoint cycles, e.g. '(1 3)(2 4)', '(1 2 3)', '(1)(2)(3)'. n = the largest point named; points not
-- named are fixed (standard convention, and perm_cycles lists every point so its output round-trips). '' or '()' = the
-- empty permutation. The inverse of perm_cycles.
CREATE FUNCTION perm_from_cycles(s text) RETURNS permutation LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE grp text; pts int[]; img int[]; n int := 0; i int;
  BEGIN
    IF s !~ '[0-9]' THEN RETURN ROW('{}'::int[])::permutation; END IF;
    FOR grp IN SELECT (regexp_matches(s, '\(([^)]*)\)', 'g'))[1] LOOP     -- each parenthesized group
      n := greatest(n, (SELECT max(t::int) FROM regexp_split_to_table(btrim(grp), '[\s,]+') t WHERE t <> ''));
    END LOOP;
    IF s !~ '\(' THEN RAISE EXCEPTION 'not cycle notation: %', s; END IF;
    img := ARRAY(SELECT generate_series(1, n));                          -- start from the identity
    FOR grp IN SELECT (regexp_matches(s, '\(([^)]*)\)', 'g'))[1] LOOP
      pts := ARRAY(SELECT t::int FROM regexp_split_to_table(btrim(grp), '[\s,]+') t WHERE t <> '');
      FOR i IN 1 .. coalesce(array_length(pts,1),0) LOOP
        img[pts[i]] := pts[CASE WHEN i = array_length(pts,1) THEN 1 ELSE i+1 END];   -- p(pts[i]) = next, wrapping
      END LOOP;
    END LOOP;
    RETURN ROW(img)::permutation;
  END $$;

-- dense base-36 one-line notation (#193): one character per position via the base-36 alphabet '0'..'9','a'..'z',
-- indexed directly by VALUE (so value 10 → 'a', matching #70's own n>9 threshold) — a compact ALTERNATE to the
-- canonical one_line(), which switches to space-separated at n>9. Values 1..35 index the alphabet directly (leaving
-- '0' unused); the one value that can't — n=36's max element, value 36 — wraps mod 36 onto the leftover '0', so every
-- S_n up to n=36 still gets one char per position. Past n=36 a value needs 2+ base-36 digits, so it falls back to the
-- same space-separated form as one_line().
CREATE FUNCTION perm_oneline_dense(p permutation) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN coalesce(array_length((p).image, 1), 0) > 36 THEN one_line(p)
    ELSE (SELECT string_agg(substr('0123456789abcdefghijklmnopqrstuvwxyz', (v % 36) + 1, 1), '' ORDER BY o)
          FROM unnest((p).image) WITH ORDINALITY t(v, o)) END $$;

-- the inverse of perm_oneline_dense: one base-36 digit per position, '0' read back as the mod-36 wrap (value 36).
-- A space/comma anywhere means the >36 fallback form was used, so hand off to the standard one-line grammar.
CREATE FUNCTION perm_from_oneline_dense(s text) RETURNS permutation LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE body text := btrim(s); img int[] := '{}'; c text; v int; i int;
  BEGIN
    IF body = '' THEN RETURN ROW('{}'::int[])::permutation; END IF;
    IF body ~ '[\s,]' THEN RETURN perm_from_oneline(body); END IF;
    FOR i IN 1..length(body) LOOP
      c := lower(substr(body, i, 1));
      v := strpos('0123456789abcdefghijklmnopqrstuvwxyz', c) - 1;         -- 0-based alphabet index
      IF v < 0 THEN RAISE EXCEPTION 'not a dense base-36 one-line permutation: %', s; END IF;
      IF v = 0 THEN v := 36; END IF;                                      -- '0' is the mod-36 wrap for value 36
      img := img || v;
    END LOOP;
    RETURN ROW(img)::permutation;
  END $$;

-- katex spelling of the `oneline` repr: a parenthesized comma tuple, e.g. {1,2,3,4} → "(1,2,3,4)" — the render-corpus
-- oracle's katex form (seed.render_corpus.sql), distinct from the unicode one_line() (dense digits n≤9, else spaced).
-- Registered below as the `oneline` repr's medium='latex' SIBLING row (same repr, same parse_fn — parsing is
-- medium-independent) — the first concrete medium dispatch through base_repr (#138).
CREATE FUNCTION perm_oneline_katex(p permutation) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT '(' || array_to_string((p).image, ',') || ')' $$;

-- katex spelling of the `parts` repr (integer_compositions): the same parenthesized comma tuple move as oneline
-- above, e.g. {1,1,4} → "(1,1,4)" — the render-corpus oracle's katex form, distinct from the unicode notation()
-- ("1+1+4"). asciimath coincides with unicode here (both "1 + 1 + 4" in the corpus) — no asciimath sibling needed.
CREATE FUNCTION composition_parts_katex(c composition) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT '(' || array_to_string((c).parts, ',') || ')' $$;

-- katex spelling of the `blocks` repr (set_partitions): braces need escaping in KaTeX (bare {}  are LaTeX grouping,
-- not literal), so this re-groups the same blocks with \{...\} delimiters — e.g. rgs 0,1,0,2 → "\{\{1,3\},\{2\},\{4\}\}",
-- matching the render-corpus oracle. asciimath renders bare braces literally (confirmed by the corpus's own subset
-- rows), so the unicode set_partition_blocks string (slash-separated, single braces) is already valid asciimath —
-- no asciimath sibling needed either.
CREATE FUNCTION set_partition_blocks_katex(p set_partition) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT '\{' || coalesce(string_agg('\{' || blk || '\}', ',' ORDER BY g), '') || '\}' FROM (
    SELECT (p).rgs[i] AS g, string_agg(i::text, ',' ORDER BY i) AS blk
    FROM generate_subscripts((p).rgs, 1) i GROUP BY (p).rgs[i]) s $$;

-- ── the finset `members` repr (subsets/k_subsets/finsets): set-brace notation ───────────────────────────
-- notation(finset) is ground-dispatched: braces {1,3} for the ℕ-ground (finsets), a length-n bit REGISTER for a
-- finite ground (subsets/k_subsets) — so subsets/k_subsets have no brace form to translate to KaTeX by default.
-- `members` gives every finset-carrier collection the brace reading regardless of ground (matching the
-- render-corpus oracle's element spelling for `subsets`), and its katex sibling escapes the braces. Registered
-- carrier-scoped on `finsets` (the pattern `dots` below uses) so it inherits to subsets/k_subsets too. asciimath
-- coincides with the unicode braces (confirmed by the corpus) — no asciimath sibling needed.
CREATE FUNCTION finset_members(s finset) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT '{' || array_to_string((s).members, ',') || '}' $$;
CREATE FUNCTION finset_members_katex(s finset) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT '\{' || array_to_string((s).members, ',') || '\}' $$;

-- ── #141 coverage expansion: five more collections, each getting a fresh canonical unicode row + katex sibling ──

-- katex spelling of the signed_permutation default one-line window: bar each negative entry (\overline{k}, the
-- standard hyperoctahedral-group convention — Björner–Brenti's bar notation for B_n) and wrap the whole window as
-- a parenthesized tuple, e.g. {-2,1,-3} → "(\overline{2},1,\overline{3})" — matches the render-corpus oracle.
-- asciimath coincides with the unicode default (bare "-2,1,-3") — no asciimath sibling needed.
CREATE FUNCTION signed_permutation_katex(x signed_permutation) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT '(' || coalesce(string_agg(CASE WHEN v < 0 THEN '\overline{' || (-v) || '}' ELSE v::text END, ',' ORDER BY o), '') || ')'
  FROM unnest((x).image) WITH ORDINALITY t(v, o) $$;

-- katex spelling of the signed_subset default `{…}` notation: escape the braces (same move as finset_members_katex)
-- and bar each negative entry, e.g. {1,-2,3} → "\{1,\overline{2},3\}" — matches the render-corpus oracle
-- (signed_subsets and its cross_polytope carrier sibling). asciimath coincides with the unicode default (bare
-- braces + minus sign) — no asciimath sibling needed.
CREATE FUNCTION signed_subset_members_katex(s signed_subset) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT '\{' || coalesce(string_agg(CASE WHEN v < 0 THEN '\overline{' || (-v) || '}' ELSE v::text END, ',' ORDER BY o), '') || '\}'
  FROM unnest((s).coords) WITH ORDINALITY t(v, o) $$;

-- katex spelling of the set_composition default `blk|blk|…` notation: re-groups the same blocks, escaping braces
-- (same move as set_partition_blocks_katex above) but keeping block ORDER as a parenthesized tuple rather than an
-- unordered outer brace set — set compositions are ORDERED set partitions, so the sequence of blocks matters, e.g.
-- labels {1,1,2,2} (block1={1,2}, block2={3,4}) → "(\{1,2\},\{3,4\})" — matches the render-corpus oracle. asciimath
-- coincides with the unicode pipe-separated form (bare braces need no escaping there) — no asciimath sibling needed.
CREATE FUNCTION set_composition_blocks_katex(c set_composition) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT '(' || coalesce(string_agg('\{' || blk || '\}', ',' ORDER BY lbl), '') || ')' FROM (
    SELECT (c).labels[i] AS lbl, string_agg(i::text, ',' ORDER BY i) AS blk
    FROM generate_subscripts((c).labels, 1) i GROUP BY (c).labels[i]) s $$;

-- katex spelling of the surjection default comma-word notation: the same parenthesized-tuple move as
-- perm_oneline_katex/composition_parts_katex above, e.g. "1,2,3" → "(1,2,3)" — matches the render-corpus oracle.
-- asciimath coincides with the unicode default (bare comma word) — no asciimath sibling needed.
CREATE FUNCTION surjection_tuple_katex(w surjection) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT '(' || array_to_string((w).values, ',') || ')' $$;

-- katex spelling of the parking_function default comma-sequence notation: same parenthesized-tuple move as
-- surjection_tuple_katex above, e.g. "1,1,1" → "(1,1,1)" — matches the render-corpus oracle. asciimath coincides
-- with the unicode default (bare comma sequence) — no asciimath sibling needed.
CREATE FUNCTION parking_function_tuple_katex(p parking_function) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT '(' || array_to_string((p).spots, ',') || ')' $$;

-- ── register in base_repr (collection, repr, render_fn, title, canonical, parse_fn) ──────────────────────
INSERT INTO base_repr (collection, repr, render_fn, title, canonical, parse_fn) VALUES
  ('permutations','oneline','one_line','One-line notation',true,'perm_from_oneline'),
  ('permutations','cycle','perm_cycles','Cycle notation',false,'perm_from_cycles'),
  ('permutations','dense','perm_oneline_dense','Dense base-36 one-line notation',false,'perm_from_oneline_dense');
-- the katex medium siblings — same (collection, repr), a different medium column, so none collide with the
-- unicode rows above (PRIMARY KEY (collection, repr, medium)).
INSERT INTO base_repr (collection, repr, render_fn, title, canonical, parse_fn, medium) VALUES
  ('permutations','oneline','perm_oneline_katex','One-line notation (KaTeX tuple)',false,'perm_from_oneline','latex'),
  ('integer_compositions','parts','composition_parts_katex','Parts (KaTeX tuple)',false,NULL,'latex'),
  ('set_partitions','blocks','set_partition_blocks_katex','Block notation (KaTeX)',false,NULL,'latex');
INSERT INTO base_repr (collection, repr, render_fn, title, canonical) VALUES
  ('finsets','members','finset_members','Set notation ({…})',false);
INSERT INTO base_repr (collection, repr, render_fn, title, canonical, medium) VALUES
  ('finsets','members','finset_members_katex','Set notation ({…}, KaTeX)',false,'latex');
-- #141: five collections with NO prior base_repr row at all — render_fn='notation' is their unconditional
-- default (no ground/data-dependent branching the way finset's does), so `canonical=true` holds uniformly for
-- every collection that inherits it (signed_subsets carrier-inherits to cross_polytope, set_compositions to
-- permutahedron, surjections to surjections_onto_k, parking_functions to non_decreasing_parking_functions).
INSERT INTO base_repr (collection, repr, render_fn, title, canonical) VALUES
  ('signed_permutations','oneline','notation','One-line notation (barred negatives)',true),
  ('signed_subsets','members','notation','Set notation ({…}, barred negatives)',true),
  ('set_compositions','blocks','notation','Block notation',true),
  ('surjections','tuple','notation','Surjection word',true),
  ('parking_functions','tuple','notation','Preference sequence',true);
INSERT INTO base_repr (collection, repr, render_fn, title, canonical, medium) VALUES
  ('signed_permutations','oneline','signed_permutation_katex','One-line notation (KaTeX, barred negatives)',false,'latex'),
  ('signed_subsets','members','signed_subset_members_katex','Set notation ({…}, KaTeX, barred negatives)',false,'latex'),
  ('set_compositions','blocks','set_composition_blocks_katex','Block notation (KaTeX)',false,'latex'),
  ('surjections','tuple','surjection_tuple_katex','Surjection word (KaTeX tuple)',false,'latex'),
  ('parking_functions','tuple','parking_function_tuple_katex','Preference sequence (KaTeX tuple)',false,'latex');
INSERT INTO base_repr (collection, repr, render_fn, title, canonical) VALUES
  ('set_partitions','rgs','notation','Restricted growth string',true),
  ('set_partitions','blocks','set_partition_blocks','Block notation',false),
  ('dyck_paths','word','notation','U/D word',true),
  ('dyck_paths','parens','dyck_parens','Balanced parentheses',false),
  ('integer_partitions','parts','notation','Parts',true),
  ('integer_partitions','exponential','integer_partition_frequency','Exponential (multiplicity) notation',false),
  ('integer_compositions','parts','notation','Parts',true),
  ('perfect_matchings','arcs','perfect_matching_arcs','Arc notation',false);

-- the rich-text reprs, one registered per carrier's base collection — carrier-scoped (the default), so each inherits
-- to every collection over that carrier (binary_word 13 + finset 5 = 18 dot indicators, 15 composition bars, 10 Ferrers).
INSERT INTO base_repr (collection, repr, render_fn, title, canonical) VALUES
  ('binary_words','dots','binary_word_dots','Dot indicator (●○)',false),
  ('finsets','dots','finset_dots','Membership dots (●○)',false),
  ('integer_compositions','bars','composition_bars','Stars and bars (●│)',false),
  ('integer_partitions','ferrers','integer_partition_ferrers','Ferrers diagram (■)',false);

-- ── set-builder rendering (KaTeX) for the finset carrier ────────────────────────────────────────────────
-- The generic set_builder(fiber) (realizer.sql) dispatches by carrier to this template, handing it the fiber's grade
-- axes as a {axis: value} jsonb map. finset grades by ground n (± cardinality k): k-graded ⇒ "{ S ⊆ [n] : |S| = k }",
-- n-only ⇒ the powerset "{ S ⊆ [n] }", ungraded ⇒ the finite subsets of ℕ. Reads the axes, not a per-collection symbol.
CREATE FUNCTION finset_set_builder(axes jsonb) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN axes ? 'k' THEN '\{\, S \subseteq [' || (axes->>'n') || '] : |S| = ' || (axes->>'k') || ' \,\}'
    WHEN axes ? 'n' THEN '\{\, S \subseteq [' || (axes->>'n') || '] \,\}'
    ELSE                 '\{\, S \subseteq \mathbb{N} : |S| < \infty \,\}'
  END $$;
INSERT INTO base_set_builder (carrier, builder_fn) VALUES ('finset', 'finset_set_builder');

-- ── medium spellings of the ambient-set symbol (katex / asciimath siblings of the unicode fiber_symbol) ──
-- fiber_symbol(<coll>_fiber) is the UNICODE spelling of a fiber's ambient set (Sₙ, Π([n]), 𝒟ₙ, …). Where a
-- collection's symbol has a genuinely DISTINCT math-media form, declare its katex/asciimath siblings here — graded off
-- the SAME fiber axes and matching the render corpus (seed.render_corpus.sql) reference spellings. Per-collection like
-- fiber_symbol, so the restriction siblings over a shared carrier keep their own symbols; a symbol whose three
-- spellings coincide (integer partition p(n)) gets NO sibling — nothing to translate. These stay loose functions,
-- NOT base_repr rows: fiber_symbol_katex/_asciimath take the FIBER, not the carrier, so they don't fit render_fn's
-- <fn>(<carrier>) contract — folding ambient notation into the base_repr medium axis is a further step (#138).
-- The `oneline` katex sibling above IS a base_repr row and DOES dispatch by medium (base_repr_resolved + the
-- client's renderExpr, core.ts) — that generic dispatch now exists for reprs whose render_fn is carrier-shaped.
CREATE FUNCTION fiber_symbol_katex(f permutations_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'S_{' || (f).size::int || '}' $$;               -- Sₙ
CREATE FUNCTION fiber_symbol_asciimath(f permutations_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'S_' || (f).size::int $$;
CREATE FUNCTION fiber_symbol_katex(f set_partitions_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT '\Pi([' || (f).n::int || '])' $$;             -- Π([n])
CREATE FUNCTION fiber_symbol_asciimath(f set_partitions_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Pi([' || (f).n::int || '])' $$;
CREATE FUNCTION fiber_symbol_katex(f integer_compositions_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT '\text{Comp}(' || (f).n::int || ')' $$;  -- Comp(n), upright
CREATE FUNCTION fiber_symbol_asciimath(f integer_compositions_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT '"Comp"(' || (f).n::int || ')' $$;
CREATE FUNCTION fiber_symbol_katex(f dyck_paths_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT '\mathcal{D}_{' || (f).n::int || '}' $$;            -- 𝒟ₙ (semilength n)
CREATE FUNCTION fiber_symbol_asciimath(f dyck_paths_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'cc"D"_' || (f).n::int $$;
CREATE FUNCTION fiber_symbol_katex(f perfect_matchings_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT '\mathrm{M}([' || (2 * (f).n::int) || '])' $$; -- M([2n]) (asciimath spelling coincides with unicode)

-- ── examples ────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('representations','cycle notation: 231 → (1 2 3), 213 → (1 2)(3)','eq','(1 2 3)|(1 2)(3)','permutation cycle decomposition',$q$
    SELECT perm_cycles(ROW(ARRAY[2,3,1])::permutation) || '|' || perm_cycles(ROW(ARRAY[2,1,3])::permutation) $q$),
  ('representations','identity 123 → (1)(2)(3)','eq','(1)(2)(3)','all fixed points are singleton cycles',$q$
    SELECT perm_cycles(ROW(ARRAY[1,2,3])::permutation) $q$),
  ('representations','Dyck parens: UUDD → (()), UDUD → ()()','eq','(())|()()','+1→( , -1→)',$q$
    SELECT dyck_parens(ROW(ARRAY[1,1,-1,-1])::dyck_path) || '|' || dyck_parens(ROW(ARRAY[1,-1,1,-1])::dyck_path) $q$),
  ('representations','set partition {0,1,0} blocks → {1,3}/{2}','eq','{1,3}/{2}','the blocks repr',$q$
    SELECT set_partition_blocks(ROW(ARRAY[0,1,0])::set_partition) $q$),
  ('representations','permutations reprs include at least oneline (canonical), cycle, + the two species readings (a floor — more may be added)','eq','true','base_repr rows',$q$
    SELECT (array_agg(repr) @> ARRAY['cycle','cycle_species','oneline','species'])::text FROM base_repr WHERE collection = 'permutations' $q$),
  ('representations','exponential partition notation: 3+2+2+1 → 3 2^2 1, empty → 0','eq','3 2^2 1|0','multiplicity form, largest part first',$q$
    SELECT integer_partition_frequency(ROW(ARRAY[3,2,2,1])::integer_partition) || '|' ||
           integer_partition_frequency(ROW(ARRAY[]::int[])::integer_partition) $q$),
  ('representations','arc notation: the matching [1,4,2,3] → (1,4)(2,3)','eq','(1,4)(2,3)','perfect matching pairs as arcs',$q$
    SELECT perfect_matching_arcs(ROW(ARRAY[1,4,2,3])::perfect_matching) $q$),
  ('representations','the exponential repr is INHERITED by odd_partitions via the shared carrier','eq','true','base_repr_resolved carries carrier reprs to the variants',$q$
    SELECT EXISTS (SELECT 1 FROM base_repr_resolved WHERE collection = 'odd_partitions' AND repr = 'exponential')::text $q$),
  ('representations','fiber_symbol (the ambient-set symbol, from the corpus): p(4), Π([3]), Dyck(3), Comp(4)','eq','p(4)|Π([3])|Dyck(3)|Comp(4)','the set_notation building block across collections',$q$
    SELECT fiber_symbol((unrank(integer_partitions(4),0)).fiber) || '|' || fiber_symbol((unrank(set_partitions(3),0)).fiber) || '|' ||
           fiber_symbol((unrank(dyck_paths(3),0)).fiber)         || '|' || fiber_symbol((unrank(integer_compositions(4),0)).fiber) $q$),
  ('representations','set_notation composes it: a set partition of [3] renders in its ambient set Π([3])','eq','true','ends with " ∈ Π([3])"',$q$
    SELECT (set_notation(unrank(set_partitions(3), 0)) LIKE '%' || ' ∈ ' || 'Π([3])')::text $q$),
  ('representations','eval_notation ("<notation> = <value>"): the integer 12 factors as 2^2·3','eq','2^2·3 = 12','symbolic notation ⊕ the value it evaluates to; rank 11 = the 12th positive integer',$q$
    SELECT eval_notation(unrank(integer_factorizations(), 11)) $q$),
  ('representations','eval_notation is wired only where the carrier has an evaluator value(): natural_number has none','eq','true','a plain-number carrier (notation IS the value) never degenerates to "n = n"',$q$
    SELECT (to_regprocedure('eval_notation(natural_numbers_element)') IS NULL)::text $q$),
  ('representations','set_builder (KaTeX): the fiber k_subsets(4,2) as a set-builder over its grade axes','eq','\{\, S \subseteq [4] : |S| = 2 \,\}','generic over carrier (finset) + axes (n,k)',$q$
    SELECT set_builder((unrank(k_subsets(4,2), 0)).fiber) $q$),
  ('representations','set_builder: the powerset fiber subsets(3) (graded by n alone) has no |S| clause','eq','\{\, S \subseteq [3] \,\}','same carrier, coarser grading ⇒ the powerset form',$q$
    SELECT set_builder((unrank(subsets(3), 0)).fiber) $q$),
  ('representations','set_builder is generic: a carrier with no registered template (permutation) renders NULL','eq','true','dispatched by carrier — not every fiber has a set-builder',$q$
    SELECT (set_builder((unrank(permutations(3), 0)).fiber) IS NULL)::text $q$),
  -- ── permutation input grammars ──
  ('representations','both grammars are interchangeable: cycle (1 3)(2 4) and one-line 3 4 1 2 parse to the SAME permutation','eq','true','a grammar is a property of the representation; both address the same element',$q$
    SELECT (perm_from_cycles('(1 3)(2 4)') = perm_from_oneline('3 4 1 2'))::text $q$),
  ('representations','one-line grammar accepts separated, bracketed, and bare-digit forms alike','eq','true','[3,4,1,2] = 3 4 1 2 = 3412',$q$
    SELECT (perm_from_oneline('[3, 4, 1, 2]') = perm_from_oneline('3 4 1 2')
        AND perm_from_oneline('3412')        = perm_from_oneline('3 4 1 2'))::text $q$),
  ('representations','one-line round-trip: parse ∘ one_line = id on the canonical form','eq','3412','one_line(3412) → perm → one_line',$q$
    SELECT one_line(perm_from_oneline(one_line(ROW(ARRAY[3,4,1,2])::permutation))) $q$),
  ('representations','one-line round-trip past n=9 (#70): bare digits would be ambiguous, so n>9 renders space-separated','eq','10 2 3 4 5 6 7 8 9 1',
    'parse∘one_line = id even at n=10, where two-digit values would otherwise collide with digit boundaries',$q$
    SELECT one_line(perm_from_oneline(one_line(ROW(ARRAY[10,2,3,4,5,6,7,8,9,1])::permutation))) $q$),
  ('representations','cycle round-trip: parse ∘ perm_cycles = id (fixed points shown), 213 → (1 2)(3)','eq','(1 2)(3)','perm_cycles → perm → perm_cycles',$q$
    SELECT perm_cycles(perm_from_cycles(perm_cycles(ROW(ARRAY[2,1,3])::permutation))) $q$),
  ('representations','cycle grammar omits fixed points: (1 2) on the max-2 support is the transposition 2 1','eq','21','unnamed points stay fixed; n = largest point',$q$
    SELECT one_line(perm_from_cycles('(1 2)')) $q$),
  ('representations','the parse_fn is registered on the repr and carrier-inherits (derangements get it too)','eq','perm_from_cycles|perm_from_cycles','base_repr own + base_repr_resolved inherited',$q$
    SELECT (SELECT parse_fn FROM base_repr WHERE collection = 'permutations' AND repr = 'cycle') || '|' ||
           (SELECT parse_fn FROM base_repr_resolved WHERE collection = 'derangements' AND repr = 'cycle') $q$),
  -- ── dense base-36 one-line notation (#193) ──
  ('representations','dense base-36 one-line: n=10 renders one char per position, value 10 → ''a''','eq','12345678a9','the alternate to one_line() for n>9',$q$
    SELECT perm_oneline_dense(ROW(ARRAY[1,2,3,4,5,6,7,8,10,9])::permutation) $q$),
  ('representations','dense base-36 wraps the max value at n=36 onto the leftover ''0'' digit, using all 36 symbols','eq','123456789abcdefghijklmnopqrstuvwxyz0','identity of S_36 — value 36 is the only one that wraps',$q$
    SELECT perm_oneline_dense(ROW(ARRAY(SELECT generate_series(1,36)))::permutation) $q$),
  ('representations','dense base-36 falls back to the space-separated grammar past n=36, same as one_line()','eq','true','identity of S_40 — beyond the dense alphabet''s single-char range',$q$
    SELECT (perm_oneline_dense(ROW(ARRAY(SELECT generate_series(1,40)))::permutation)
        = one_line(ROW(ARRAY(SELECT generate_series(1,40)))::permutation))::text $q$),
  ('representations','dense base-36 round-trip: parse ∘ perm_oneline_dense = id, at n=10 and at the n=36 wrap','eq','true','perm_from_oneline_dense inverts perm_oneline_dense, including ''0'' → 36',$q$
    SELECT (perm_from_oneline_dense(perm_oneline_dense(ROW(ARRAY[1,2,3,4,5,6,7,8,10,9])::permutation)) = ROW(ARRAY[1,2,3,4,5,6,7,8,10,9])::permutation
        AND perm_from_oneline_dense(perm_oneline_dense(ROW(ARRAY(SELECT generate_series(1,36)))::permutation)) = ROW(ARRAY(SELECT generate_series(1,36)))::permutation)::text $q$),
  ('representations','dense base-36 is registered as a non-canonical alternate base_repr for permutations, with its parse_fn','eq','perm_oneline_dense|perm_from_oneline_dense|false','base_repr row',$q$
    SELECT render_fn || '|' || parse_fn || '|' || canonical::text FROM base_repr WHERE collection = 'permutations' AND repr = 'dense' $q$),
  ('representations','dense base-36 matches the render-corpus oracle (#193): permutations~size/10@1 and ~size/40@0','eq','true','seed.render_corpus.sql''s aspirational base-36 golden rows',$q$
    SELECT (perm_oneline_dense(ROW(ARRAY[1,2,3,4,5,6,7,8,10,9])::permutation)
              = split_part((SELECT unicode FROM base_render_corpus WHERE family_path = 'permutations~size/10@1'), ' ∈ ', 1)
        AND perm_oneline_dense(ROW(ARRAY(SELECT generate_series(1,40)))::permutation)
              = split_part((SELECT unicode FROM base_render_corpus WHERE family_path = 'permutations~size/40@0'), ' ∈ ', 1))::text $q$),
  -- ── medium dispatch through base_repr (#138): the `oneline` repr carries a katex sibling row ──
  ('representations','the oneline katex sibling matches the render-corpus oracle: n=10 rank1 → (1,2,3,4,5,6,7,8,10,9)','eq','true','split_part(katex, '' ∈ '', 1) from permutations~size/10@1',$q$
    SELECT (perm_oneline_katex(ROW(ARRAY[1,2,3,4,5,6,7,8,10,9])::permutation)
              = split_part((SELECT katex FROM base_render_corpus WHERE family_path = 'permutations~size/10@1'), ' ∈ ', 1))::text $q$),
  ('representations','base_repr medium dispatch: the oneline repr resolves to one_line at medium=unicode, perm_oneline_katex at medium=latex','eq','one_line|perm_oneline_katex','same (collection,repr), two medium rows — PK (collection,repr,medium)',$q$
    SELECT (SELECT render_fn FROM base_repr_resolved WHERE collection = 'permutations' AND repr = 'oneline' AND medium = 'unicode') || '|' ||
           (SELECT render_fn FROM base_repr_resolved WHERE collection = 'permutations' AND repr = 'oneline' AND medium = 'latex') $q$),
  ('representations','the katex oneline sibling is CARRIER-inherited too: derangements resolves it at medium=latex','eq','perm_oneline_katex','base_repr_resolved carrier-inheritance now carries the medium column',$q$
    SELECT render_fn FROM base_repr_resolved WHERE collection = 'derangements' AND repr = 'oneline' AND medium = 'latex' $q$),
  ('representations','a medium with no sibling row leaves exactly the one (default unicode) row — the default medium is unaffected by adding a sibling elsewhere','eq','1','base_repr row count for a repr with no katex sibling (cycle)',$q$
    SELECT count(*)::text FROM base_repr WHERE collection = 'permutations' AND repr = 'cycle' $q$),
  -- ── further medium siblings (#141): compositions `parts`, set_partitions `blocks`, the new finset `members` ──
  ('representations','the composition parts katex sibling matches the render-corpus oracle: n=4@7 → (1,1,1,1)','eq','true','split_part(katex, '' ∈ '', 1) from integer_compositions~size/4@7',$q$
    SELECT (composition_parts_katex(ROW(ARRAY[1,1,1,1])::composition)
              = split_part((SELECT katex FROM base_render_corpus WHERE family_path = 'integer_compositions~size/4@7'), ' ∈ ', 1))::text $q$),
  ('representations','the default (unicode) parts repr is unchanged by adding the katex sibling: n=4@7 → 1+1+1+1','eq','1+1+1+1','notation(composition) still the plain-sum form',$q$
    SELECT notation(ROW(ARRAY[1,1,1,1])::composition) $q$),
  ('representations','base_repr medium dispatch on integer_compositions: parts resolves to notation at unicode, composition_parts_katex at latex','eq','notation|composition_parts_katex','same (collection,repr), two medium rows',$q$
    SELECT (SELECT render_fn FROM base_repr_resolved WHERE collection = 'integer_compositions' AND repr = 'parts' AND medium = 'unicode') || '|' ||
           (SELECT render_fn FROM base_repr_resolved WHERE collection = 'integer_compositions' AND repr = 'parts' AND medium = 'latex') $q$),
  ('representations','the set_partition blocks katex sibling matches the render-corpus oracle: rgs 0,1,0,2 → {{1,3},{2},{4}}','eq','true','split_part(katex, '' ∈ '', 1) from set_partitions~size/4@rgs:0,1,0,2',$q$
    SELECT (set_partition_blocks_katex(ROW(ARRAY[0,1,0,2])::set_partition)
              = split_part((SELECT katex FROM base_render_corpus WHERE family_path = 'set_partitions~size/4@rgs:0,1,0,2'), ' ∈ ', 1))::text $q$),
  ('representations','the default (unicode) blocks repr is unchanged by adding the katex sibling: rgs 0,1,0,2 → {1,3}/{2}/{4}','eq','{1,3}/{2}/{4}','set_partition_blocks still slash-separated',$q$
    SELECT set_partition_blocks(ROW(ARRAY[0,1,0,2])::set_partition) $q$),
  ('representations','the finset members repr and its katex sibling match the render-corpus oracle: n=5, members {1,3}','eq','{1,3}|true','split_part(katex, '' ∈ '', 1) from subsets~n/5@members:1,3',$q$
    SELECT finset_members(ROW(ARRAY[1,3],5)::finset) || '|' ||
           (finset_members_katex(ROW(ARRAY[1,3],5)::finset)
              = split_part((SELECT katex FROM base_render_corpus WHERE family_path = 'subsets~n/5@members:1,3'), ' ∈ ', 1))::text $q$),
  ('representations','the finset members repr is CARRIER-inherited: subsets and k_subsets both resolve it at unicode and latex','eq','true','base_repr_resolved carries the finsets-registered repr to its carrier siblings',$q$
    SELECT (EXISTS (SELECT 1 FROM base_repr_resolved WHERE collection = 'subsets'   AND repr = 'members' AND medium = 'unicode')
        AND EXISTS (SELECT 1 FROM base_repr_resolved WHERE collection = 'subsets'   AND repr = 'members' AND medium = 'latex')
        AND EXISTS (SELECT 1 FROM base_repr_resolved WHERE collection = 'k_subsets' AND repr = 'members' AND medium = 'unicode')
        AND EXISTS (SELECT 1 FROM base_repr_resolved WHERE collection = 'k_subsets' AND repr = 'members' AND medium = 'latex'))::text $q$),
  ('representations','the default finite-ground notation() is unchanged by adding members: subsets(5) rank still renders the bit register, not braces','eq','true','notation(finset) keeps its ground-dispatched register/braces split',$q$
    SELECT (notation((unrank(subsets(5), 4)).value) !~ '[{}]')::text $q$),
  -- ── #141 coverage expansion: five more collections, each getting its first base_repr rows ──
  ('representations','signed_permutation katex bars negatives and matches the render-corpus oracle: n=3 rank47 → (3̅,2̅,1̅)','eq','true','split_part(katex, '' ∈ '', 1) from signed_permutations~size/3@47',$q$
    SELECT (signed_permutation_katex(ROW(ARRAY[-3,-2,-1])::signed_permutation)
              = split_part((SELECT katex FROM base_render_corpus WHERE family_path = 'signed_permutations~size/3@47'), ' ∈ ', 1))::text $q$),
  ('representations','the default (unicode) signed_permutation notation is unchanged: {-3,-2,-1} → -3,-2,-1','eq','-3,-2,-1','plain minus signs, no bars',$q$
    SELECT notation(ROW(ARRAY[-3,-2,-1])::signed_permutation) $q$),
  ('representations','base_repr medium dispatch on signed_permutations: oneline resolves to notation at unicode, signed_permutation_katex at latex','eq','notation|signed_permutation_katex','same (collection,repr), two medium rows',$q$
    SELECT (SELECT render_fn FROM base_repr_resolved WHERE collection = 'signed_permutations' AND repr = 'oneline' AND medium = 'unicode') || '|' ||
           (SELECT render_fn FROM base_repr_resolved WHERE collection = 'signed_permutations' AND repr = 'oneline' AND medium = 'latex') $q$),
  ('representations','signed_subset katex escapes braces + bars negatives, matches the render-corpus oracle: n=4 rank15 → {1,2̅,3}','eq','true','split_part(katex, '' ∈ '', 1) from signed_subsets~size/4@15',$q$
    SELECT (signed_subset_members_katex(ROW(ARRAY[1,-2,3],4)::signed_subset)
              = split_part((SELECT katex FROM base_render_corpus WHERE family_path = 'signed_subsets~size/4@15'), ' ∈ ', 1))::text $q$),
  ('representations','the default (unicode) signed_subset notation is unchanged: ({1,-2,3},4) → {1,-2,3}','eq','{1,-2,3}','bare braces + minus sign',$q$
    SELECT notation(ROW(ARRAY[1,-2,3],4)::signed_subset) $q$),
  ('representations','the signed_subset members repr is CARRIER-inherited: cross_polytope resolves it at unicode and latex','eq','true','base_repr_resolved carries the signed_subsets-registered repr to its polytope carrier sibling',$q$
    SELECT (EXISTS (SELECT 1 FROM base_repr_resolved WHERE collection = 'cross_polytope' AND repr = 'members' AND medium = 'unicode')
        AND EXISTS (SELECT 1 FROM base_repr_resolved WHERE collection = 'cross_polytope' AND repr = 'members' AND medium = 'latex'))::text $q$),
  ('representations','set_composition katex escapes braces but keeps block ORDER as a tuple, matches the render-corpus oracle: n=4 blocks {1,2}{3,4} → ({1,2},{3,4})','eq','true','split_part(katex, '' ∈ '', 1) from set_compositions~size/4@1,2!3,4',$q$
    SELECT (set_composition_blocks_katex(ROW(ARRAY[1,1,2,2])::set_composition)
              = split_part((SELECT katex FROM base_render_corpus WHERE family_path = 'set_compositions~size/4@1,2!3,4'), ' ∈ ', 1))::text $q$),
  ('representations','the default (unicode) set_composition notation is unchanged: labels 1,1,2,2 → 1,2|3,4','eq','1,2|3,4','comma within a block, pipe between blocks',$q$
    SELECT notation(ROW(ARRAY[1,1,2,2])::set_composition) $q$),
  ('representations','the set_composition blocks repr is CARRIER-inherited: permutahedron resolves it at unicode and latex','eq','true','base_repr_resolved carries the set_compositions-registered repr to its polytope carrier sibling',$q$
    SELECT (EXISTS (SELECT 1 FROM base_repr_resolved WHERE collection = 'permutahedron' AND repr = 'blocks' AND medium = 'unicode')
        AND EXISTS (SELECT 1 FROM base_repr_resolved WHERE collection = 'permutahedron' AND repr = 'blocks' AND medium = 'latex'))::text $q$),
  ('representations','surjection katex wraps the word as a tuple, matches the render-corpus oracle: k=3 n=3 rank0 → (1,2,3)','eq','true','split_part(katex, '' ∈ '', 1) from surjections~k=3~size/3@1,2,3',$q$
    SELECT (surjection_tuple_katex(ROW(ARRAY[1,2,3])::surjection)
              = split_part((SELECT katex FROM base_render_corpus WHERE family_path = 'surjections~k=3~size/3@1,2,3'), ' ∈ ', 1))::text $q$),
  ('representations','the default (unicode) surjection notation is unchanged: 1,2,3 → 1,2,3 (bare word)','eq','1,2,3','no parens at unicode',$q$
    SELECT notation(ROW(ARRAY[1,2,3])::surjection) $q$),
  ('representations','the surjection tuple repr is CARRIER-inherited: surjections_onto_k resolves it at unicode and latex','eq','true','base_repr_resolved carries the surjections-registered repr to its restriction sibling',$q$
    SELECT (EXISTS (SELECT 1 FROM base_repr_resolved WHERE collection = 'surjections_onto_k' AND repr = 'tuple' AND medium = 'unicode')
        AND EXISTS (SELECT 1 FROM base_repr_resolved WHERE collection = 'surjections_onto_k' AND repr = 'tuple' AND medium = 'latex'))::text $q$),
  ('representations','parking_function katex wraps the sequence as a tuple, matches the render-corpus oracle: n=3 all-ones → (1,1,1)','eq','true','split_part(katex, '' ∈ '', 1) from parking_functions~size/3@1,1,1',$q$
    SELECT (parking_function_tuple_katex(ROW(ARRAY[1,1,1])::parking_function)
              = split_part((SELECT katex FROM base_render_corpus WHERE family_path = 'parking_functions~size/3@1,1,1'), ' ∈ ', 1))::text $q$),
  ('representations','the default (unicode) parking_function notation is unchanged: 1,1,1 → 1,1,1 (bare sequence)','eq','1,1,1','no parens at unicode',$q$
    SELECT notation(ROW(ARRAY[1,1,1])::parking_function) $q$),
  ('representations','the parking_function tuple repr is CARRIER-inherited: non_decreasing_parking_functions resolves it at unicode and latex','eq','true','base_repr_resolved carries the parking_functions-registered repr to its restriction sibling',$q$
    SELECT (EXISTS (SELECT 1 FROM base_repr_resolved WHERE collection = 'non_decreasing_parking_functions' AND repr = 'tuple' AND medium = 'unicode')
        AND EXISTS (SELECT 1 FROM base_repr_resolved WHERE collection = 'non_decreasing_parking_functions' AND repr = 'tuple' AND medium = 'latex'))::text $q$),
  -- ── medium spellings of the ambient-set symbol (katex / asciimath), checked against the render corpus ──
  ('representations','fiber symbol S₄ across media: unicode Sₙ, katex S_{n}, asciimath S_n','eq','S₄|S_{4}|S_4','the three spellings of the symmetric-group symbol match the corpus',$q$
    SELECT fiber_symbol((unrank(permutations(4),0)).fiber) || '|' || fiber_symbol_katex((unrank(permutations(4),0)).fiber)
        || '|' || fiber_symbol_asciimath((unrank(permutations(4),0)).fiber) $q$),
  ('representations','fiber symbol Π([4]) across media: unicode Π([n]), katex \Pi([n]), asciimath Pi([n])','eq','Π([4])|\Pi([4])|Pi([4])','set-partition ambient symbol spellings',$q$
    SELECT fiber_symbol((unrank(set_partitions(4),0)).fiber) || '|' || fiber_symbol_katex((unrank(set_partitions(4),0)).fiber)
        || '|' || fiber_symbol_asciimath((unrank(set_partitions(4),0)).fiber) $q$),
  ('representations','fiber symbol Comp(6) across media: katex \text{Comp}(n) upright, asciimath "Comp"(n)','eq','Comp(6)|\text{Comp}(6)|"Comp"(6)','integer-composition ambient symbol spellings',$q$
    SELECT fiber_symbol((unrank(integer_compositions(6),0)).fiber) || '|' || fiber_symbol_katex((unrank(integer_compositions(6),0)).fiber)
        || '|' || fiber_symbol_asciimath((unrank(integer_compositions(6),0)).fiber) $q$),
  ('representations','fiber symbol Dyck(3) across media: math media use the calligraphic 𝒟ₙ (katex \mathcal{D}_{n}, asciimath cc"D"_n)','eq','Dyck(3)|\mathcal{D}_{3}|cc"D"_3','the Dyck symbol is spelled as a word in unicode, as 𝒟 in math media (corpus convention)',$q$
    SELECT fiber_symbol((unrank(dyck_paths(3),0)).fiber) || '|' || fiber_symbol_katex((unrank(dyck_paths(3),0)).fiber)
        || '|' || fiber_symbol_asciimath((unrank(dyck_paths(3),0)).fiber) $q$),
  ('representations','fiber symbol M([2n]) katex uses upright \mathrm{M}; the asciimath spelling coincides with unicode M([4])','eq','M([4])|\mathrm{M}([4])','perfect-matching ambient symbol — only the katex form is distinct',$q$
    SELECT fiber_symbol((unrank(perfect_matchings(2),0)).fiber) || '|' || fiber_symbol_katex((unrank(perfect_matchings(2),0)).fiber) $q$);

-- ── rich-text reprs + the repr-scope leak fence (#143, #140) ─────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('representations','binary_word dots: {1,0,1} → ●○●, empty → ε','eq','●○●|ε','filled/empty membership indicator (nonzero = ●)',$q$
    SELECT binary_word_dots(ROW(ARRAY[1,0,1])::binary_word) || '|' || binary_word_dots(ROW(ARRAY[]::int[])::binary_word) $q$),
  ('representations','finset dots over the ground: ({1,3},4) → ●○●○; ℕ-ground ({1,3},NULL) stops at the largest member','eq','●○●○|●○●','position i is ● iff i ∈ S',$q$
    SELECT finset_dots(ROW(ARRAY[1,3],4)::finset) || '|' || finset_dots(ROW(ARRAY[1,3],NULL)::finset) $q$),
  ('representations','composition stars-and-bars: {2,1,3} → ●●│●│●●● (parts = runs, cuts = bars)','eq','●●│●│●●●','the gap-cut bijection rendered',$q$
    SELECT composition_bars(ROW(ARRAY[2,1,3])::composition) $q$),
  ('representations','integer_partition box Ferrers: {3,1} → two rows of ■, largest on top','eq',E'■■■\n■','one ■-row per part, descending',$q$
    SELECT integer_partition_ferrers(ROW(ARRAY[3,1])::integer_partition) $q$),
  ('representations','the dots repr is CARRIER-scoped: it inherits to a binary_word sibling (lyndon_words) and a finset sibling (k_subsets)','eq','true','carrier reprs reach every collection over the carrier',$q$
    SELECT (EXISTS (SELECT 1 FROM base_repr_resolved WHERE collection = 'lyndon_words' AND repr = 'dots')
        AND EXISTS (SELECT 1 FROM base_repr_resolved WHERE collection = 'k_subsets'    AND repr = 'dots'))::text $q$),
  ('representations','scope fence (#140): the Stern–Brocot rational is collection-scoped, so binary_words does NOT inherit a rational repr','eq','false','a collection-scoped repr never leaks onto its carrier siblings',$q$
    SELECT EXISTS (SELECT 1 FROM base_repr_resolved WHERE collection = 'binary_words' AND repr = 'rational')::text $q$),
  ('representations','the turns/rational reprs still resolve on their OWN collections (own rows ignore scope)','eq','2','stern_brocot_paths keeps turns + rational',$q$
    SELECT count(*)::text FROM base_repr_resolved WHERE collection = 'stern_brocot_paths' AND repr IN ('turns','rational') $q$);

# Design: carrier domains, representations, and the maps between them

Split from design/domains.md: §6 Open, plus the not-yet-built item 5 of §5 ("What to
build, in order").

## From §5: item 5, still in progress

5. **Then maps**, typed by carrier, which is the whole point of the preceding four. 15 of the
   catalog's 25 permutation maps, including the complete RSK family. Started:
   eleven of the catalog's twenty-five permutation maps, each checked against a plain
   reading over every permutation up to size 5: `Reverse`, `Complement`, `Inverse`,
   `DescentSet`, `PeakSet`, `ToLehmerCode`, `CycleType`, `CyclicShift`, `InverseCyclicShift`,
   and two defined purely as COMPOSITIONS — `ReverseComplement` and
   `InverseAfterComplementAfterReverse`.

   The composed ones are the point. A composed map has no body: it applies its steps through
   their own declared heads, so every intermediate value is a constructed carrier and each
   step is type-checked against the next. That is what typing maps was for, and it is also
   the tower deepening — a map defined in terms of other maps rather than re-walking the word.

## Open

- **Should a restriction ever get its own type?** §4 argues no for this catalog, but a
  head that must accept only derangements has no way to say so. That is the ask, and it is
  the same gap as epsil's missing set-builder.
- **Where do domains live in the namespace?** They are few and stable, so §2.1 of
  namespaces.md says declare them. But 86 is not nothing, and a curated subset may deserve
  the global table while the rest stay namespaced.
- **What is `Permutation` if both representations are domains?** Either a union alias, or
  nothing at all — a name used in prose but not in the type system. Worth deciding before
  writing it down.
- **How does this meet epsil's types?** Epsil reportedly carries the nominal/structural
  distinction in some depth. If its type system is the one that will matter, this design
  should be checked against it before building step 1, not after.

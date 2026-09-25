# Sage for the weekly oracle job, with Hertogh's adeles package (packages/adeles/scripts/collect-golden.py).
FROM sagemath/sagemath:10.9
# The image has no git, so the pinned commit comes as a tarball.
RUN sage -pip install --no-cache-dir https://github.com/mathehertogh/adeles/archive/1acd6362bbedccb35aac7a343eeead17d443b0d1.tar.gz

<script setup lang="ts">
// Mount the REAL enumeratio-explorer app, self-contained, owning the /explore/collection/* route slice. It self-routes off
// location.pathname (/explore/collection/<coll>;n=4/<element>) plus its view querystring, and runs against the pure-SQL
// core (bare in-browser pglite). VitePress never re-renders this space — the app owns it (incl. the document title).
import CollectionView from '@enumeratio/explorer/app'
</script>

<template>
  <CollectionView />
</template>

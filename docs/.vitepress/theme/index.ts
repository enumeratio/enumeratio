import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import PrimeVue from 'primevue/config'
import Tooltip from 'primevue/tooltip'
import Aura from '@primeuix/themes/aura'
import { definePreset } from '@primeuix/themes'
import 'primeicons/primeicons.css'
import 'katex/dist/katex.min.css'
import './tokens.css'   // the enumeratio design tokens + VitePress/PrimeVue bridges
import Layout from './Layout.vue'

// The single brand accent, amber/bronze, applied to every PrimeVue widget by re-pointing the primary ramp
// (Aura defaults to emerald). Colors are role-separated for contrast: light draws primary from a deep amber
// (amber.700 — white text passes AA on it), dark from bright gold (amber.400 — dark ink on it passes). See
// theme/tokens.css for the parallel CSS-var layer that themes the non-PrimeVue chrome.
const EnumeratioPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '{amber.50}', 100: '{amber.100}', 200: '{amber.200}', 300: '{amber.300}', 400: '{amber.400}',
      500: '{amber.500}', 600: '{amber.600}', 700: '{amber.700}', 800: '{amber.800}', 900: '{amber.900}',
      950: '{amber.950}',
    },
    colorScheme: {
      light: {
        primary: {
          color: '{amber.700}', contrastColor: '#ffffff',
          hoverColor: '{amber.800}', activeColor: '{amber.900}',
        },
      },
      dark: {
        primary: {
          color: '{amber.400}', contrastColor: '{surface.950}',
          hoverColor: '{amber.300}', activeColor: '{amber.200}',
        },
      },
    },
  },
})
import { defineAsyncComponent } from 'vue'
import NavDropdownLink from '../components/NavDropdownLink.vue'   // nav chrome, SSR-rendered — stays static

// The live, pglite-backed (and three.js) components: registered ASYNC so each becomes a LAZY chunk instead of being
// pulled into the eager theme bundle (which was ~5.8MB — the whole explorer + pglite + three, all transformed in the
// client build → the docs:build long pole, #335). Every usage is <ClientOnly> (pglite/three are browser-only), so a
// component that only ever mounts client-side loses nothing by loading its chunk on demand.
const LiveCollections = defineAsyncComponent(() => import('../components/LiveCollections.vue'))
const Explorer = defineAsyncComponent(() => import('../components/Explorer.vue'))
const QueryExplorer = defineAsyncComponent(() => import('../components/QueryExplorer.vue'))
const SessionDemo = defineAsyncComponent(() => import('../components/SessionDemo.vue'))
const ExpressionExamples = defineAsyncComponent(() => import('../components/ExpressionExamples.vue'))
const SharedSpace = defineAsyncComponent(() => import('../components/SharedSpace.vue'))
const StyleLab = defineAsyncComponent(() => import('../components/StyleLab.vue'))
const HasseDiagram = defineAsyncComponent(() => import('../components/HasseDiagram.vue'))
const AssociationTable = defineAsyncComponent(() => import('../components/AssociationTable.vue'))

// Custom Layout intercepts /explore/collection/* (mounted app) in the not-found slot. Live, pglite-backed components are
// registered globally so any markdown page can embed them (wrapped in <ClientOnly> — pglite is browser-only).
export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component('LiveCollections', LiveCollections)
    app.component('Explorer', Explorer)
    app.component('QueryExplorer', QueryExplorer)
    app.component('SessionDemo', SessionDemo)
    app.component('ExpressionExamples', ExpressionExamples)
    app.component('SharedSpace', SharedSpace)
    app.component('StyleLab', StyleLab)
    app.component('HasseDiagram', HasseDiagram)
    app.component('AssociationTable', AssociationTable)
    app.component('NavDropdownLink', NavDropdownLink)
    // Register every enumeratio custom element (`@enumeratio/components` — the pure figures + the client-backed
    // enumeratio-* elements), and set THE global Db provider so any client-backed element (e.g. <enumeratio-expression>)
    // and the explorer share ONE off-thread pglite. Browser-only: customElements + pglite are undefined during the Node
    // prerender. provideDb only sets the factory (cheap) — the pglite Db boots lazily on the first query, so unused pages
    // pay nothing; being the single provider for the whole site, the DB boots exactly once per session (off-thread),
    // whether you land on a docs widget or the /explore/collection app — no competing main-thread boot (issue #40).
    if (!import.meta.env.SSR) {
      void import('@enumeratio/components')
      void import('@enumeratio/client').then((m) => {
        m.provideDb(() => m.makeWorkerDb())
        // Dev convenience: reach the client from the console to dogfood the "extend the db live" path
        // (window.enumeratio.extendDb('CREATE FUNCTION glyph_svg(…) …')). Dev-only; not in the built site.
        if (import.meta.env.DEV) (window as unknown as { enumeratio: typeof m }).enumeratio = m
      })
      // Register the session ServiceWorker site-wide, PROD ONLY, so it caches the boot-critical DB assets (the prebuilt
      // dump + pglite's wasm/data) for every page — the explorer boots via makeWorkerDb (not the session db), so nothing
      // else would register it. Its fetch handler only touches those DB assets, so it never interferes with the SPA.
      // Dev is intentionally EXCLUDED: the @enumeratio/data Vite plugin already rebuilds + reloads the dump on any sqlsrc
      // edit, and a caching SW would serve a stale dump under active core development.
      if (import.meta.env.PROD && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        void navigator.serviceWorker.register('/enumeratio-service-worker.js', { type: 'module', scope: '/' }).catch(() => {})
      }
    }
    // PrimeVue (Aura), dark mode follows VitePress's `.dark` html class. No cssLayer so Aura's `.p-*` selectors
    // win where they apply; prose pages have no `.p-*` elements, so nothing bleeds onto them.
    app.use(PrimeVue, { theme: { preset: EnumeratioPreset, options: { darkModeSelector: '.dark' } } })
    app.directive('tooltip', Tooltip)   // v-tooltip for per-field help
  },
} satisfies Theme

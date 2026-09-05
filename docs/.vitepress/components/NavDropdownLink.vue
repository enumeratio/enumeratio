<script setup lang="ts">
// A top-nav item that's both a real link (the label navigates to the section's own index page) AND a dropdown
// (a separate chevron toggles the flyout) — VitePress's own NavItemWithChildren can't do both at once (no `link`
// field at all: see vuejs/vitepress#2989, an open feature request with no shipped fix). Registered as a
// NavItemComponent (`{ component: 'NavDropdownLink', props }` in config.ts's `nav`), which both VPNavBarMenu
// (desktop) and VPNavScreenMenu (mobile, passing `screen-menu`) render generically — no core patching needed.
//
// Self-contained on purpose: no import from vitepress's internal (non-exported) composables/components
// (`useFlyout`, `VPFlyout`, `VPMenu` aren't part of its public `vitepress/theme` surface, and would be fragile
// across version bumps). Only depends on VitePress's public, documented CSS custom properties, so it looks native
// without coupling to unversioned internals — plus the `.vpi-chevron-down`/`.vpi-plus` icon-font classes vitepress
// itself uses for the same chevrons (a much smaller, purely-cosmetic dependency: worst case if these ever get
// renamed is a missing icon glyph, not a broken interaction).
import { ref, onMounted, onUnmounted } from 'vue'

interface LinkItem { text: string; link: string }
interface GroupItem { text: string; items: LinkItem[] }

const props = defineProps<{
  text: string
  link: string
  items: (LinkItem | GroupItem)[]
  screenMenu?: boolean
}>()

const isGroup = (item: LinkItem | GroupItem): item is GroupItem => 'items' in item

const open = ref(false)
const mobileOpen = ref(false)
const root = ref<HTMLElement>()

function onDocClick(e: MouseEvent) {
  if (root.value && !root.value.contains(e.target as Node)) open.value = false
}

onMounted(() => document.addEventListener('click', onDocClick))
onUnmounted(() => document.removeEventListener('click', onDocClick))
</script>

<template>
  <div v-if="!screenMenu" class="NavDropdownLink" ref="root" @mouseenter="open = true" @mouseleave="open = false">
    <div class="row">
      <a :href="link" class="label">{{ text }}</a>
      <button type="button" class="toggle" aria-haspopup="true" :aria-expanded="open"
              :aria-label="`${text} submenu`" @click="open = !open">
        <span class="vpi-chevron-down toggle-icon" />
      </button>
    </div>
    <div class="menu" :class="{ open }">
      <div class="items">
        <template v-for="(item, i) in items" :key="i">
          <div v-if="isGroup(item)" class="group">
            <p class="group-label">{{ item.text }}</p>
            <a v-for="sub in item.items" :key="sub.link" :href="sub.link" class="item-link">{{ sub.text }}</a>
          </div>
          <a v-else :href="item.link" class="item-link top-item">{{ item.text }}</a>
        </template>
      </div>
    </div>
  </div>

  <div v-else class="NavDropdownLink screen" :class="{ open: mobileOpen }">
    <div class="row">
      <a :href="link" class="label">{{ text }}</a>
      <button type="button" class="toggle" :aria-expanded="mobileOpen"
              :aria-label="`${text} submenu`" @click="mobileOpen = !mobileOpen">
        <span class="vpi-plus toggle-icon" />
      </button>
    </div>
    <div class="items" v-show="mobileOpen">
      <template v-for="(item, i) in items" :key="i">
        <div v-if="isGroup(item)" class="group">
          <p class="group-label">{{ item.text }}</p>
          <a v-for="sub in item.items" :key="sub.link" :href="sub.link" class="item-link">{{ sub.text }}</a>
        </div>
        <a v-else :href="item.link" class="item-link top-item">{{ item.text }}</a>
      </template>
    </div>
  </div>
</template>

<style scoped>
.NavDropdownLink { position: relative; display: flex; align-items: center; height: var(--vp-nav-height); }

.row { display: flex; align-items: center; height: 100%; }

.label {
  padding: 0 4px 0 12px;
  line-height: var(--vp-nav-height);
  font-size: 14px;
  font-weight: 500;
  color: var(--vp-c-text-1);
  transition: color 0.25s;
}
.label:hover { color: var(--vp-c-brand-1); }

.toggle {
  display: flex;
  align-items: center;
  padding: 0 12px 0 2px;
  height: 100%;
  color: var(--vp-c-text-1);
  transition: color 0.25s;
}
.toggle:hover, .NavDropdownLink:hover .toggle { color: var(--vp-c-brand-1); }

.toggle-icon { font-size: 14px; }

.menu {
  position: absolute;
  top: calc(var(--vp-nav-height) / 2 + 20px);
  right: 0;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.25s, visibility 0.25s;
}
.menu.open, .NavDropdownLink:hover .menu { opacity: 1; visibility: visible; }

.items {
  border-radius: 12px;
  padding: 12px;
  min-width: 128px;
  border: 1px solid var(--vp-c-divider);
  background-color: var(--vp-c-bg-elv);
  box-shadow: var(--vp-shadow-3);
  max-height: calc(100vh - var(--vp-nav-height));
  overflow-y: auto;
}

.group { padding-bottom: 12px; }
.group + .group,
.group + .top-item { border-top: 1px solid var(--vp-c-divider); padding-top: 11px; }
.group:last-child { padding-bottom: 0; }

.group-label {
  line-height: 28px;
  font-size: 12px;
  font-weight: 500;
  color: var(--vp-c-text-2);
}

.item-link {
  display: block;
  padding: 4px 0;
  line-height: 24px;
  font-size: 14px;
  font-weight: 500;
  color: var(--vp-c-text-1);
  white-space: nowrap;
  transition: color 0.25s;
}
.item-link:hover { color: var(--vp-c-brand-1); }
.top-item { padding: 6px 0; }

/* mobile (screen-menu) — modeled on VitePress's own VPNavScreenMenuGroup markup/behavior */
.NavDropdownLink.screen {
  display: block;
  height: auto;
  border-bottom: 1px solid var(--vp-c-divider);
  padding: 12px 0 11px;
}
.NavDropdownLink.screen .row { justify-content: space-between; height: auto; }
.NavDropdownLink.screen .label { padding: 0; line-height: 24px; }
.NavDropdownLink.screen .toggle { padding: 0 4px; }
.NavDropdownLink.screen .items { border: none; box-shadow: none; padding: 10px 0 0; background: none; }
.NavDropdownLink.screen.open .toggle-icon { transform: rotate(45deg); }
</style>

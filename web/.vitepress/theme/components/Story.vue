<script setup lang="ts">
// A storybook-style demo card: a title, the live component in a framed canvas,
// and a collapsible source snippet. One Story per representation / feature.
// `id` (or a slug of the title) gives each card a stable anchor so a single
// example is directly linkable: /playground/plot-3d#two-overlaid-surfaces.
//
// The snippet is printed from the body itself -- the default slot's vnodes, written
// back out as markup -- so the components are authored once and the source cannot
// drift from what is rendered. Bound props print as their values.
import { Comment, computed, Fragment, getCurrentInstance, Text, type VNode, useSlots } from "vue";

const props = defineProps<{ title?: string; id?: string }>();
const slots = useSlots();
// The theme's registered components, so a globally registered (async-wrapped) one prints
// under the name the author wrote rather than the wrapper's.
const registered = getCurrentInstance()?.appContext.components ?? {};

const slug = computed(() =>
  (props.id ?? props.title ?? "")
    .toLowerCase()
    .replace(/[^\w]+/g, "-")
    .replace(/^-+|-+$/g, ""),
);

/** An attribute's value, in whichever quote it does not contain. */
function quoted(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.includes('"') && !text.includes("'")
    ? `'${text}'`
    : `"${text.replace(/"/g, "&quot;")}"`;
}

/** The attributes of a vnode as source: listeners, keys and refs are not markup. */
function attributes(vnodeProps: Record<string, unknown> | null): string {
  if (!vnodeProps) return "";
  return Object.entries(vnodeProps)
    .filter(
      ([key, value]) => !/^on[A-Z]/.test(key) && key !== "key" && key !== "ref" && value !== null,
    )
    .map(([key, value]) =>
      value === "" || value === true ? ` ${key}` : ` ${key}=${quoted(value)}`,
    )
    .join("");
}

/** The tag a vnode was written with: an element's name, or a component's. */
function tagOf(vnode: VNode): string | undefined {
  if (typeof vnode.type === "string") return vnode.type;
  const global = Object.keys(registered).find((name) => registered[name] === vnode.type);
  const component = vnode.type as { name?: string; __name?: string };
  return global ?? component.name ?? component.__name;
}

/** The vnodes a node renders inside itself -- an element's children, or a component's default slot. */
function childrenOf(vnode: VNode): VNode[] {
  const children = vnode.children;
  if (Array.isArray(children)) return children as VNode[];
  if (children && typeof children === "object" && "default" in children) {
    const slot = (children as { default?: () => VNode[] }).default;
    return slot ? slot() : [];
  }
  return [];
}

/** Print vnodes as indented markup lines. */
function print(nodes: VNode[], depth = 0): string[] {
  const pad = "  ".repeat(depth);
  const lines: string[] = [];
  for (const node of nodes) {
    if (node.type === Comment) continue;
    if (node.type === Text) {
      const text = String(node.children).trim();
      if (text) lines.push(pad + text);
      continue;
    }
    // A fragment, or a nameless wrapper component (`<ClientOnly>`), is not markup the
    // author wrote for its own sake: print what is inside it.
    const tag = node.type === Fragment ? undefined : tagOf(node);
    if (!tag) {
      lines.push(...print(childrenOf(node), depth));
      continue;
    }
    const open = `${pad}<${tag}${attributes(node.props)}`;
    const inner = print(childrenOf(node), depth + 1);
    if (inner.length === 0) lines.push(`${open} />`);
    else if (inner.length === 1 && !inner[0].trim().startsWith("<")) {
      lines.push(`${open}>${inner[0].trim()}</${tag}>`);
    } else lines.push(`${open}>`, ...inner, `${pad}</${tag}>`);
  }
  return lines;
}

/** The body as source, printed fresh each render so it follows what is shown. */
const source = (): string => print(slots.default?.() ?? []).join("\n");
</script>

<template>
  <div class="story" :id="slug || undefined">
    <div v-if="title || $slots.description" class="story-head">
      <h3 v-if="title" class="story-title">
        <a v-if="slug" :href="`#${slug}`" class="story-anchor" aria-hidden="true">#</a>{{ title }}
      </h3>
      <p v-if="$slots.description" class="story-desc"><slot name="description" /></p>
    </div>
    <div class="story-canvas">
      <ClientOnly><slot /></ClientOnly>
    </div>
    <details v-if="$slots.default" class="story-code">
      <summary>source</summary>
      <pre><code>{{ source() }}</code></pre>
    </details>
  </div>
</template>

<style scoped>
.story {
  margin: 1.25rem 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  overflow: hidden;
  background: var(--vp-c-bg);
}
.story-head {
  padding: 0.7rem 1rem 0;
}
.story-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  scroll-margin-top: var(--vp-nav-height, 64px);
}
/* A VitePress-style hover anchor for deep-linking a single example. */
.story-anchor {
  position: absolute;
  margin-left: -1.05em;
  padding-right: 0.35em;
  color: var(--vp-c-brand-1);
  opacity: 0;
  text-decoration: none;
  transition: opacity 0.15s;
}
.story-head:hover .story-anchor,
.story-anchor:focus {
  opacity: 1;
}
.story:target {
  scroll-margin-top: var(--vp-nav-height, 64px);
}
.story:target .story-title {
  color: var(--vp-c-brand-1);
}
.story-desc {
  margin: 0.3rem 0 0;
  font-size: 0.85rem;
  color: var(--vp-c-text-2);
}
.story-canvas {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: flex-end;
  padding: 1.25rem 1rem;
  /* A faint dotted field so glyph bounds read against the page. */
  background:
    radial-gradient(var(--vp-c-divider) 1px, transparent 1px) 0 0 / 16px 16px,
    var(--vp-c-bg-soft);
}
.story-code {
  border-top: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-alt);
}
.story-code summary {
  padding: 0.4rem 1rem;
  cursor: pointer;
  font-size: 0.75rem;
  color: var(--vp-c-text-3);
  user-select: none;
}
.story-code pre {
  margin: 0;
  padding: 0.5rem 1rem 0.9rem;
  overflow-x: auto;
  font-family: var(--vp-font-family-mono);
  font-size: 0.8rem;
  color: var(--vp-c-text-1);
}
</style>

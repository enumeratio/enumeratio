// The component stories a reference page renders, read out of @enumeratio/components'
// generated stories-data.ts rather than parsed from YAML here -- ComponentPage.vue runs in the
// browser and cannot read `reference/<Name>.stories.yaml` itself (https://github.com/enumeratio/enumeratio/wiki/Vdom). Keyed by
// the component's Vue/React wrapper name, the same rule ComponentPage.vue's `wrapper`
// computed derives a tag by.

import { STORIES_DATA, type StoryData } from "../../../packages/components/src/stories-data.ts";

export type { StoryData };

/** A component's stories, by its Vue/React wrapper name (`BarChart3D`), or none. */
export function storiesFor(name: string): readonly StoryData[] {
  return STORIES_DATA[name] ?? [];
}

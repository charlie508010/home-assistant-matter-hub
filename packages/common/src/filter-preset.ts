import type { HomeAssistantFilter } from "./home-assistant-filter.js";

export interface EntityFilterPreset {
  readonly id: string;
  readonly name: string;
  readonly filter: HomeAssistantFilter;
  readonly createdAt: string;
  readonly updatedAt: string;
}

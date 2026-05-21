import type {
  EntityFilterPreset,
  HomeAssistantFilter,
} from "@home-assistant-matter-hub/common";
import { assertOk, parseJsonResponse } from "./fetch-utils.js";

export async function fetchFilterPresets(): Promise<EntityFilterPreset[]> {
  const res = await fetch("api/filter-presets");
  await assertOk(res, "Failed to fetch filter presets");
  return parseJsonResponse<EntityFilterPreset[]>(res);
}

export async function createFilterPreset(
  name: string,
  filter: HomeAssistantFilter,
): Promise<EntityFilterPreset> {
  const res = await fetch("api/filter-presets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, filter }),
  });
  await assertOk(res, "Failed to create filter preset");
  return parseJsonResponse<EntityFilterPreset>(res);
}

export async function updateFilterPreset(
  preset: EntityFilterPreset,
  filter: HomeAssistantFilter,
): Promise<EntityFilterPreset> {
  const res = await fetch(`api/filter-presets/${preset.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: preset.name, filter }),
  });
  await assertOk(res, "Failed to update filter preset");
  return parseJsonResponse<EntityFilterPreset>(res);
}

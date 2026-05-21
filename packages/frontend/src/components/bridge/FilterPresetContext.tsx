import type { HomeAssistantFilter } from "@home-assistant-matter-hub/common";
import { createContext, useContext } from "react";

const FilterPresetContext = createContext<
  ((filter: HomeAssistantFilter) => void) | undefined
>(undefined);

export const FilterPresetProvider = FilterPresetContext.Provider;

export function useFilterPresetLoader() {
  return useContext(FilterPresetContext);
}

import type {
  EntityFilterPreset,
  HomeAssistantFilter,
} from "@home-assistant-matter-hub/common";
import express from "express";
import type { AppSettingsStorage } from "../services/storage/app-settings-storage.js";

function createId(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `${slug || "preset"}-${Date.now().toString(36)}`;
}

function normalizeFilter(filter: HomeAssistantFilter): HomeAssistantFilter {
  return {
    include: Array.isArray(filter.include) ? filter.include : [],
    exclude: Array.isArray(filter.exclude) ? filter.exclude : [],
    includeMode: filter.includeMode === "all" ? "all" : "any",
  };
}

function parsePresetBody(body: unknown): {
  id?: string;
  name: string;
  filter: HomeAssistantFilter;
} {
  const data = body as Partial<EntityFilterPreset> | undefined;
  const name = data?.name?.trim();
  if (!name) {
    throw new Error("Preset name is required");
  }
  if (!data?.filter) {
    throw new Error("Preset filter is required");
  }
  return {
    id: data.id,
    name,
    filter: normalizeFilter(data.filter),
  };
}

export function filterPresetApi(
  settingsStorage: AppSettingsStorage,
): express.Router {
  const router = express.Router();

  router.get("/", (_, res) => {
    res.json(settingsStorage.filterPresets);
  });

  router.post("/", async (req, res) => {
    try {
      const body = parsePresetBody(req.body);
      const preset = await settingsStorage.upsertFilterPreset({
        id: body.id ?? createId(body.name),
        name: body.name,
        filter: body.filter,
      });
      res.status(201).json(preset);
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : "Invalid preset",
      });
    }
  });

  router.put("/:presetId", async (req, res) => {
    try {
      const existing = settingsStorage.filterPresets.find(
        (preset) => preset.id === req.params.presetId,
      );
      if (!existing) {
        res.status(404).send("Not Found");
        return;
      }
      const body = parsePresetBody({
        ...req.body,
        id: req.params.presetId,
      });
      const preset = await settingsStorage.upsertFilterPreset({
        id: req.params.presetId,
        name: body.name,
        filter: body.filter,
        createdAt: existing.createdAt,
      });
      res.json(preset);
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : "Invalid preset",
      });
    }
  });

  router.delete("/:presetId", async (req, res) => {
    const deleted = await settingsStorage.deleteFilterPreset(
      req.params.presetId,
    );
    if (!deleted) {
      res.status(404).send("Not Found");
      return;
    }
    res.status(204).send();
  });

  return router;
}

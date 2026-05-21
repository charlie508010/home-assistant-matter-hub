import {
  bridgeConfigSchema,
  type EntityFilterPreset,
  type HomeAssistantFilter,
} from "@home-assistant-matter-hub/common";
import DeleteIcon from "@mui/icons-material/Delete";
import FileCopyIcon from "@mui/icons-material/FileCopy";
import SaveIcon from "@mui/icons-material/Save";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { JSONSchema7 } from "json-schema";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  createFilterPreset,
  deleteFilterPreset,
  fetchFilterPresets,
  updateFilterPreset,
} from "../../api/filter-presets.ts";
import {
  cloneSchema,
  localizeFilterSchema,
} from "../../components/bridge/BridgeConfigEditor.tsx";
import { CompactArrayFieldTemplate } from "../../components/bridge/rjsf/CompactArrayFieldTemplate.tsx";
import { EntityFilterRuleField } from "../../components/bridge/rjsf/EntityFilterRuleField.tsx";
import { FormEditor } from "../../components/misc/editors/FormEditor.tsx";

function emptyFilter(): HomeAssistantFilter {
  return { include: [], exclude: [], includeMode: "any" };
}

function cloneFilter(filter: HomeAssistantFilter): HomeAssistantFilter {
  return {
    include: [...(filter.include ?? [])],
    exclude: [...(filter.exclude ?? [])],
    includeMode: filter.includeMode ?? "any",
  };
}

function filterSchema(t: ReturnType<typeof useTranslation>["t"]): JSONSchema7 {
  const schema = cloneSchema(
    (bridgeConfigSchema.properties as Record<string, JSONSchema7>).filter,
  );
  localizeFilterSchema(schema, t);
  return schema;
}

export function FilterPresetsPage({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const { t } = useTranslation();
  const [presets, setPresets] = useState<EntityFilterPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [name, setName] = useState("");
  const [filter, setFilter] = useState<HomeAssistantFilter>(emptyFilter());
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState<string | undefined>();

  const selectedPreset = useMemo(
    () => presets.find((preset) => preset.id === selectedPresetId),
    [presets, selectedPresetId],
  );
  const schema = useMemo(() => filterSchema(t), [t]);

  const loadPresets = useCallback(async () => {
    const loaded = await fetchFilterPresets();
    setPresets(loaded);
    return loaded;
  }, []);

  useEffect(() => {
    loadPresets().catch((e) =>
      setError(e instanceof Error ? e.message : "Failed to load presets"),
    );
  }, [loadPresets]);

  const selectPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    const preset = presets.find((p) => p.id === presetId);
    if (!preset) return;
    setName(preset.name);
    setFilter(cloneFilter(preset.filter));
  };

  const resetToNew = () => {
    setSelectedPresetId("");
    setName("");
    setFilter(emptyFilter());
    setError(undefined);
    setSuccess(undefined);
  };

  const savePreset = async () => {
    if (!name.trim()) return;
    setError(undefined);
    setSuccess(undefined);
    try {
      const saved = selectedPreset
        ? await updateFilterPreset({ ...selectedPreset, name }, filter)
        : await createFilterPreset(name, filter);
      const loaded = await loadPresets();
      const next = loaded.find((preset) => preset.id === saved.id);
      if (next) {
        setSelectedPresetId(next.id);
        setName(next.name);
        setFilter(cloneFilter(next.filter));
      }
      setSuccess(t("filterPresets.saved"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save preset");
    }
  };

  const duplicatePreset = async () => {
    if (!name.trim()) return;
    setError(undefined);
    setSuccess(undefined);
    try {
      const saved = await createFilterPreset(
        t("filterPresets.copyName", { name }),
        filter,
      );
      await loadPresets();
      setSelectedPresetId(saved.id);
      setName(saved.name);
      setSuccess(t("filterPresets.saved"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to duplicate preset");
    }
  };

  const removePreset = async () => {
    if (!selectedPreset) return;
    setError(undefined);
    setSuccess(undefined);
    try {
      await deleteFilterPreset(selectedPreset.id);
      await loadPresets();
      resetToNew();
      setSuccess(t("filterPresets.deleted"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete preset");
    }
  };

  return (
    <Box sx={embedded ? undefined : { p: 2 }}>
      {!embedded && (
        <Typography variant="h5" component="h1" sx={{ mb: 3 }}>
          {t("filterPresets.title")}
        </Typography>
      )}

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <FormControl fullWidth>
                <InputLabel>{t("filterPresets.selectLabel")}</InputLabel>
                <Select
                  value={selectedPresetId}
                  label={t("filterPresets.selectLabel")}
                  onChange={(event) => selectPreset(event.target.value)}
                >
                  {presets.map((preset) => (
                    <MenuItem key={preset.id} value={preset.id}>
                      {preset.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button variant="outlined" onClick={resetToNew}>
                {t("filterPresets.newPreset")}
              </Button>
            </Stack>

            <TextField
              label={t("filterPresets.name")}
              value={name}
              onChange={(event) => setName(event.target.value)}
              fullWidth
            />

            <FormEditor
              value={filter}
              onChange={(value) => setFilter(value as HomeAssistantFilter)}
              schema={schema}
              uiSchema={{
                "ui:submitButtonOptions": { norender: true },
                include: {
                  "ui:options": {
                    ArrayFieldTemplate: CompactArrayFieldTemplate,
                  },
                  items: { "ui:field": "entityFilterRule" },
                },
                exclude: {
                  "ui:options": {
                    ArrayFieldTemplate: CompactArrayFieldTemplate,
                  },
                  items: { "ui:field": "entityFilterRule" },
                },
              }}
              fields={{ entityFilterRule: EntityFilterRuleField }}
            />

            <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                disabled={!name.trim()}
                onClick={savePreset}
              >
                {t("common.save")}
              </Button>
              <Button
                variant="outlined"
                startIcon={<FileCopyIcon />}
                disabled={!name.trim()}
                onClick={duplicatePreset}
              >
                {t("filterPresets.duplicate")}
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                disabled={!selectedPreset}
                onClick={removePreset}
              >
                {t("common.delete")}
              </Button>
            </Stack>

            {success && (
              <Typography variant="body2" color="success.main">
                {success}
              </Typography>
            )}
            {error && (
              <Typography variant="body2" color="error">
                {error}
              </Typography>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

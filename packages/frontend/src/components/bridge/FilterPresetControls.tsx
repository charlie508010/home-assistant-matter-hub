import type {
  EntityFilterPreset,
  HomeAssistantFilter,
} from "@home-assistant-matter-hub/common";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import SaveIcon from "@mui/icons-material/Save";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  createFilterPreset,
  fetchFilterPresets,
  updateFilterPreset,
} from "../../api/filter-presets.ts";

interface FilterPresetControlsProps {
  filter: HomeAssistantFilter;
  onFilterChange: (filter: HomeAssistantFilter) => void;
}

function cloneFilter(filter: HomeAssistantFilter): HomeAssistantFilter {
  return {
    include: [...(filter.include ?? [])],
    exclude: [...(filter.exclude ?? [])],
    includeMode: filter.includeMode ?? "any",
  };
}

export function FilterPresetControls({
  filter,
  onFilterChange,
}: FilterPresetControlsProps) {
  const { t } = useTranslation();
  const [presets, setPresets] = useState<EntityFilterPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [activePresetId, setActivePresetId] = useState<string | undefined>();
  const [newPresetName, setNewPresetName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const selectedPreset = useMemo(
    () => presets.find((preset) => preset.id === selectedPresetId),
    [presets, selectedPresetId],
  );
  const activePreset = useMemo(
    () => presets.find((preset) => preset.id === activePresetId),
    [presets, activePresetId],
  );

  useEffect(() => {
    fetchFilterPresets()
      .then(setPresets)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load presets"),
      );
  }, []);

  const reloadPresets = async () => {
    setPresets(await fetchFilterPresets());
  };

  const loadPreset = () => {
    if (!selectedPreset) return;
    onFilterChange(cloneFilter(selectedPreset.filter));
    setActivePresetId(selectedPreset.id);
  };

  const saveAsNewPreset = async () => {
    if (!newPresetName.trim()) return;
    setLoading(true);
    setError(undefined);
    try {
      const preset = await createFilterPreset(
        newPresetName,
        cloneFilter(filter),
      );
      await reloadPresets();
      setSelectedPresetId(preset.id);
      setActivePresetId(preset.id);
      setNewPresetName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save preset");
    } finally {
      setLoading(false);
    }
  };

  const updateActivePreset = async () => {
    if (!activePreset) return;
    setLoading(true);
    setError(undefined);
    try {
      const preset = await updateFilterPreset(
        activePreset,
        cloneFilter(filter),
      );
      await reloadPresets();
      setSelectedPresetId(preset.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update preset");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
            <Typography variant="subtitle1" fontWeight={600}>
              {t("bridgeConfig.filterPresets.title")}
            </Typography>
            <Chip
              size="small"
              color={activePreset ? "primary" : "default"}
              label={
                activePreset
                  ? t("bridgeConfig.filterPresets.activePreset", {
                      name: activePreset.name,
                    })
                  : t("bridgeConfig.filterPresets.activeManual")
              }
            />
          </Box>

          <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
            <FormControl fullWidth size="small">
              <InputLabel>
                {t("bridgeConfig.filterPresets.selectLabel")}
              </InputLabel>
              <Select
                value={selectedPresetId}
                label={t("bridgeConfig.filterPresets.selectLabel")}
                onChange={(event) => setSelectedPresetId(event.target.value)}
              >
                {presets.map((preset) => (
                  <MenuItem key={preset.id} value={preset.id}>
                    {preset.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              startIcon={<ContentCopyIcon />}
              onClick={loadPreset}
              disabled={!selectedPreset}
            >
              {t("bridgeConfig.filterPresets.load")}
            </Button>
            <Button
              variant="outlined"
              onClick={() => setActivePresetId(undefined)}
            >
              {t("bridgeConfig.filterPresets.detach")}
            </Button>
          </Stack>

          <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
            <TextField
              fullWidth
              size="small"
              value={newPresetName}
              label={t("bridgeConfig.filterPresets.newName")}
              onChange={(event) => setNewPresetName(event.target.value)}
            />
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={saveAsNewPreset}
              disabled={loading || !newPresetName.trim()}
            >
              {t("bridgeConfig.filterPresets.saveNew")}
            </Button>
            <Button
              variant="outlined"
              onClick={updateActivePreset}
              disabled={loading || !activePreset}
            >
              {t("bridgeConfig.filterPresets.update")}
            </Button>
          </Stack>

          <Typography variant="caption" color="text.secondary">
            {t("bridgeConfig.filterPresets.help")}
          </Typography>
          {error && (
            <Typography variant="caption" color="error">
              {error}
            </Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

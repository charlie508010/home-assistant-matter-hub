import type {
  EntityFilterPreset,
  HomeAssistantFilter,
} from "@home-assistant-matter-hub/common";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
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
import Typography from "@mui/material/Typography";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router";
import { fetchFilterPresets } from "../../api/filter-presets.ts";
import { navigation } from "../../routes.tsx";

interface FilterPresetControlsProps {
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
  onFilterChange,
}: FilterPresetControlsProps) {
  const { t } = useTranslation();
  const [presets, setPresets] = useState<EntityFilterPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [activePresetId, setActivePresetId] = useState<string | undefined>();
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

  const loadPreset = () => {
    if (!selectedPreset) return;
    onFilterChange(cloneFilter(selectedPreset.filter));
    setActivePresetId(selectedPreset.id);
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
            <Typography variant="subtitle1" fontWeight={600}>
              {t("filterPresets.bridgeTitle")}
            </Typography>
            <Chip
              size="small"
              color={activePreset ? "primary" : "default"}
              label={
                activePreset
                  ? t("filterPresets.activePreset", {
                      name: activePreset.name,
                    })
                  : t("filterPresets.activeManual")
              }
            />
          </Box>

          <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
            <FormControl fullWidth size="small">
              <InputLabel>{t("filterPresets.selectLabel")}</InputLabel>
              <Select
                value={selectedPresetId}
                label={t("filterPresets.selectLabel")}
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
              {t("filterPresets.load")}
            </Button>
            <Button
              variant="outlined"
              onClick={() => setActivePresetId(undefined)}
            >
              {t("filterPresets.detach")}
            </Button>
            <Button component={RouterLink} to={navigation.filterPresets}>
              {t("filterPresets.manage")}
            </Button>
          </Stack>

          <Typography variant="caption" color="text.secondary">
            {t("filterPresets.bridgeHelp")}
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

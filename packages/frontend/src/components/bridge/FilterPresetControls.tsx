import type {
  EntityFilterPreset,
  HomeAssistantFilter,
} from "@home-assistant-matter-hub/common";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Typography from "@mui/material/Typography";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetchFilterPresets } from "../../api/filter-presets.ts";

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
  const [open, setOpen] = useState(false);
  const [presets, setPresets] = useState<EntityFilterPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [error, setError] = useState<string | undefined>();

  const selectedPreset = useMemo(
    () => presets.find((preset) => preset.id === selectedPresetId),
    [presets, selectedPresetId],
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
    setOpen(false);
  };

  return (
    <>
      <Button
        variant="outlined"
        startIcon={<FileDownloadIcon />}
        onClick={() => setOpen(true)}
      >
        {t("filterPresets.load")}
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{t("filterPresets.loadDialogTitle")}</DialogTitle>
        <DialogContent>
          <FormControl fullWidth margin="normal">
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

          {selectedPreset && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {t("filterPresets.selectedDescription", {
                include: selectedPreset.filter.include.length,
                exclude: selectedPreset.filter.exclude.length,
                mode: selectedPreset.filter.includeMode ?? "any",
              })}
            </Typography>
          )}

          {presets.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {t("filterPresets.noPresets")}
            </Typography>
          )}

          {error && (
            <Typography variant="body2" color="error" sx={{ mt: 1 }}>
              {error}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
          <Button
            variant="contained"
            onClick={loadPreset}
            disabled={!selectedPreset}
          >
            {t("filterPresets.loadShort")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

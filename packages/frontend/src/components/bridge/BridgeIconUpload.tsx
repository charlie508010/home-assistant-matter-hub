import type { BridgeIconType } from "@home-assistant-matter-hub/common";
import CloudUpload from "@mui/icons-material/CloudUpload";
import Delete from "@mui/icons-material/Delete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  checkBridgeIconExists,
  deleteBridgeIcon,
  getBridgeIconUrl,
  uploadBridgeIcon,
} from "../../api/bridge-icons";

const ICON_OPTIONS: {
  value: BridgeIconType | "";
  icon: string;
  labelKey: string;
}[] = [
  { value: "", icon: "⚙️", labelKey: "auto" },
  { value: "light", icon: "💡", labelKey: "light" },
  { value: "switch", icon: "🔌", labelKey: "switch" },
  { value: "climate", icon: "🌡️", labelKey: "climate" },
  { value: "cover", icon: "🪟", labelKey: "cover" },
  { value: "fan", icon: "🌀", labelKey: "fan" },
  { value: "lock", icon: "🔒", labelKey: "lock" },
  { value: "sensor", icon: "📊", labelKey: "sensor" },
  { value: "media_player", icon: "📺", labelKey: "mediaPlayer" },
  { value: "vacuum", icon: "🧹", labelKey: "vacuum" },
  { value: "remote", icon: "🎮", labelKey: "remote" },
  { value: "humidifier", icon: "💧", labelKey: "humidifier" },
  { value: "speaker", icon: "🔊", labelKey: "speaker" },
  { value: "garage", icon: "🚗", labelKey: "garage" },
  { value: "door", icon: "🚪", labelKey: "door" },
  { value: "window", icon: "🪟", labelKey: "window" },
  { value: "motion", icon: "🏃", labelKey: "motion" },
  { value: "battery", icon: "🔋", labelKey: "battery" },
  { value: "power", icon: "⚡", labelKey: "power" },
  { value: "camera", icon: "📷", labelKey: "camera" },
  { value: "default", icon: "🔗", labelKey: "default" },
];

export interface BridgeIconUploadProps {
  bridgeId?: string;
  selectedIcon?: BridgeIconType | "";
  onIconChange: (icon: BridgeIconType | undefined) => void;
}

export const BridgeIconUpload = ({
  bridgeId,
  selectedIcon,
  onIconChange,
}: BridgeIconUploadProps) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hasCustomIcon, setHasCustomIcon] = useState(false);
  const [customIconUrl, setCustomIconUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (bridgeId) {
      checkBridgeIconExists(bridgeId)
        .then((exists) => {
          setHasCustomIcon(exists);
          if (exists) {
            setCustomIconUrl(`${getBridgeIconUrl(bridgeId)}?t=${Date.now()}`);
          }
        })
        .catch(() => {
          // Icon doesn't exist or API error - ignore
          setHasCustomIcon(false);
        });
    }
  }, [bridgeId]);

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || !bridgeId) return;

      setError(null);
      setUploading(true);

      try {
        await uploadBridgeIcon(bridgeId, file);
        setHasCustomIcon(true);
        setCustomIconUrl(`${getBridgeIconUrl(bridgeId)}?t=${Date.now()}`);
        onIconChange(undefined);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [bridgeId, onIconChange],
  );

  const handleDeleteCustomIcon = useCallback(async () => {
    if (!bridgeId) return;

    setError(null);
    try {
      await deleteBridgeIcon(bridgeId);
      setHasCustomIcon(false);
      setCustomIconUrl(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }, [bridgeId]);

  const handleIconSelectChange = useCallback(
    (value: string) => {
      onIconChange(value === "" ? undefined : (value as BridgeIconType));
    },
    [onIconChange],
  );

  return (
    <Stack spacing={2}>
      <FormControl fullWidth size="small">
        <InputLabel id="icon-select-label">
          {t("bridgeIcon.bridgeIcon")}
        </InputLabel>
        <Select
          labelId="icon-select-label"
          value={selectedIcon ?? ""}
          label={t("bridgeIcon.bridgeIcon")}
          onChange={(e) => handleIconSelectChange(e.target.value)}
          disabled={hasCustomIcon}
        >
          {ICON_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.icon} {t(`bridgeIcon.options.${option.labelKey}`)}
            </MenuItem>
          ))}
        </Select>
        <FormHelperText>
          {hasCustomIcon
            ? t("bridgeIcon.customIconSet")
            : t("bridgeIcon.selectPresetOrUpload")}
        </FormHelperText>
      </FormControl>

      {bridgeId && (
        <Box>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            {t("bridgeIcon.customIcon")}
          </Typography>

          <Stack direction="row" spacing={2} alignItems="center">
            {hasCustomIcon && customIconUrl && (
              <Box
                component="img"
                src={customIconUrl}
                alt={t("bridgeIcon.customIconAlt")}
                sx={{
                  width: 48,
                  height: 48,
                  objectFit: "contain",
                  borderRadius: 1,
                  border: "1px solid",
                  borderColor: "divider",
                }}
              />
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
              style={{ display: "none" }}
              onChange={handleFileSelect}
            />

            <Button
              variant="outlined"
              size="small"
              startIcon={<CloudUpload />}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? t("bridgeIcon.uploading") : t("bridgeIcon.upload")}
            </Button>

            {hasCustomIcon && (
              <Button
                variant="outlined"
                size="small"
                color="error"
                startIcon={<Delete />}
                onClick={handleDeleteCustomIcon}
              >
                {t("common.delete")}
              </Button>
            )}
          </Stack>

          {error && (
            <Typography variant="caption" color="error" sx={{ mt: 1 }}>
              {error}
            </Typography>
          )}

          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mt: 1, display: "block" }}
          >
            {t("bridgeIcon.supportedFormats")}
          </Typography>
        </Box>
      )}

      {!bridgeId && (
        <Typography variant="body2" color="text.secondary">
          {t("bridgeIcon.saveFirst")}
        </Typography>
      )}
    </Stack>
  );
};

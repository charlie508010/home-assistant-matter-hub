import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { FieldProps } from "@rjsf/utils";
import type { JSONSchema7 } from "json-schema";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";

const FEATURE_FLAG_SECTIONS = [
  {
    key: "covers",
    flags: [
      "coverDoNotInvertPercentage",
      "coverUseHomeAssistantPercentage",
      "coverSwapOpenClose",
      "coverSliderDebounceMs",
    ],
  },
  {
    key: "vacuum",
    flags: ["serverMode", "vacuumOnOff"],
  },
  {
    key: "homeAssistant",
    flags: [
      "includeHiddenEntities",
      "productNameFromNodeLabel",
      "preferEntityRegistryName",
      "useHaRegistrySerial",
    ],
  },
  {
    key: "autoMapping",
    flags: [
      "autoBatteryMapping",
      "autoHumidityMapping",
      "autoPressureMapping",
      "autoComposedDevices",
    ],
  },
  {
    key: "alexa",
    flags: ["alexaPreserveBrightnessOnTurnOn"],
  },
  {
    key: "stability",
    flags: ["autoForceSync"],
  },
] as const;

export function FeatureFlagsField(props: FieldProps) {
  const { t } = useTranslation();
  const {
    schema,
    formData = {},
    onChange,
    disabled,
    readonly,
    fieldPathId,
  } = props;
  const properties = (schema.properties ?? {}) as Record<string, JSONSchema7>;
  const assignedKeys = new Set<string>(
    FEATURE_FLAG_SECTIONS.flatMap((section) => section.flags),
  );
  const sections = FEATURE_FLAG_SECTIONS.map((section) => ({
    ...section,
    flags: section.flags.filter((key) => properties[key] !== undefined),
  })).filter((section) => section.flags.length > 0);
  const uncategorizedFlags = Object.keys(properties).filter(
    (key) => !assignedKeys.has(key),
  );

  const translateFlag = (
    key: string,
    field: "title" | "description",
    fallback?: string,
  ) =>
    t(`featureFlags.flags.${key}.${field}`, { defaultValue: fallback ?? key });

  const handleToggle = useCallback(
    (key: string, checked: boolean) => {
      onChange({ ...formData, [key]: checked }, fieldPathId.path);
    },
    [formData, onChange, fieldPathId],
  );

  const handleNumberChange = useCallback(
    (key: string, next: string) => {
      const numberValue = next === "" ? undefined : Number(next);
      onChange({ ...formData, [key]: numberValue }, fieldPathId.path);
    },
    [formData, onChange, fieldPathId],
  );

  const renderFlag = (key: string) => {
    const flagSchema = properties[key];
    const value = formData[key] ?? flagSchema.default ?? false;
    const isDeprecated =
      flagSchema.title?.toLowerCase().includes("deprecated") ?? false;
    const isNumber =
      flagSchema.type === "number" || flagSchema.type === "integer";

    return (
      <Grid key={key} size={{ xs: 12, sm: 6, lg: 4 }}>
        <Card
          variant="outlined"
          sx={{
            height: "100%",
            opacity: isDeprecated ? 0.6 : 1,
            transition: "border-color 0.2s, box-shadow 0.2s",
            borderColor: value ? "primary.main" : "divider",
            "&:hover": {
              transform: "none",
              boxShadow: "none",
            },
          }}
        >
          <CardActionArea
            onClick={() => {
              if (!isNumber && !disabled && !readonly) {
                handleToggle(key, !value);
              }
            }}
            disabled={disabled || readonly}
            sx={{ height: "100%", alignItems: "stretch" }}
          >
            <CardContent
              sx={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
                p: 2,
                "&:last-child": { pb: 2 },
              }}
            >
              <Box
                display="flex"
                justifyContent="space-between"
                alignItems="flex-start"
                gap={1}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    variant="subtitle2"
                    fontWeight={600}
                    sx={{ lineHeight: 1.3 }}
                  >
                    {translateFlag(key, "title", flagSchema.title)}
                  </Typography>
                  {!isNumber && value && (
                    <Chip
                      label={t("common.active")}
                      size="small"
                      color="primary"
                      variant="outlined"
                      sx={{ mt: 0.5, height: 20, fontSize: "0.7rem" }}
                    />
                  )}
                </Box>
                {isNumber ? (
                  <TextField
                    type="number"
                    size="small"
                    value={value ?? ""}
                    disabled={disabled || readonly}
                    slotProps={{
                      htmlInput: {
                        min: flagSchema.minimum,
                        max: flagSchema.maximum,
                      },
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => handleNumberChange(key, e.target.value)}
                    sx={{ width: 96 }}
                  />
                ) : (
                  <Switch
                    checked={value}
                    size="small"
                    disabled={disabled || readonly}
                    tabIndex={-1}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => handleToggle(key, e.target.checked)}
                  />
                )}
              </Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mt: 1, lineHeight: 1.4, flex: 1 }}
              >
                {translateFlag(key, "description", flagSchema.description)}
              </Typography>
            </CardContent>
          </CardActionArea>
        </Card>
      </Grid>
    );
  };

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>
        {t("featureFlags.title")}
      </Typography>
      <Box display="flex" flexDirection="column" gap={3}>
        {[...sections, { key: "other", flags: uncategorizedFlags }].map(
          (section) =>
            section.flags.length > 0 && (
              <Box key={section.key}>
                <Box display="flex" alignItems="center" gap={1.5} mb={1.5}>
                  <Typography variant="subtitle1" fontWeight={700}>
                    {t(`featureFlags.sections.${section.key}`)}
                  </Typography>
                  <Divider sx={{ flex: 1 }} />
                </Box>
                <Grid container spacing={2}>
                  {section.flags.map((key) => renderFlag(key))}
                </Grid>
              </Box>
            ),
        )}
      </Box>
    </Box>
  );
}

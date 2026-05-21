import {
  type BridgeConfig,
  type BridgeIconType,
  bridgeConfigSchema,
  type HomeAssistantFilter,
} from "@home-assistant-matter-hub/common";
import { LibraryBooks, TextFields } from "@mui/icons-material";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { lazy, Suspense, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { navigation } from "../../routes.tsx";
import type { ValidationError } from "../misc/editors/validation-error.ts";
import { BridgeIconUpload } from "./BridgeIconUpload.tsx";
import { localizeBridgeConfigSchema } from "./bridge-config-schema-localization.ts";
import { FilterPresetProvider } from "./FilterPresetContext.tsx";
import { FilterPreview } from "./FilterPreview.tsx";

const BridgeConfigFieldsForm = lazy(() =>
  import("./BridgeConfigFieldsForm.tsx").then((m) => ({
    default: m.BridgeConfigFieldsForm,
  })),
);

const JsonEditor = lazy(() =>
  import("../misc/editors/JsonEditor.tsx").then((m) => ({
    default: m.JsonEditor,
  })),
);

const FilterReferenceHelp = lazy(() =>
  import("./FilterReferenceHelp.tsx").then((m) => ({
    default: m.FilterReferenceHelp,
  })),
);

enum BridgeEditorMode {
  JSON_EDITOR = "JSON_EDITOR",
  FIELDS_EDITOR = "FIELDS_EDITOR",
}

export interface BridgeConfigEditorProps {
  bridgeId?: string;
  bridge: BridgeConfig;
  usedPorts: Record<number, string>;
  onSave: (config: BridgeConfig) => void | Promise<void>;
  onCancel: () => void | Promise<void>;
}

export const BridgeConfigEditor = (props: BridgeConfigEditorProps) => {
  const { t } = useTranslation();
  const localizedSchema = useMemo(
    () => localizeBridgeConfigSchema(bridgeConfigSchema, t),
    [t],
  );
  const [editorMode, setEditorMode] = useState<BridgeEditorMode>(
    BridgeEditorMode.FIELDS_EDITOR,
  );
  const toggleEditor = () => {
    setEditorMode(
      editorMode === BridgeEditorMode.FIELDS_EDITOR
        ? BridgeEditorMode.JSON_EDITOR
        : BridgeEditorMode.FIELDS_EDITOR,
    );
  };

  const [config, setConfig] = useState<object | undefined>(props.bridge);
  const [isValid, setIsValid] = useState<boolean>(true);

  const validatePort = useCallback(
    (value: object | undefined): ValidationError[] => {
      const config = value as Partial<BridgeConfig> | undefined;
      if (!config?.port) {
        return [];
      }
      const usedBy = props.usedPorts[config.port];
      if (usedBy !== undefined && usedBy !== props.bridgeId) {
        return [
          {
            instancePath: "/port",
            message: t("bridgeConfig.validation.portUsed", { id: usedBy }),
          },
        ];
      }
      return [];
    },
    [props.bridgeId, props.usedPorts, t],
  );

  const onChange = (data: object | undefined, isValid: boolean) => {
    // Preserve the icon field when FormEditor/JsonEditor updates
    // since icon is managed separately by BridgeIconUpload
    const prevIcon = (prev: object | undefined) => (prev as BridgeConfig)?.icon;
    setConfig((prev) => {
      const icon = prevIcon(prev);
      return icon != null ? { ...data, icon } : { ...data };
    });
    setIsValid(isValid);
  };

  const handleIconChange = useCallback((icon: BridgeIconType | undefined) => {
    setConfig((prev) => {
      if (icon != null) {
        return { ...prev, icon };
      }
      const { icon: _, ...rest } = (prev ?? {}) as BridgeConfig & {
        icon?: BridgeIconType;
      };
      return rest;
    });
  }, []);

  const handleFilterChange = useCallback((filter: HomeAssistantFilter) => {
    setConfig((prev) => ({
      ...(prev ?? {}),
      filter,
    }));
  }, []);

  const warnings = useMemo(() => {
    const cfg = config as Partial<BridgeConfig> | undefined;
    const flags = cfg?.featureFlags;
    const result: { severity: "warning" | "error"; message: string }[] = [];

    if (flags?.serverMode) {
      result.push({
        severity: "warning",
        message: t("bridgeConfig.warnings.serverModeSingleDevice"),
      });
    }

    if (flags?.serverMode && flags?.vacuumOnOff === false) {
      result.push({
        severity: "warning",
        message: t("bridgeConfig.warnings.serverModeVacuumOnOffDisabled"),
      });
    }

    if (!flags?.serverMode && flags?.vacuumOnOff) {
      result.push({
        severity: "warning",
        message: t("bridgeConfig.warnings.vacuumOnOffBridgeMode"),
      });
    }

    if (flags?.autoForceSync && flags?.autoComposedDevices) {
      result.push({
        severity: "warning",
        message: t("bridgeConfig.warnings.autoForceSyncComposedDevices"),
      });
    }

    return result;
  }, [config, t]);

  const saveAction = async () => {
    if (!isValid) {
      return;
    }
    await props.onSave(config as BridgeConfig);
  };

  return (
    <>
      <Alert severity="warning" variant="outlined">
        {t("bridgeConfig.documentation.prefix")}{" "}
        <Link href={navigation.faq.bridgeConfig} target="_blank">
          {t("bridgeConfig.documentation.link")}
        </Link>{" "}
        {t("bridgeConfig.documentation.suffix")}{" "}
        <strong>{t("bridgeConfig.documentation.labelsHint")}</strong>
      </Alert>

      <Alert severity="info" variant="outlined">
        <strong>{t("bridgeConfig.communityTip.title")}</strong>{" "}
        {t("bridgeConfig.communityTip.description")}
      </Alert>

      {warnings.map((w) => (
        <Alert key={w.message} severity={w.severity} variant="outlined">
          {w.message}
        </Alert>
      ))}

      <Stack spacing={2}>
        <Box display="flex" justifyContent={"flex-end"}>
          <Button
            onClick={() => toggleEditor()}
            title={
              editorMode === BridgeEditorMode.FIELDS_EDITOR
                ? t("bridge.jsonEditor")
                : t("bridge.formEditor")
            }
          >
            {editorMode === BridgeEditorMode.FIELDS_EDITOR ? (
              <TextFields />
            ) : (
              <LibraryBooks />
            )}
          </Button>
        </Box>

        {editorMode === BridgeEditorMode.FIELDS_EDITOR && (
          <FilterPresetProvider value={handleFilterChange}>
            <Suspense fallback={null}>
              <BridgeConfigFieldsForm
                value={config ?? {}}
                onChange={onChange}
                schema={localizedSchema}
                validatePort={validatePort}
                submitText={t("common.save")}
              />
            </Suspense>
          </FilterPresetProvider>
        )}

        {editorMode === BridgeEditorMode.JSON_EDITOR && (
          <Suspense fallback={null}>
            <JsonEditor
              value={config ?? {}}
              onChange={onChange}
              schema={localizedSchema}
              customValidate={validatePort}
            />
          </Suspense>
        )}

        {(config as BridgeConfig)?.filter && (
          <FilterPreview filter={(config as BridgeConfig).filter} />
        )}

        <Suspense fallback={null}>
          <FilterReferenceHelp />
        </Suspense>

        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle1" gutterBottom fontWeight={600}>
              {t("bridge.iconLabel")}
            </Typography>
            <BridgeIconUpload
              bridgeId={props.bridgeId}
              selectedIcon={(config as BridgeConfig)?.icon}
              onIconChange={handleIconChange}
            />
          </CardContent>
        </Card>

        <Grid container>
          <Grid size={{ xs: 6, sm: 4, md: 3 }}>
            <Button
              fullWidth
              variant="outlined"
              color="error"
              onClick={props.onCancel}
            >
              {t("common.cancel")}
            </Button>
          </Grid>
          <Grid
            size={{ xs: 0, sm: 4, md: 6 }}
            sx={{ display: { xs: "none", sm: "block" } }}
          />
          <Grid size={{ xs: 6, sm: 4, md: 3 }}>
            <Button
              fullWidth
              variant="outlined"
              disabled={!isValid}
              onClick={saveAction}
            >
              {t("common.save")}
            </Button>
          </Grid>
        </Grid>
      </Stack>
    </>
  );
};

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
import type { TFunction } from "i18next";
import type { JSONSchema7 } from "json-schema";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { navigation } from "../../routes.tsx";
import { FormEditor } from "../misc/editors/FormEditor";
import { JsonEditor } from "../misc/editors/JsonEditor";
import type { ValidationError } from "../misc/editors/validation-error.ts";
import { BridgeIconUpload } from "./BridgeIconUpload.tsx";
import { FilterPresetProvider } from "./FilterPresetContext.tsx";
import { FilterPreview } from "./FilterPreview.tsx";
import { FilterReferenceHelp } from "./FilterReferenceHelp.tsx";
import { BridgeObjectFieldTemplate } from "./rjsf/BridgeObjectFieldTemplate.tsx";
import { CompactArrayFieldTemplate } from "./rjsf/CompactArrayFieldTemplate.tsx";
import { EntityFilterRuleField } from "./rjsf/EntityFilterRuleField.tsx";
import { FeatureFlagsField } from "./rjsf/FeatureFlagsField.tsx";

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
            <FormEditor
              value={config ?? {}}
              onChange={onChange}
              schema={localizedSchema}
              uiSchema={{
                "ui:submitButtonOptions": {
                  submitText: t("common.save"),
                },
                icon: { "ui:widget": "hidden" },
                featureFlags: { "ui:field": "featureFlags" },
                filter: {
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
                },
              }}
              customValidate={validatePort}
              templates={{ ObjectFieldTemplate: BridgeObjectFieldTemplate }}
              fields={{
                featureFlags: FeatureFlagsField,
                entityFilterRule: EntityFilterRuleField,
              }}
            />
          </FilterPresetProvider>
        )}

        {editorMode === BridgeEditorMode.JSON_EDITOR && (
          <JsonEditor
            value={config ?? {}}
            onChange={onChange}
            schema={localizedSchema}
            customValidate={validatePort}
          />
        )}

        {(config as BridgeConfig)?.filter && (
          <FilterPreview filter={(config as BridgeConfig).filter} />
        )}

        <FilterReferenceHelp />

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

export function cloneSchema(schema: JSONSchema7): JSONSchema7 {
  return JSON.parse(JSON.stringify(schema)) as JSONSchema7;
}

function localizeBridgeConfigSchema(
  schema: JSONSchema7,
  t: TFunction,
): JSONSchema7 {
  const localized = cloneSchema(schema);
  const properties = localized.properties as
    | Record<string, JSONSchema7>
    | undefined;

  localized.title = t("bridgeConfig.title");

  if (!properties) return localized;

  localizeSchemaProperty(properties.name, t, "bridgeConfig.fields.name");
  localizeSchemaProperty(properties.port, t, "bridgeConfig.fields.port");
  localizeSchemaProperty(properties.icon, t, "bridgeConfig.fields.icon");
  localizeSchemaProperty(
    properties.countryCode,
    t,
    "bridgeConfig.fields.countryCode",
  );
  localizeSchemaProperty(
    properties.priority,
    t,
    "bridgeConfig.fields.priority",
  );
  localizeSchemaProperty(
    properties.serialNumberSuffix,
    t,
    "bridgeConfig.fields.serialNumberSuffix",
  );
  localizeSchemaProperty(
    properties.sessionMaxAgeHours,
    t,
    "bridgeConfig.fields.sessionMaxAgeHours",
  );

  localizeFilterSchema(properties.filter, t);

  return localized;
}

function localizeSchemaProperty(
  schema: JSONSchema7 | undefined,
  t: TFunction,
  key: string,
) {
  if (!schema) return;
  schema.title = t(`${key}.title`, { defaultValue: schema.title });
  if (schema.description) {
    schema.description = t(`${key}.description`, {
      defaultValue: schema.description,
    });
  }
}

export function localizeFilterSchema(
  schema: JSONSchema7 | undefined,
  t: TFunction,
) {
  if (!schema) return;
  schema.title = t("bridgeConfig.filter.title", {
    defaultValue: schema.title,
  });
  const filterProperties = schema.properties as
    | Record<string, JSONSchema7>
    | undefined;
  if (!filterProperties) return;

  localizeSchemaProperty(
    filterProperties.include,
    t,
    "bridgeConfig.filter.include",
  );
  localizeSchemaProperty(
    filterProperties.exclude,
    t,
    "bridgeConfig.filter.exclude",
  );
  localizeSchemaProperty(
    filterProperties.includeMode,
    t,
    "bridgeConfig.filter.includeMode",
  );
  if (filterProperties.includeMode) {
    (
      filterProperties.includeMode as JSONSchema7 & { enumNames?: string[] }
    ).enumNames = [
      t("bridgeConfig.filter.includeMode.options.any"),
      t("bridgeConfig.filter.includeMode.options.all"),
    ];
  }

  const matcherSchema = filterProperties.include?.items as
    | JSONSchema7
    | undefined;
  localizeMatcherSchema(matcherSchema, t);
  filterProperties.exclude.items = matcherSchema;
}

function localizeMatcherSchema(schema: JSONSchema7 | undefined, t: TFunction) {
  const properties = schema?.properties as
    | Record<string, JSONSchema7>
    | undefined;
  if (!properties) return;
  localizeSchemaProperty(properties.type, t, "bridgeConfig.filter.type");
  localizeSchemaProperty(properties.value, t, "bridgeConfig.filter.value");

  const oneOf = properties.type.oneOf as
    | Array<JSONSchema7 & { const?: string }>
    | undefined;
  for (const option of oneOf ?? []) {
    if (!option.const) continue;
    localizeSchemaProperty(
      option,
      t,
      `bridgeConfig.filter.matcherTypes.${option.const}`,
    );
  }
}

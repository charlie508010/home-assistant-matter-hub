import type { TFunction } from "i18next";
import type { JSONSchema7 } from "json-schema";

export function cloneSchema(schema: JSONSchema7): JSONSchema7 {
  return JSON.parse(JSON.stringify(schema)) as JSONSchema7;
}

export function localizeBridgeConfigSchema(
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

import type { JSONSchema7 } from "json-schema";
import { FormEditor } from "../misc/editors/FormEditor";
import type { ValidationError } from "../misc/editors/validation-error.ts";
import { BridgeObjectFieldTemplate } from "./rjsf/BridgeObjectFieldTemplate.tsx";
import { CompactArrayFieldTemplate } from "./rjsf/CompactArrayFieldTemplate.tsx";
import { EntityFilterRuleField } from "./rjsf/EntityFilterRuleField.tsx";
import { FeatureFlagsField } from "./rjsf/FeatureFlagsField.tsx";

export interface BridgeConfigFieldsFormProps {
  value: object;
  schema: JSONSchema7;
  onChange: (value: object | undefined, isValid: boolean) => void;
  validatePort: (value: object | undefined) => ValidationError[];
  submitText: string;
}

export function BridgeConfigFieldsForm(props: BridgeConfigFieldsFormProps) {
  return (
    <FormEditor
      value={props.value}
      onChange={props.onChange}
      schema={props.schema}
      uiSchema={{
        "ui:submitButtonOptions": {
          submitText: props.submitText,
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
      customValidate={props.validatePort}
      templates={{ ObjectFieldTemplate: BridgeObjectFieldTemplate }}
      fields={{
        featureFlags: FeatureFlagsField,
        entityFilterRule: EntityFilterRuleField,
      }}
    />
  );
}

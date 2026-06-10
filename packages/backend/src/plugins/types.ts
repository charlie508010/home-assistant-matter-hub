import type { Logger } from "@matter/general";
import type { DiagnosticEvent } from "@home-assistant-matter-hub/common";

/**
 * Configuration schema for plugin settings UI.
 * Uses a simplified JSON Schema subset for frontend rendering.
 */
export interface PluginConfigSchema {
  title: string;
  description?: string;
  externalPopup?: boolean;
  externalPopupUrl?: string;
  externalPopupButtonText?: string;
  properties: Record<
    string,
    {
      type: "string" | "number" | "boolean" | "select" | "secret";
      title: string;
      description?: string;
      default?: unknown;
      required?: boolean;
      options?: Array<{ label: string; value: string }>;
    }
  >;
}

/**
 * Cluster configuration for a plugin device.
 * Maps Matter cluster attributes and initial state.
 */
export interface PluginClusterConfig {
  clusterId: string;
  attributes: Record<string, unknown>;
}

/**
 * A device registered by a plugin.
 * The plugin creates these and registers them via the context.
 */
export interface PluginDevice {
  /** Unique ID within this plugin (e.g., "tuya_light_abc123") */
  id: string;
  /** Display name */
  name: string;
  /** Matter device type (e.g., "on_off_light", "thermostat", "temperature_sensor") */
  deviceType: string;
  /** Initial cluster configuration */
  clusters: PluginClusterConfig[];

  /** Called when a Matter controller writes an attribute on this device */
  onAttributeWrite?(
    clusterId: string,
    attribute: string,
    value: unknown,
  ): Promise<void>;
}

/**
 * Key-value storage scoped to a plugin instance.
 */
export interface PluginStorage {
  get<T>(key: string, defaultValue?: T): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

/**
 * A domain-to-device-type mapping registered by a plugin.
 * Allows plugins to tell HAMH how to handle HA domains that
 * are not natively supported, or to override existing mappings.
 */
export interface PluginDomainMapping {
  /** Home Assistant domain (e.g., "number", "timer") */
  domain: string;
  /** Matter device type key (must be in the supported device types list) */
  matterDeviceType: string;
  /** Default cluster state for newly created endpoints */
  defaultClusters?: PluginClusterConfig[];
}

/**
 * Context provided to plugins during their lifecycle.
 * This is the primary API surface for plugin authors.
 */
export interface PluginContext {
  /** Register a new device on this bridge */
  registerDevice(device: PluginDevice): Promise<void>;
  /** Remove a previously registered device */
  unregisterDevice(deviceId: string): Promise<void>;
  /** Update attributes on a registered device */
  updateDeviceState(
    deviceId: string,
    clusterId: string,
    attributes: Record<string, unknown>,
  ): void;

  /**
   * Register a domain mapping so HAMH maps HA entities of the given
   * domain to the specified Matter device type. This is checked before
   * the built-in domain mapping table.
   */
  registerDomainMapping(mapping: PluginDomainMapping): void;

  /** Persistent storage scoped to this plugin */
  storage: PluginStorage;
  /** Logger scoped to this plugin */
  log: Logger;
  /** ID of the bridge this plugin is attached to */
  bridgeId: string;

  /**
   * Subscribe to diagnostic events emitted by HAMH.
   *
   * The returned function unsubscribes the listener. Plugins should call it
   * during shutdown when they keep long-lived subscriptions.
   */
  subscribeDiagnosticEvents?(
    listener: (event: DiagnosticEvent) => void,
  ): () => void;
}

/**
 * The interface that all plugins must implement.
 *
 * A plugin is a "device provider", it discovers/creates devices and
 * registers them with the bridge via the PluginContext.
 */
export interface PluginUiStatus {
  status?: string;
  statusText?: string;
  statusColor?: "success" | "warning" | "error" | "info";
  matchedDevices?: number;
  totalDevices?: number;
  hideConfigButton?: boolean;
  externalPopup?: boolean;
  externalPopupUrl?: string;
  externalPopupButtonText?: string;
  externalPopupMode?: "open" | "saveThenOpen";
  tables?: Array<{
    id?: string;
    title?: string;
    show?: boolean;
    collapsible?: boolean;
    defaultCollapsed?: boolean;
    emptyText?: string;
    columns: Array<{
      key: string;
      label: string;
      width?: string;
      type?: "text" | "chip" | "boolean" | "status";
    }>;
    rows: Array<Record<string, unknown>>;
  }>;
  actions?: Array<{
    id: string;
    label: string;
    variant?: "text" | "contained" | "outlined";
    color?: "primary" | "error" | "warning" | "success";
    disabled?: boolean;
    tooltip?: string;
    confirmText?: string;
    refreshAfterAction?: boolean;
    externalPopupUrl?: string;
    externalPopupMode?: "open" | "saveThenOpen";
  }>;
}

export interface MatterHubPlugin {
  /** Unique plugin identifier (npm package name or built-in name) */
  readonly name: string;
  /** Semver version string */
  readonly version: string;

  /**
   * Called when the bridge starts. Use this to discover devices,
   * set up connections, and call context.registerDevice().
   */
  onStart(context: PluginContext): Promise<void>;

  /**
   * Called after all devices have been registered and the bridge
   * is fully operational. Use this to restore persistent state
   * or set initial attribute values.
   */
  onConfigure?(): Promise<void>;

  /**
   * Called when the bridge is shutting down. Clean up connections,
   * timers, and other resources.
   */
  onShutdown?(reason?: string): Promise<void>;

  /** Optional: JSON schema for plugin config UI */
  getConfigSchema?(): PluginConfigSchema;

  /** Optional: UI status shown on plugin page */
  getUiStatus?(): PluginUiStatus;

  /** Optional: handle plugin UI action button */
  onAction?(actionId: string): Promise<void>;

  /** Called when the user updates plugin config via the UI */
  onConfigChanged?(config: Record<string, unknown>): Promise<void>;
}

/**
 * Constructor type for plugin classes.
 * External plugins export their class as default export.
 */
export type MatterHubPluginConstructor = new (
  config: Record<string, unknown>,
) => MatterHubPlugin;

/**
 * Metadata about an installed plugin.
 */
export interface PluginMetadata {
  name: string;
  version: string;
  description?: string;
  author?: string;
  /** "builtin" for built-in plugins, npm package path for external */
  source: "builtin" | string;
  /** Whether the plugin is currently enabled */
  enabled: boolean;
  /** Plugin config (user-provided) */
  config: Record<string, unknown>;
}

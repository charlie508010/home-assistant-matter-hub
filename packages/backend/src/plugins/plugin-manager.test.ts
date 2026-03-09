import { describe, expect, it, vi } from "vitest";
import { PLUGIN_API_VERSION, PluginManager } from "./plugin-manager.js";
import type { MatterHubPlugin, PluginContext, PluginDevice } from "./types.js";

function createMockPlugin(
  overrides: Partial<MatterHubPlugin> = {},
): MatterHubPlugin {
  return {
    name: overrides.name ?? "test-plugin",
    version: overrides.version ?? "1.0.0",
    onStart: overrides.onStart ?? (async () => {}),
    onConfigure: overrides.onConfigure,
    onShutdown: overrides.onShutdown,
    getConfigSchema: overrides.getConfigSchema,
    onConfigChanged: overrides.onConfigChanged,
  };
}

describe("PluginManager", () => {
  const storageDir = `/tmp/hamh-test-plugins-${Date.now()}`;

  describe("registerBuiltIn", () => {
    it("should register a built-in plugin", async () => {
      const pm = new PluginManager("bridge-1", storageDir);
      const plugin = createMockPlugin();
      await pm.registerBuiltIn(plugin);

      const metadata = pm.getMetadata();
      expect(metadata).toHaveLength(1);
      expect(metadata[0].name).toBe("test-plugin");
      expect(metadata[0].source).toBe("builtin");
      expect(metadata[0].enabled).toBe(true);
    });

    it("should reject duplicate plugin names", async () => {
      const pm = new PluginManager("bridge-1", storageDir);
      await pm.registerBuiltIn(createMockPlugin());
      await expect(pm.registerBuiltIn(createMockPlugin())).rejects.toThrow(
        "already registered",
      );
    });
  });

  describe("lifecycle", () => {
    it("should call onStart for all plugins", async () => {
      const pm = new PluginManager("bridge-1", storageDir);
      const onStart = vi.fn(async () => {});
      await pm.registerBuiltIn(createMockPlugin({ onStart }));
      await pm.startAll();
      expect(onStart).toHaveBeenCalledTimes(1);
    });

    it("should call onConfigure for all plugins", async () => {
      const pm = new PluginManager("bridge-1", storageDir);
      const onConfigure = vi.fn(async () => {});
      await pm.registerBuiltIn(createMockPlugin({ onConfigure }));
      await pm.startAll();
      await pm.configureAll();
      expect(onConfigure).toHaveBeenCalledTimes(1);
    });

    it("should call onShutdown for all plugins", async () => {
      const pm = new PluginManager("bridge-1", storageDir);
      const onShutdown = vi.fn(async () => {});
      await pm.registerBuiltIn(createMockPlugin({ onShutdown }));
      await pm.startAll();
      await pm.shutdownAll("test");
      expect(onShutdown).toHaveBeenCalledWith("test");
    });
  });

  describe("device registration", () => {
    it("should register a valid device and fire callback", async () => {
      const pm = new PluginManager("bridge-1", storageDir);
      const registeredDevices: Array<{ name: string; device: PluginDevice }> =
        [];
      pm.onDeviceRegistered = async (name, device) => {
        registeredDevices.push({ name, device });
      };

      await pm.registerBuiltIn(
        createMockPlugin({
          onStart: async (ctx: PluginContext) => {
            await ctx.registerDevice({
              id: "dev-1",
              name: "Test Device",
              deviceType: "on_off_light",
              clusters: [{ clusterId: "onOff", attributes: { onOff: false } }],
            });
          },
        }),
      );

      await pm.startAll();

      expect(registeredDevices).toHaveLength(1);
      expect(registeredDevices[0].name).toBe("test-plugin");
      expect(registeredDevices[0].device.id).toBe("dev-1");
    });

    it("should reject device with invalid deviceType", async () => {
      const pm = new PluginManager("bridge-1", storageDir);
      const registeredDevices: PluginDevice[] = [];
      pm.onDeviceRegistered = async (_name, device) => {
        registeredDevices.push(device);
      };

      await pm.registerBuiltIn(
        createMockPlugin({
          onStart: async (ctx: PluginContext) => {
            await ctx.registerDevice({
              id: "dev-1",
              name: "Bad Device",
              deviceType: "invalid_type",
              clusters: [],
            });
          },
        }),
      );

      await pm.startAll();
      expect(registeredDevices).toHaveLength(0);
    });

    it("should reject device with empty id", async () => {
      const pm = new PluginManager("bridge-1", storageDir);
      const registeredDevices: PluginDevice[] = [];
      pm.onDeviceRegistered = async (_name, device) => {
        registeredDevices.push(device);
      };

      await pm.registerBuiltIn(
        createMockPlugin({
          onStart: async (ctx: PluginContext) => {
            await ctx.registerDevice({
              id: "",
              name: "No ID",
              deviceType: "on_off_light",
              clusters: [],
            });
          },
        }),
      );

      await pm.startAll();
      expect(registeredDevices).toHaveLength(0);
    });

    it("should reject device with missing name", async () => {
      const pm = new PluginManager("bridge-1", storageDir);
      const registeredDevices: PluginDevice[] = [];
      pm.onDeviceRegistered = async (_name, device) => {
        registeredDevices.push(device);
      };

      await pm.registerBuiltIn(
        createMockPlugin({
          onStart: async (ctx: PluginContext) => {
            await ctx.registerDevice({
              id: "dev-1",
              name: "",
              deviceType: "on_off_light",
              clusters: [],
            });
          },
        }),
      );

      await pm.startAll();
      expect(registeredDevices).toHaveLength(0);
    });
  });

  describe("state updates", () => {
    it("should forward device state updates via callback", async () => {
      const pm = new PluginManager("bridge-1", storageDir);
      const updates: Array<{
        pluginName: string;
        deviceId: string;
        clusterId: string;
        attributes: Record<string, unknown>;
      }> = [];

      pm.onDeviceRegistered = async () => {};
      pm.onDeviceStateUpdated = (pluginName, deviceId, clusterId, attrs) => {
        updates.push({ pluginName, deviceId, clusterId, attributes: attrs });
      };

      let savedCtx: PluginContext | undefined;
      await pm.registerBuiltIn(
        createMockPlugin({
          onStart: async (ctx: PluginContext) => {
            savedCtx = ctx;
            await ctx.registerDevice({
              id: "dev-1",
              name: "Test",
              deviceType: "temperature_sensor",
              clusters: [
                {
                  clusterId: "temperatureMeasurement",
                  attributes: { measuredValue: 2000 },
                },
              ],
            });
          },
        }),
      );

      await pm.startAll();
      savedCtx!.updateDeviceState("dev-1", "temperatureMeasurement", {
        measuredValue: 2500,
      });

      expect(updates).toHaveLength(1);
      expect(updates[0].attributes).toEqual({ measuredValue: 2500 });
    });
  });

  describe("config", () => {
    it("should return config schema from plugin", async () => {
      const pm = new PluginManager("bridge-1", storageDir);
      await pm.registerBuiltIn(
        createMockPlugin({
          getConfigSchema: () => ({
            title: "Test Config",
            properties: { interval: { type: "number", title: "Interval" } },
          }),
        }),
      );

      const schema = pm.getConfigSchema("test-plugin");
      expect(schema).toBeDefined();
      expect(schema?.properties).toBeDefined();
    });

    it("should call onConfigChanged when config is updated", async () => {
      const pm = new PluginManager("bridge-1", storageDir);
      const onConfigChanged = vi.fn(async () => {});
      await pm.registerBuiltIn(createMockPlugin({ onConfigChanged }));
      await pm.startAll();

      const ok = await pm.updateConfig("test-plugin", { interval: 5000 });
      expect(ok).toBe(true);
      expect(onConfigChanged).toHaveBeenCalledWith({ interval: 5000 });
    });
  });

  describe("enable/disable/reset", () => {
    it("should disable and re-enable a plugin", async () => {
      const pm = new PluginManager("bridge-1", storageDir);
      await pm.registerBuiltIn(createMockPlugin());

      pm.disablePlugin("test-plugin");
      expect(pm.getMetadata()[0].enabled).toBe(false);

      pm.enablePlugin("test-plugin");
      expect(pm.getMetadata()[0].enabled).toBe(true);
    });
  });

  it("should export PLUGIN_API_VERSION", () => {
    expect(PLUGIN_API_VERSION).toBe(1);
  });
});

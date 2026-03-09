import { describe, expect, it } from "vitest";
import {
  type MatterbridgeEndpointLike,
  MatterbridgePluginAdapter,
  type MatterbridgePluginFactory,
} from "./matterbridge-adapter.js";
import type { PluginContext, PluginDevice } from "./types.js";

function createMockContext(): PluginContext & {
  registered: PluginDevice[];
} {
  const registered: PluginDevice[] = [];
  return {
    registered,
    bridgeId: "test-bridge",
    storage: {
      get: async () => undefined,
      set: async () => {},
      delete: async () => {},
      keys: async () => [],
    },
    log: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    } as unknown as PluginContext["log"],
    registerDevice: async (device: PluginDevice) => {
      registered.push(device);
    },
    unregisterDevice: async () => {},
    updateDeviceState: () => {},
  };
}

describe("MatterbridgePluginAdapter", () => {
  describe("cluster ID mapping", () => {
    it("should map numeric cluster IDs to behavior keys", async () => {
      const endpoints: MatterbridgeEndpointLike[] = [];

      const factory: MatterbridgePluginFactory = (_mb, _log, _config) => ({
        onStart: async () => {},
        registerDevice: async (ep: MatterbridgeEndpointLike) => {
          endpoints.push(ep);
        },
      });

      const adapter = new MatterbridgePluginAdapter(factory, {
        name: "test-mb-plugin",
      });
      const ctx = createMockContext();
      await adapter.onStart(ctx);

      // Simulate the Matterbridge plugin registering a device
      const mbPlugin = (
        adapter as unknown as {
          mbPlugin: {
            registerDevice: (ep: MatterbridgeEndpointLike) => Promise<void>;
          };
        }
      ).mbPlugin;
      await mbPlugin.registerDevice({
        uniqueId: "mb-device-1",
        deviceName: "MB Light",
        deviceTypes: [{ code: 0x100, name: "MA-onofflight" }],
        clusterServersObjs: [
          { clusterId: 6, attributes: { onOff: true } },
          { clusterId: 8, attributes: { currentLevel: 128 } },
        ],
      });

      expect(ctx.registered).toHaveLength(1);
      const device = ctx.registered[0];
      expect(device.deviceType).toBe("on_off_light");

      // Verify cluster IDs are mapped to behavior keys
      const clusterIds = device.clusters.map((c) => c.clusterId);
      expect(clusterIds).toContain("onOff");
      expect(clusterIds).toContain("levelControl");
      expect(clusterIds).not.toContain("6");
      expect(clusterIds).not.toContain("8");
    });
  });

  describe("device type code mapping", () => {
    it("should map device type code 0x100 to on_off_light", async () => {
      const factory: MatterbridgePluginFactory = (_mb, _log, _config) => ({
        onStart: async () => {},
      });
      const adapter = new MatterbridgePluginAdapter(factory, {
        name: "test-mb-plugin",
      });
      const ctx = createMockContext();
      await adapter.onStart(ctx);

      const mbPlugin = (
        adapter as unknown as {
          mbPlugin: {
            registerDevice: (ep: MatterbridgeEndpointLike) => Promise<void>;
          };
        }
      ).mbPlugin;
      await mbPlugin.registerDevice({
        uniqueId: "dev-light",
        deviceName: "Light",
        deviceTypes: [{ code: 0x100 }],
        clusterServersObjs: [],
      });

      expect(ctx.registered).toHaveLength(1);
      expect(ctx.registered[0].deviceType).toBe("on_off_light");
    });

    it("should map device type code 0x302 to temperature_sensor", async () => {
      const factory: MatterbridgePluginFactory = (_mb, _log, _config) => ({
        onStart: async () => {},
      });
      const adapter = new MatterbridgePluginAdapter(factory, {
        name: "test-mb-plugin",
      });
      const ctx = createMockContext();
      await adapter.onStart(ctx);

      const mbPlugin = (
        adapter as unknown as {
          mbPlugin: {
            registerDevice: (ep: MatterbridgeEndpointLike) => Promise<void>;
          };
        }
      ).mbPlugin;
      await mbPlugin.registerDevice({
        uniqueId: "dev-temp",
        deviceName: "Temp",
        deviceTypes: [{ code: 0x302 }],
        clusterServersObjs: [],
      });

      expect(ctx.registered).toHaveLength(1);
      expect(ctx.registered[0].deviceType).toBe("temperature_sensor");
    });

    it("should fall back to on_off_plugin_unit for unknown device types", async () => {
      const factory: MatterbridgePluginFactory = (_mb, _log, _config) => ({
        onStart: async () => {},
      });
      const adapter = new MatterbridgePluginAdapter(factory, {
        name: "test-mb-plugin",
      });
      const ctx = createMockContext();
      await adapter.onStart(ctx);

      const mbPlugin = (
        adapter as unknown as {
          mbPlugin: {
            registerDevice: (ep: MatterbridgeEndpointLike) => Promise<void>;
          };
        }
      ).mbPlugin;
      await mbPlugin.registerDevice({
        uniqueId: "dev-unknown",
        deviceName: "Unknown",
        deviceTypes: [{ code: 0xffff }],
        clusterServersObjs: [],
      });

      expect(ctx.registered).toHaveLength(1);
      expect(ctx.registered[0].deviceType).toBe("on_off_plugin_unit");
    });

    it("should skip devices without ID", async () => {
      const factory: MatterbridgePluginFactory = (_mb, _log, _config) => ({
        onStart: async () => {},
      });
      const adapter = new MatterbridgePluginAdapter(factory, {
        name: "test-mb-plugin",
      });
      const ctx = createMockContext();
      await adapter.onStart(ctx);

      const mbPlugin = (
        adapter as unknown as {
          mbPlugin: {
            registerDevice: (ep: MatterbridgeEndpointLike) => Promise<void>;
          };
        }
      ).mbPlugin;
      await mbPlugin.registerDevice({
        clusterServersObjs: [],
      });

      expect(ctx.registered).toHaveLength(0);
    });
  });

  describe("unknown cluster IDs", () => {
    it("should skip clusters with unknown numeric IDs", async () => {
      const factory: MatterbridgePluginFactory = (_mb, _log, _config) => ({
        onStart: async () => {},
      });
      const adapter = new MatterbridgePluginAdapter(factory, {
        name: "test-mb-plugin",
      });
      const ctx = createMockContext();
      await adapter.onStart(ctx);

      const mbPlugin = (
        adapter as unknown as {
          mbPlugin: {
            registerDevice: (ep: MatterbridgeEndpointLike) => Promise<void>;
          };
        }
      ).mbPlugin;
      await mbPlugin.registerDevice({
        uniqueId: "dev-mixed",
        deviceName: "Mixed",
        deviceTypes: [{ code: 0x100 }],
        clusterServersObjs: [
          { clusterId: 6, attributes: { onOff: false } },
          { clusterId: 99999, attributes: {} },
        ],
      });

      expect(ctx.registered).toHaveLength(1);
      expect(ctx.registered[0].clusters).toHaveLength(1);
      expect(ctx.registered[0].clusters[0].clusterId).toBe("onOff");
    });
  });
});

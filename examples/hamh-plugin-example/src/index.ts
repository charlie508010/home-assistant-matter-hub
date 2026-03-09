/**
 * Example HAMH Plugin — Virtual Temperature Sensor
 *
 * This plugin registers a virtual temperature sensor on the bridge
 * and simulates periodic temperature changes. Use it as a starting
 * point for building your own HAMH plugins.
 *
 * Supported device types:
 *   on_off_light, dimmable_light, on_off_plugin_unit,
 *   temperature_sensor, humidity_sensor, light_sensor,
 *   occupancy_sensor, contact_sensor, thermostat, door_lock, fan
 */

interface PluginStorage {
  get<T>(key: string, defaultValue?: T): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

interface PluginContext {
  registerDevice(device: PluginDevice): Promise<void>;
  unregisterDevice(deviceId: string): Promise<void>;
  updateDeviceState(
    deviceId: string,
    clusterId: string,
    attributes: Record<string, unknown>,
  ): void;
  storage: PluginStorage;
  log: {
    info(...args: unknown[]): void;
    warn(...args: unknown[]): void;
    error(...args: unknown[]): void;
    debug(...args: unknown[]): void;
  };
  bridgeId: string;
}

interface PluginDevice {
  id: string;
  name: string;
  deviceType: string;
  clusters: Array<{ clusterId: string; attributes: Record<string, unknown> }>;
  onAttributeWrite?(
    clusterId: string,
    attribute: string,
    value: unknown,
  ): Promise<void>;
}

export default class ExamplePlugin {
  readonly name = "hamh-plugin-example";
  readonly version = "1.0.0";

  private context?: PluginContext;
  private interval?: ReturnType<typeof setInterval>;

  async onStart(context: PluginContext): Promise<void> {
    this.context = context;
    context.log.info("Example plugin starting...");

    await context.registerDevice({
      id: "example-temp-1",
      name: "Example Temperature",
      deviceType: "temperature_sensor",
      clusters: [
        {
          clusterId: "temperatureMeasurement",
          attributes: { measuredValue: 2150 }, // 21.50 °C (Matter uses 0.01 °C units)
        },
      ],
      onAttributeWrite: async (clusterId, attribute, value) => {
        context.log.info(
          `Attribute write: ${clusterId}.${attribute} = ${JSON.stringify(value)}`,
        );
      },
    });

    // Simulate temperature changes every 30 seconds
    this.interval = setInterval(() => {
      const temp = 2000 + Math.round(Math.random() * 500); // 20.00–25.00 °C
      context.updateDeviceState("example-temp-1", "temperatureMeasurement", {
        measuredValue: temp,
      });
    }, 30_000);

    context.log.info("Example plugin started");
  }

  async onConfigure(): Promise<void> {
    // Restore persisted state if needed
    const lastTemp = await this.context?.storage.get<number>("lastTemp");
    if (lastTemp != null) {
      this.context?.updateDeviceState(
        "example-temp-1",
        "temperatureMeasurement",
        { measuredValue: lastTemp },
      );
    }
  }

  async onShutdown(): Promise<void> {
    if (this.interval) clearInterval(this.interval);
    this.context?.log.info("Example plugin shut down");
  }
}

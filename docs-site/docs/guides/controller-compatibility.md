# Controller Compatibility Matrix

This page documents which Matter device types work with which controllers, based on community testing and official documentation.

:::info
Compatibility depends on controller firmware versions. This matrix reflects the latest known state. If you find discrepancies, please open an issue.
:::

## Device Type Support

| HA Domain | Matter Device Type | Apple Home | Google Home | Alexa | SmartThings |
|---|---|:---:|:---:|:---:|:---:|
| `light` | OnOffLight | ✅ | ✅ | ✅ | ✅ |
| `light` | DimmableLight | ✅ | ✅ | ✅ | ✅ |
| `light` | ColorTemperatureLight | ✅ | ✅ | ✅ | ✅ |
| `light` | ExtendedColorLight | ✅ | ✅ | ✅ | ✅ |
| `switch` | OnOffPlugInUnit | ✅ | ✅ | ✅ | ✅ |
| `switch` | DimmablePlugInUnit | ✅ | ✅ | ✅ | ✅ |
| `lock` | DoorLock | ✅ | ✅ | ✅ | ✅ |
| `cover` | WindowCovering | ✅ | ✅ | ✅ | ✅ |
| `climate` | Thermostat | ✅ | ✅ | ✅ | ✅ |
| `fan` | Fan | ✅ | ✅ | ✅ | ⚠️ |
| `sensor` | TemperatureSensor | ✅ | ✅ | ✅ | ✅ |
| `sensor` | HumiditySensor | ✅ | ✅ | ✅ | ✅ |
| `sensor` | PressureSensor | ✅ | ❓ | ❓ | ✅ |
| `sensor` | IlluminanceSensor | ✅ | ❓ | ❓ | ✅ |
| `sensor` | FlowSensor | ❓ | ❓ | ❓ | ❓ |
| `sensor` | AirQualitySensor | ✅ | ❓ | ❓ | ❓ |
| `sensor` | ElectricalSensor | ❓ | ❓ | ❓ | ❓ |
| `binary_sensor` | ContactSensor | ✅ | ✅ | ✅ | ✅ |
| `binary_sensor` | OccupancySensor | ✅ | ✅ | ✅ | ✅ |
| `binary_sensor` | SmokeCoAlarm | ✅ | ✅ | ✅ | ✅ |
| `binary_sensor` | WaterLeakDetector | ✅ | ✅ | ✅ | ✅ |
| `binary_sensor` | WaterFreezeDetector | ❓ | ❓ | ❓ | ❓ |
| `media_player` | Speaker | ❓ | ❓ | ❓ | ❓ |
| `media_player` | BasicVideoPlayer | ❓ | ❓ | ❓ | ❓ |
| `valve` | WaterValve | ✅ | ❓ | ❓ | ❓ |
| `vacuum` | RoboticVacuumCleaner | ✅ | ❓ | ✅* | ❓ |
| `water_heater` | Thermostat | ✅ | ✅ | ✅ | ❓ |
| `alarm_control_panel` | ModeSelect | ❓ | ❓ | ❓ | ❓ |
| `select` | ModeSelect | ❓ | ❓ | ❓ | ❓ |
| `event` | GenericSwitch | ✅ | ❓ | ❓ | ❓ |
| `humidifier` | Fan | ✅ | ✅ | ✅ | ❓ |

### Legend

- ✅ = Confirmed working
- ⚠️ = Partial support or known issues
- ❓ = Untested or unknown
- ❌ = Not supported by the controller

\* Alexa vacuum support requires the `vacuumOnOff` feature flag enabled.

## Controller Profiles

HAMH includes built-in controller profiles that pre-configure feature flags for optimal compatibility:

| Profile | Key Settings |
|---|---|
| **Apple Home** | `autoForceSync: true`, `coverUseHomeAssistantPercentage: true` |
| **Google Home** | `autoForceSync: true` |
| **Alexa** | `autoForceSync: true`, `vacuumOnOff: true` |
| **Multi-Controller** | `autoForceSync: true`, `vacuumOnOff: true`, `coverUseHomeAssistantPercentage: true` |

See [Bridge Configuration](../getting-started/bridge-configuration.md) for details on how to select a profile.

## Official Controller Documentation

- **Alexa**: [Matter Support](https://developer.amazon.com/en-US/docs/alexa/smarthome/matter-support.html#device-categories-and-clusters)
- **Google Home**: [Supported Devices](https://developers.home.google.com/matter/supported-devices#device_type_and_control_support)
- **Apple Home**: [Matter Accessories](https://support.apple.com/en-us/102135)
- **SmartThings**: [Supported Device Types](https://developer.smartthings.com/docs/devices/hub-connected/matter/matter-device-types)

## Contributing

If you have tested a device type with a controller not marked above, please open an issue or PR with your findings. Include:
- Controller name and firmware version
- Device type tested
- Whether it works, partially works, or doesn't work
- Any specific issues encountered

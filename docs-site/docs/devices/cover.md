# Cover / Window Covering

Home Assistant `cover` entities are mapped to Matter **WindowCovering** devices with position and tilt control.

## Features

| HA Feature | Matter Capability |
|------------|------------------|
| `open` / `close` | Open/Close commands |
| `set_position` | Lift percentage (0-100%) |
| `set_tilt_position` | Tilt percentage (0-100%) |
| `stop` | Stop movement |

## Supported Device Classes

The following `device_class` values are supported:

- `blind`
- `curtain`
- `shade`
- `shutter`
- `awning`
- `window` (Velux-style motorized windows; mapped to lift-only Rollershade)
- `garage` (limited support)

Covers without a device class or with unsupported classes are still exposed as generic WindowCovering devices.

## Feature Flags

These flags are configured in **Bridge Settings** and apply to all covers on that bridge:

| Flag | Description |
|------|-------------|
| `coverDoNotInvertPercentage` | Skip percentage inversion. By default, HAMH inverts the percentage to match the Matter spec (0% = fully open, 100% = fully closed). Enable this if your cover already uses the Matter convention. **Not Matter compliant** when disabled. |
| `coverUseHomeAssistantPercentage` | Display HA percentages directly in Matter without conversion. Useful for Alexa where percentage display may be confusing otherwise. |
| `coverSwapOpenClose` | Swap open and close commands. Fixes reversed commands from Alexa where "open" closes the cover and vice versa. |

## Percentage Mapping

Matter and Home Assistant use opposite percentage conventions:

| Percentage | HA Meaning | Matter Meaning |
|-----------|------------|----------------|
| 0% | Fully closed | Fully open |
| 100% | Fully open | Fully closed |

By default, HAMH inverts the percentage to comply with the Matter specification. Use the feature flags above if your setup requires different behavior.

## Compatibility

| Controller | Open/Close | Position | Tilt | Stop |
|------------|-----------|----------|------|------|
| Apple Home | ✅ | ✅ | ✅ | ✅ |
| Google Home | ✅ | ✅ | ⚠️ | ✅ |
| Amazon Alexa | ✅ | ✅ | ⚠️ | ✅ |

> Tilt support varies by controller. Apple Home has the best tilt control support.

## Troubleshooting

### Alexa commands are reversed (open → close)

Enable the `coverSwapOpenClose` feature flag in your bridge settings. This is a known Alexa behavior where the open/close direction is reversed for Matter WindowCovering devices.

### Percentage shows wrong value in Alexa

Try enabling `coverUseHomeAssistantPercentage` in bridge settings. Alexa may interpret the Matter percentage differently than other controllers.

### Cover cannot be used in Google Home Automations

Google Home does not support WindowCovering devices as actions in Automations. When selecting a cover, "no actions available" is shown. This is a Google Home limitation that also affects native Matter blinds.

**Workarounds:**
1. Use Google Home Routines with voice commands ("Hey Google, close [cover name]")
2. Create Home Assistant scripts and expose them as switches via HAMH
3. Use Home Assistant automations instead

### Cover doesn't appear in Alexa routine picker after changing `device_class`

Matter `Type` and `EndProductType` are spec-defined as fixed attributes, controllers cache them at commissioning and don't re-read after that. So changing `device_class` in HA doesn't move the cover into a different Alexa sub-category (`Tapparelle interne`, `Tendine`, `Tende`, `Tende da sole`, etc.) on its own. After fixing `device_class`, restart HAMH and remove + re-add the bridge in the Alexa app for the routine picker to re-categorize.

### Position not updating

Check that your HA entity reports `current_position` correctly in Developer Tools → States. Some cover integrations don't report position during movement, the position will update once movement stops.

### Garage door limitations

Garage doors are exposed as WindowCovering devices since Matter does not have a dedicated garage door device type. Not all controllers handle this well. Consider using a `switch` entity with Entity Mapping override instead if you only need open/close control.

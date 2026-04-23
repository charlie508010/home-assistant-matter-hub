# Home-Assistant-Matter-Hub

!["Home-Assistant-Matter-Hub"](/img/hamh-logo-small.png)

---

> **Community Fork** - This is a fork of the original [t0bst4r/home-assistant-matter-hub](https://github.com/t0bst4r/home-assistant-matter-hub), which was discontinued in January 2026. We continue active development with bug fixes, new features, and community support.
>
> We actively work on fixing old issues from the original project and welcome new feature requests. This is a living project maintained by the community!

---

This project simulates bridges to publish your entities from Home Assistant to any Matter-compatible controller like
Alexa, Apple Home or Google Home. Using Matter, those can be connected easily using local communication without the need
of port forwarding etc.

---

## Known issues and limitations

### Device Type Support

This project does not yet support all available device types in the matter specification.
In addition, controllers like Alexa or Google Home do not support all device types, too.

To check which types are supported, please review the
[list of supported device types](./supported-device-types.md).

### Alexa

- Alexa cannot pair with a bridge which has too many devices attached. It seems to have a limit of
  about 80-100 devices
- Alexa needs at least one Amazon device which supports Matter to pair with a Matter device.
  If you only have a third party smart speaker which supports Alexa, this isn't enough.

### Google Home

- Google Home needs an actual Google Hub to connect a Matter device. Just using the GH app isn't enough.
- Google Home can deny the Matter device under certain conditions because it is not a certified Matter
  device. You need to follow
  [this guide](https://github.com/project-chip/matter.js/blob/main/docs/ECOSYSTEMS.md#google-home-ecosystem)
  to register your hub.

### Network setup

The Matter protocol is designed to work best with UDP and IPv6 within your local network. At the moment some
manufacturers built their controllers to be compatible with IPv4, too, but this can break at any time with any update.

Many users report connection issues when using VLANs or firewalls, where HAMH and the assistant devices (Alexa, Google
Home, ...) are not placed in the same network segment. Please make sure to review the
[common connectivity issues](./guides/connectivity-issues.md).

## What's New

<details>
<summary><strong>📦 Stable (v2.0.41) - Current</strong></summary>

**New in v2.0.41:**

| Feature | Description |
|---------|-------------|
| 🌡️ Google Home AC offline fix | `DeadFrontBehavior` on climate OnOff cluster so RoomAirConditioner stops showing offline on Google Home ([#302](https://github.com/RiDDiX/home-assistant-matter-hub/issues/302)) |
| 🪟 Cover device_class mapping | Map HA `garage`/`gate`/`window`/`awning`/etc. to the matching Matter WindowCovering type so voice commands hit the right device type ([#304](https://github.com/RiDDiX/home-assistant-matter-hub/issues/304)) |
| 📺 LG TV commissioning patch | Local patch on matter.js 0.16.11 to accept long NOC operational cert serials ([#305](https://github.com/RiDDiX/home-assistant-matter-hub/issues/305)) |
| 💡 Alexa brightness-reset behind flag | Old Alexa brightness-reset heuristic moved behind `alexaPreserveBrightnessOnTurnOn`, default off — Apple Home "set room to 100%" works again ([#306](https://github.com/RiDDiX/home-assistant-matter-hub/issues/306)) |
| 🌀 Google Home fan speed | Uses `fan.set_percentage` so already-on fans pick up speed changes from Google Home ([#308](https://github.com/RiDDiX/home-assistant-matter-hub/issues/308)) |
| ❄️ Climate auto mode | Expose Matter Auto mode when HA reports `auto` in `hvac_modes` ([#309](https://github.com/RiDDiX/home-assistant-matter-hub/issues/309)) |
| 🆔 Server-mode root identity | Root identity now applies as a single transaction, so controllers don't drop devices mid-swap ([#311](https://github.com/RiDDiX/home-assistant-matter-hub/issues/311)) |
| 🪟 Lift-only blinds | No more `TiltBlindTiltOnly` on covers without tilt — fixes Alexa routines for roller blinds ([#312](https://github.com/RiDDiX/home-assistant-matter-hub/issues/312)) |
| 🏷️ Per-entity `disableClimateOnOff` | Turn off the OnOff cluster on climate endpoints per entity for controllers that prefer mode-only control |
| 🔢 `serialNumberSuffix` per bridge | Append a suffix to every entity serial — useful if controllers like Aqara cache stale device data |
| 📝 `protocolLogLevel` option | Quiet matter.js logs independently from the app log level |
| 🖥️ Bridge HW/SW version strings | HA device-registry `hw_version`/`sw_version` now show up in Matter BasicInformation on server-mode endpoints |
| 🎨 Extended color light: XY + enhancedColorMode | XY feature added as mandatory, `enhancedColorMode` mirrors `colorMode` |
| 🎭 Groups + Scenes | Scenes and Groups clusters added on light, plug, and fan endpoints |
| 💧 Boolean state configuration | Cluster added on leak, freeze, rain, and contact sensors |
| 🌍 Spanish translation | New `es` locale ([#314](https://github.com/RiDDiX/home-assistant-matter-hub/pull/314), thanks [@Yllelder](https://github.com/Yllelder)) |
| 🧵 Matter.js 0.16.11 (pinned) | Kept pinned, local NOC serial patch applied |
| ⬆️ Dep bumps | Vite 8, jsdom 29, MUI x-tree-view 9, i18next 26, react-i18next 17, TypeScript 6.0.3, biome pinned 2.4.3, pnpm overrides for transitive CVEs |

**Reliability & resilience:** parallel bridge stop in `stopAll`/`restartAll`, parallel HA registry fetches, serialized bridge start/stop lifecycle, serialized `updateStates` with plugin listener detach, HA reconnect retry on transient network errors, 30s timeout on `sendMessagePromise`, port-conflict reject on web-api start, graceful shutdown on `/api/backup/restart`, `AppEnvironment` disposal on SIGINT, stale optimistic state sweep, pending debouncer clear, healthcheck 401 fix under basic auth, deep-equal entity attribute comparison, overlap guard for auto-refresh, safer mireds conversion, aligned `colorMode` publishing, surfaced bridge import errors, corrected thermostat running state for unknown modes + drying, unified Node version across Dockerfiles, sourcemaps excluded from npm tarball, unused deps dropped (rxjs, strip-color, lodash), unused `config-validator` utility removed.

**Previously in v2.0.39 & v2.0.40 (hotfix releases):**
- Fixed crash loop on startup caused by Node 22 native WebSocket dropping connections ([#297](https://github.com/RiDDiX/home-assistant-matter-hub/issues/297), [#299](https://github.com/RiDDiX/home-assistant-matter-hub/issues/299)) — affects both aarch64 (RPi) and amd64
- Fixed service initialization errors being silently swallowed, causing the process to hang instead of exiting
- Registry fetch now waits for WebSocket reconnect between retries and has increased retry tolerance
- Fixed `select`, `input_select`, `siren` domains showing as unsupported in filter preview ([#298](https://github.com/RiDDiX/home-assistant-matter-hub/issues/298))

**Previously in v2.0.38:**

| Feature | Description |
|---------|-------------|
| **🏷️ Per-Entity Identity Overrides** | `customProductName`, `customVendorName`, `customSerialNumber` per entity mapping ([#277](https://github.com/RiDDiX/home-assistant-matter-hub/issues/277), [#290](https://github.com/RiDDiX/home-assistant-matter-hub/issues/290)) |
| **🪟 Garage & Gate Open/Close** | Discrete Open/Close mode for garage and gate covers ([#55](https://github.com/RiDDiX/home-assistant-matter-hub/issues/55)) |
| **🚿 Dishwasher Device Type** | Dishwasher override for switch entities |
| **🚨 Siren Support** | Siren domain as OnOff Plug-in Unit |
| **🏷️ productNameFromNodeLabel Flag** | Report node label as Matter productName for Aqara controllers |
| **🤖 Vacuum Room Progress** | Dynamic room progress tracking via `currentRoomEntity` sensor |
| **⚡ Startup Force Sync** | Immediate force sync on startup to beat stale Alexa queues ([#282](https://github.com/RiDDiX/home-assistant-matter-hub/pull/282)) |
| **🌐 Network Diagnostic API** | mDNS/network diagnostic endpoint with dashboard card |
| **🔌 Energy on Composed Devices** | Energy/power measurement clusters on composed endpoints |
| **🩺 Multi-Admin Fabric Diagnostics** | Per-fabric session info in health API |
| **🩺 Docker HEALTHCHECK** | Native healthcheck in standalone and addon images |
| **🔒 Admin Password Hashing** | Admin password stored hashed, `timingSafeEqual` for lock PIN verification |
| **🧵 Matter.js 0.16.11** | Updated Matter stack |
| **🌍 Polish + Traditional Chinese** | New `pl` and `zh-tw` locales |

**Fix highlights:** vacuum keepalive for Apple Home "Updating…" ([#287](https://github.com/RiDDiX/home-assistant-matter-hub/issues/287)), multi-phase clean progress ([#281](https://github.com/RiDDiX/home-assistant-matter-hub/issues/281)), GenericSwitch single/multi split for Apple Home buttons ([#289](https://github.com/RiDDiX/home-assistant-matter-hub/issues/289)), HA restart attribute guards ([#286](https://github.com/RiDDiX/home-assistant-matter-hub/issues/286)), fan speed restore on turn-on ([#275](https://github.com/RiDDiX/home-assistant-matter-hub/issues/275)), moisture sensor auto-map to HumiditySensor ([#273](https://github.com/RiDDiX/home-assistant-matter-hub/issues/273)), TV speaker override ([#293](https://github.com/RiDDiX/home-assistant-matter-hub/issues/293)), rain + radon sensor auto-mapping, composed sub-endpoint cleanup.

**Previously in v2.0.36:**

| Feature | Description |
|---------|-------------|
| **🏗️ User-Defined Composed Devices** | Create custom composed devices via composedEntities mapping ([#220](https://github.com/RiDDiX/home-assistant-matter-hub/issues/220)) |
| **🔌 Plugin Domain Mappings** | Domain mapping support in plugin API with cloud-mock example |
| **🔋 Valve & Pump Battery** | Battery support for valve and pump endpoints |
| **🌐 German + Russian Translations** | Complete German translation and new Russian language |
| **📡 Session Recovery** | Graceful session close, dead session cleanup, mDNS re-announcement ([#266](https://github.com/RiDDiX/home-assistant-matter-hub/issues/266)) |
| **🔗 Quick Link to Failed Devices** | Dashboard quick link to failed devices ([#270](https://github.com/RiDDiX/home-assistant-matter-hub/issues/270)) |
| **🌡️ Thermostat Fix** | Skip climate.turn_on when already on ([#269](https://github.com/RiDDiX/home-assistant-matter-hub/issues/269)) |
| **🪟 Cover Fix** | Correct stale targetPosition during external movement ([#268](https://github.com/RiDDiX/home-assistant-matter-hub/issues/268)) |
| **🌬️ Air Purifier Fix** | Sub-endpoints for composed air purifier, manual temp/humidity mapping ([#265](https://github.com/RiDDiX/home-assistant-matter-hub/issues/265)) |
| **🔥 Cooling-Only Thermostat Fix** | Prevent HeatingOnly on cooling-only thermostat ([#264](https://github.com/RiDDiX/home-assistant-matter-hub/issues/264)) |
| **↔️ Per-Entity Cover Swap** | Individual coverSwapOpenClose per cover ([#263](https://github.com/RiDDiX/home-assistant-matter-hub/issues/263)) |

</details>

<details>
<summary><strong>🧪 Alpha (v2.1.0-alpha.x)</strong></summary>

**Alpha is currently level with Stable (v2.0.41).** All alpha work from the v2.1.0-alpha.601 line through v2.1.0-alpha.626 has been promoted into v2.0.41. New alpha work continues from `v2.1.0-alpha.627` onward and will appear here as development progresses. See the [Alpha Features Guide](./guides/alpha-features.md) for installation instructions.

</details>

<details>
<summary><strong>📋 Previous Versions</strong></summary>

### v2.0.29
Light currentLevel Fix, Bridge Config Save Fix, Fan Device Feature Fix, Humidity Auto-Mapping Fix

### v2.0.28
Device Image Support, Custom Fan Speed Mapping, TV Source Selection, Reverse Proxy Base Path, On/Off-Only Fans, Light Brightness Fix, Fan Speed Fixes, Composed Air Purifier Fix, Dreame Multi-Floor Fix, Optimistic State Updates, Frontend Improvements

### v2.0.27
Valetudo support, Custom Service Areas, ServiceArea Maps, Vacuum Identify/Locate/Charging, Alarm Control Panel, Composed Air Purifier, Dashboard Controls, Vendor Brand Icons, Thermostat fixes

### v2.0.26
Authentication UI, Select Entity Support, Webhook Event Bridge, Cluster Diagnostics, Matter.js 0.16.10, Docker Node 22

### v2.0.25
Vacuum mop intensity, vacuum auto-detection, Roborock room auto-detect, live entity mapping, dynamic heap sizing

### v2.0.17–v2.0.23
Thermostat overhaul, Lock Unlatch, Vacuum Server Mode, Bridge Templates, Live Filter Preview, Entity Diagnostics, Multi-Bridge Bulk Operations, Power & Energy Measurement, Event domain, Network Map, Mobile UI

### v2.0.16
Force Sync, Lock PIN, Cover/Blinds improvements, Roborock Rooms, Auto Entity Grouping, Water Heater, Vacuum Server Mode, OOM fix

### v1.9.0
Custom bridge icons, Basic Video Player, Alexa deduplication, Health Check API, WebSocket, Full backup/restore

### v1.8.x
Graceful crash handler, PM2.5/PM10 sensors, Water Valve, Smoke/CO Detector, Pressure/Flow sensors

### v1.5.x
Health Monitoring, Bridge Wizard, AirQuality sensors, Fan control, Media playback

</details>

## Getting started

To get things up and running, please follow the [installation guide](./getting-started/installation.md).

## Additional Resources

If you need more assistance on the topic, please have a look at the following external resources:

### Videos

#### YouTube-Video on "HA Matter HUB/BRIDGE 😲 👉 Das ändert alles für ALEXA und GOOGLE Nutzer" (🇩🇪)

[![HA Matter HUB/BRIDGE 😲 👉 Das ändert alles für ALEXA und GOOGLE Nutzer](https://img.youtube.com/vi/yOkPzEzuVhM/mqdefault.jpg)](https://www.youtube.com/watch?v=yOkPzEzuVhM)

#### YouTube-Video on "Alexa et Google Home dans Home Assistant GRATUITEMENT grâce à Matter" (🇫🇷)

[![Alexa et Google Home dans Home Assistant GRATUITEMENT grâce à Matter](https://img.youtube.com/vi/-TMzuHFo_-g/mqdefault.jpg)](https://www.youtube.com/watch?v=-TMzuHFo_-g)

## Support the Project

> **This is completely optional!** The project will continue regardless of donations.
> I maintain this in my free time because I believe in open source and helping the community.

If you find this project useful and want to support its development, consider buying me a coffee! ☕

[![PayPal](https://img.shields.io/badge/PayPal-Donate-blue?logo=paypal)](https://www.paypal.me/RiDDiX93)

Maintaining this project takes time and effort - from fixing bugs, adding new features, to helping users in issues.
Your support is appreciated but never expected. Thank you for using Home-Assistant-Matter-Hub! ❤️

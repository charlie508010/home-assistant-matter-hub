---
title: Alexa Controller Notes
sidebar_position: 20
---

# Alexa Controller Notes

These are working notes for the Alexa/Matter compatibility changes in this fork.

They are meant to document the current behavior and the reasons behind the main
changes, without requiring someone to dig through the older test commits.

## Main Areas

The related code is mostly in:

- `packages/backend/src/matter/endpoints/`
- `packages/backend/src/services/bridges/`
- `packages/backend/src/core/app/`
- `packages/backend/src/plugins/`
- `packages/frontend/src/pages/plugins/PluginsPage.tsx`
- `patches/@matter__node@0.16.11.patch`
- `apps/home-assistant-matter-hub/`

Topics covered here:

- Root Endpoint / Descriptor stabilization
- OTA Requestor, ICDManagement, and NetworkCommissioning behavior on EP0
- Stable Descriptor `endpointUniqueId`
- Alexa/controller diagnostics and session logging
- SQLite storage and backend-aware backup handling
- Plugin UI/actions/status support
- Runtime/add-on version handling

## Root Endpoint

Most of the controller compatibility work started with EP0 Descriptor reads.
Alexa reads EP0 early during discovery and reconnect, so small inconsistencies
there tend to show up later as noisy controller errors.

Current intended EP0 serverList:

```text
40 BasicInformation
31 AccessControl
63 GroupKeyManagement
48 GeneralCommissioning
60 AdministratorCommissioning
62 OperationalCredentials
51 GeneralDiagnostics
49 NetworkCommissioning
42 OtaSoftwareUpdateRequestor
70 IcdManagement
29 Descriptor
```

This is the server list currently used for the tested Alexa setup.

Descriptor reads for these attributes should complete successfully:

- `serverList`
- `deviceTypeList`
- `partsList`
- `endpointUniqueId`

The practical target is:

- no visible `UnsupportedCluster(195)`
- no visible `UnsupportedAttribute(134)`
- no visible `UnsupportedEndpoint(127)`

## Controller Read Diagnostics

When diagnostics are enabled, controller reads can be mapped back to Home
Assistant entities. This helps when Alexa repeatedly probes the same endpoint or
when an unsupported read needs to be traced to a specific device.

Example:

```text
Alexa/Controller read endpoint=37
endpointType=OnOffLight
entity=light.esszimmer_lichtschalter_esszimmer
cluster=Descriptor(0x1d)
attribute=serverList(0x1)
```

This should stay opt-in. Normal successful reads do not need to fill the log.

## OTA Requestor

Root EP0 exposes the OTA Requestor for controller compatibility.

Relevant behavior:

- `announceOtaProvider` is accepted on EP0.
- Provider announcements for unknown/non-local fabrics are ignored.
- `activeOtaProviders` are deduplicated by:
  - `fabricIndex`
  - `providerNodeId`
  - `endpoint`
- Busy responses are respected.
- Repeated Busy retries are suppressed after the configured retry limit.

Example log:

```text
OTA Provider announcement received
Scheduling OTA update query in 600000 (reason "Busy")
Busy-suppressed: OTA provider remained Busy after 3 runtime retries; no further Busy scheduling.
```

## ICDManagement

Root EP0 exposes minimal ICDManagement compatibility because some controllers
read `IcdManagement.FeatureMap`.

Expected behavior:

```text
RootNode EP0 Cluster 0x46 Attribute 0xFFFC -> Success, FeatureMap = 0
```

No ICD feature bits are set. HAMH does not simulate sleepy-device check-in or
registration behavior here.

## Session / Alexa Peer Logging

Session logs can include resolved Echo names when the Alexa peer map is
available.

Example:

```text
Bridge / 8~4aabdXXX Session 57225 (peer 1615190xxxx name="Raum Echo Dot"): subscriptions=0 | total: sessions=5
```

This makes it easier to see which Echo device is currently communicating with a
bridge.

Expected subscription cleanup should stay at DEBUG level unless there is a real
failure.

## Plugin Page / UI Changes

The Plugins page can render plugin-provided state and actions. The Alexa peer
resolver uses this, but the UI support is generic.

Implemented Plugin UI capabilities:

- plugin config dialog from `getConfigSchema()`
- schema property guards for empty or partial plugin config schemas
- secret config fields with visibility toggle
- external popup actions via `externalPopupUrl`
- popup mode support:
  - `open`
  - `saveThenOpen`
- generic plugin action buttons from `getUiStatus().actions`
- plugin status chips:
  - `statusText`
  - `statusColor`
  - matched/total counters
- generic tables from `getUiStatus().tables`
- fallback device table from `getUiStatus().deviceList`
- collapsible table sections
- refresh after popup/action where requested
- confirm/delete flow for destructive actions
- reset/enable/disable controls
- restart prompt after plugin install/upload/local-link
- Supervisor restart call after confirmation
- mobile responsive layout

On mobile, plugin actions are rendered in the content flow instead of
`ListItem.secondaryAction`. This keeps chips, buttons, and tables from
overlapping on narrow screens.

For plugin-provided tables, the plugin controls:

- table title
- table description
- columns
- row values
- optional status/chip cell types
- optional collapse behavior

This keeps plugin-specific views out of the HAMH frontend while still allowing a
plugin to expose useful status and actions.

## Storage / Backup

Storage can be selected by backend:

- `file`
- `sqlite`

Active storage roots are separated:

```text
/config/data/file
/config/data/sqlite
```

Backup and restore are backend-aware. They should preserve Matter identity,
fabrics, operational credentials, access control, and peer/session data where
available.

## Cleanup Notes

These older test paths should not be reintroduced without a new reproducible
controller issue:

- forced EP2 test logic
- single-light-only A/B test logic
- minimal OnOff-only light profiles
- fake FixedLabel or unrelated optional clusters
- inactive Descriptor serverList entries
- noisy INFO/WARN logs for expected controller cleanup

Further Matter, Fabric, or Descriptor changes should be tied to a concrete
controller issue and verified against a real controller.

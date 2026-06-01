---
title: Root Endpoint Stabilization
sidebar_position: 20
---

# Root Endpoint / Alexa Controller Notes

These notes summarize the current Alexa/Matter interoperability work in this fork.

The changes are grouped by area so the implementation can be reviewed without
reading the old experimental commit history.

## Main Areas

Most relevant changes are located in:

- `packages/backend/src/matter/endpoints/`
- `packages/backend/src/services/bridges/`
- `packages/backend/src/core/app/`
- `packages/backend/src/plugins/`
- `packages/frontend/src/pages/plugins/PluginsPage.tsx`
- `patches/@matter__node@0.16.11.patch`
- `apps/home-assistant-matter-hub/`

Main topics:

- Root Endpoint / Descriptor stabilization
- OTA Requestor, ICDManagement, and NetworkCommissioning behavior on EP0
- Stable Descriptor `endpointUniqueId`
- Alexa/controller diagnostics and session logging
- SQLite storage and backend-aware backup handling
- Plugin UI/actions/status support
- Runtime/add-on version handling

## Root Endpoint

The most important interoperability work was stabilizing EP0 Descriptor reads.

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

This configuration currently behaves more stable with Alexa/controllers.

Descriptor reads for these attributes should complete successfully:

- `serverList`
- `deviceTypeList`
- `partsList`
- `endpointUniqueId`

The current test target is:

- no visible `UnsupportedCluster(195)`
- no visible `UnsupportedAttribute(134)`
- no visible `UnsupportedEndpoint(127)`

## Controller Read Diagnostics

Controller reads can be mapped back to Home Assistant entities when diagnostics
are enabled. This makes it easier to see which Matter endpoint Alexa is reading.

Example:

```text
Alexa/Controller read endpoint=37
endpointType=OnOffLight
entity=light.esszimmer_lichtschalter_esszimmer
cluster=Descriptor(0x1d)
attribute=serverList(0x1)
```

This is intended for diagnosis only. Normal successful read diagnostics should
stay quiet unless explicitly enabled.

## OTA Requestor

Root EP0 exposes the OTA Requestor for Alexa/controller compatibility.

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

Root EP0 exposes minimal ICDManagement compatibility for controllers that read
`IcdManagement.FeatureMap`.

Expected behavior:

```text
RootNode EP0 Cluster 0x46 Attribute 0xFFFC -> Success, FeatureMap = 0
```

No ICD feature bits should be set, and no Sleepy/Check-In/Registration behavior
is simulated.

## Session / Alexa Peer Logging

Session logs can include resolved Echo names when an Alexa peer map is available.

Example:

```text
Bridge / 8~4aabdXXX Session 57225 (peer 1615190xxxx name="Raum Echo Dot"): subscriptions=0 | total: sessions=5
```

This helps identify which Echo device is currently communicating with HAMH.

Normal stale-session and subscription cleanup logs should be DEBUG-level noise,
not WARN/ERROR, unless repeated failures occur.

## Plugin Page / UI Changes

The Plugins page was extended so external plugins can expose richer UI state and
actions. This is used by the Alexa peer resolver plugin, but the UI support is
generic and not Alexa-specific.

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

The mobile layout avoids using `ListItem.secondaryAction` for plugin actions.
Actions are rendered in the content flow so status chips, buttons, and tables do
not overlap on narrow screens.

For plugin-provided tables, the plugin controls:

- table title
- table description
- columns
- row values
- optional status/chip cell types
- optional collapse behavior

The goal is that plugins can provide their own status/details UI without adding
hardcoded plugin-specific components to HAMH.

## Storage / Backup

Storage can be selected by backend:

- `file`
- `sqlite`

Active storage roots are separated:

```text
/config/data/file
/config/data/sqlite
```

Backup/restore is backend-aware and should preserve Matter identity, fabrics,
operational credentials, access control, and peer/session data where available.

## Cleanup Guidance

Avoid reintroducing old experimental paths:

- forced EP2 test logic
- single-light-only A/B test logic
- minimal OnOff-only light profiles
- fake FixedLabel or unrelated optional clusters
- inactive Descriptor serverList entries
- noisy INFO/WARN logs for expected controller cleanup

Further Matter/Fabric/Descriptor changes should only be made for a concrete new
reproducible controller issue.

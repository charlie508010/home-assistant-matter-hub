# Improve storage resilience, Alexa/Matter compatibility, and management UI

## Summary

This PR collects a set of compatibility and operational improvements that were tested against Alexa as a Matter controller and Home Assistant add-on deployments.

The main goals are:

- make Matter storage more robust by adding an optional SQLite backend
- keep the existing file backend as the default
- improve Alexa/Matter bridge discovery stability
- reduce noisy normal-controller logs
- improve add-on configuration, backup handling, plugin UI, and German/English localization

The changes are intentionally conservative around Matter behavior: the existing file storage backend remains the default, SQLite is opt-in, and Matter endpoint compatibility changes are focused on descriptor consistency and controller interoperability.

## What changed

### Optional SQLite storage backend

Adds an optional SQLite key/value storage backend selected via:

```text
HAMH_STORAGE_BACKEND=file|sqlite
```

Default remains:

```text
file
```

Storage roots are separated:

```text
/config/data/file
/config/data/sqlite
```

Migration behavior:

- file -> SQLite migration runs only when SQLite is selected and no SQLite DB exists yet
- legacy `/config/data` is read only as fallback migration source
- old files are not deleted
- SQLite -> file migration can restore compatible file-store data when switching back to the file backend

### Backup and restore awareness

Full backups now include metadata about the active storage backend and restore into the matching backend folder without deleting unrelated data.

Backup metadata includes:

- backup type
- storage backend
- active storage root
- identity inclusion state

### Alexa/Matter compatibility improvements

The root endpoint is stabilized for Alexa controller probing and discovery:

- Root EP0 exposes OTA Requestor and ICDManagement compatibility where configured
- ICDManagement FeatureMap returns 0 for compatibility
- Descriptor endpointUniqueId is stable and readable
- Endpoint IDs and endpointUniqueId handling are stable across restarts
- stale/invalid OTA provider announcements for unknown fabrics are ignored safely
- active OTA providers are deduplicated by fabricIndex/providerNodeId/endpoint
- repeated OTA Busy responses are bounded and do not continue an endless 600000-ms loop

### Logging cleanup

Normal controller behavior is less noisy:

- subscription cancelled by peer is debug-level
- stale session cleanup is quieter
- expected shutdown/discovery races are downgraded where applicable
- controller read diagnostics still include endpoint/entity context for error cases

### Add-on and UI improvements

- `storage_backend` add-on option maps to `HAMH_STORAGE_BACKEND`
- HTTP auth settings are moved out of the regular HAMH UI into app/add-on configuration
- network diagnostics are available from the settings/configuration area
- backup UI shows active storage backend/status
- plugin page supports richer plugin-provided status/actions and responsive mobile layout
- bridge configuration page localization is improved
- feature flags are grouped by topic
- filter presets and filter reference UI were added
- frontend chunks are split to reduce the main bundle size

## Testing

Locally verified:

```text
pnpm lint
pnpm --filter @home-assistant-matter-hub/backend build
```

Runtime observations from add-on testing:

- no UnsupportedAttribute(134) for Descriptor endpointUniqueId
- no UnsupportedEndpoint(127) during Alexa scans
- no UnsupportedCluster(195) for Root EP0 OTA/ICD probes in the tested setup
- Root EP0 effective serverList contains the expected active compatibility clusters
- Alexa OTA Busy no longer loops indefinitely after the runtime retry limit
- normal Alexa session/subscription churn is logged at debug level

## Notes for reviewers

This is a large integration branch. If preferred, it can be split into smaller PRs:

1. SQLite storage backend and migrations
2. Backup/storage backend awareness
3. Alexa/Matter endpoint and OTA compatibility
4. UI/localization/filter preset improvements
5. Logging cleanup and diagnostics

The file backend remains the default, so existing installations should not move to SQLite unless explicitly configured.

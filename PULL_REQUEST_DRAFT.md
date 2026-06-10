# Storage backend switching and graceful shutdown cleanup

## Summary

This branch tightens a few areas that showed up during Home Assistant add-on
testing with Alexa as a Matter controller:

- backend-specific storage roots for `file` and `sqlite`
- plugin package/data paths following the active storage backend
- add-on option forwarding for `HAMH_STORAGE_BACKEND`
- session close during graceful shutdown before backup/dispose
- removal of the earlier stale-session/mDNS recovery cleanup experiment

The goal is to keep storage switching predictable and let Matter sessions shut
down cleanly without adding controller-specific recovery behavior.

## What changed

### Storage backend selection

The add-on `storage_backend` option is passed through as:

```text
HAMH_STORAGE_BACKEND=file|sqlite
```

Default remains `sqlite` for the add-on option unless explicitly changed.

Active storage roots are kept separate:

```text
/config/data/file
/config/data/sqlite
```

### Backend-specific plugin paths

Plugin packages and plugin state now follow the active storage root.

When `HAMH_STORAGE_BACKEND=file`:

```text
/config/data/file/plugin-packages
/config/data/file/installed-plugins.json
```

When `HAMH_STORAGE_BACKEND=sqlite`:

```text
/config/data/sqlite/plugin-packages
/config/data/sqlite/installed-plugins.json
```

The same applies to Alexa plugin data such as cookies, login status, peer maps,
and voice-history files.

### Storage migration behavior

Switching between `file` and `sqlite` keeps plugin data and Matter state
available where possible. Existing target data is not overwritten when it is
already valid.

The file backend no longer creates `/config/data/sqlite` just to check for a
migration source. If the source is missing, migration is skipped cleanly.

### Graceful shutdown

Shutdown now closes active CASE sessions before backup and app disposal.

Expected shutdown order:

```text
1. close active CASE sessions
2. create shutdown backup
3. stop bridges
4. dispose application resources
```

This avoids leaving controllers with still-open sessions during an add-on
restart.

### Removed stale-session cleanup experiment

The previous aggressive stale-session cleanup and forced mDNS reannounce logic
was removed from the bridge code.

Kept:

- normal session opened/closed logging
- subscription diagnostics
- graceful session close during shutdown

Removed:

- dead-session timers
- per-session stale tracking
- stale-session close helpers
- forced mDNS reannounce from stale cleanup

## Testing

Local checks:

```text
pnpm -C packages/backend build
```

Runtime checks used during add-on testing:

- `HAMH_STORAGE_BACKEND=file`
- `HAMH_STORAGE_BACKEND=sqlite`
- switch `sqlite -> file`
- switch `file -> sqlite`
- external plugin remains installed after restart
- Alexa plugin keeps login data after backend switch
- graceful shutdown logs session close before backup
- Alexa reconnects with CASE resumption after restart

Expected logs after the cleanup:

```text
Resumed session
Session opened
Subscribe successful
Invoke
Turning ON/OFF
Graceful shutdown: session close complete closed=X failed=0
```

The old cleanup experiment should no longer log:

```text
Closing stale session
Triggered mDNS re-announcement after session cleanup
forced mDNS broadcast
```

## Notes

No Matter endpoint structure, EP0/EP1 descriptor layout, or plugin UI behavior is
changed by the stale-session cleanup removal.

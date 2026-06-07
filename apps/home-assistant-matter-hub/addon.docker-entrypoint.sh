#!/usr/bin/with-contenv bashio

# Dynamically limit Node.js heap based on available container memory.
# Docker containers may have cgroup memory limits that are lower than
# the host's total RAM. We check (in order):
#   1. cgroups v2 limit (/sys/fs/cgroup/memory.max) — used by HA OS
#   2. cgroups v1 limit (/sys/fs/cgroup/memory/memory.limit_in_bytes)
#   3. MemAvailable from /proc/meminfo (actual free memory)
#   4. MemTotal from /proc/meminfo (fallback)
# Heap = 25% of effective memory, clamped to 256-2048MB.
# Honors a pre-set NODE_OPTIONS so power users can override the cap.

total_mem_mb=$(awk '/MemTotal/ {printf "%d", $2/1024}' /proc/meminfo 2>/dev/null)
avail_mem_mb=$(awk '/MemAvailable/ {printf "%d", $2/1024}' /proc/meminfo 2>/dev/null)

# Check cgroup memory limit (container limit may be lower than host RAM)
cgroup_limit_mb=""
if [ -f /sys/fs/cgroup/memory.max ]; then
  cgroup_raw=$(cat /sys/fs/cgroup/memory.max 2>/dev/null)
  if [ "$cgroup_raw" != "max" ] && [ -n "$cgroup_raw" ]; then
    cgroup_limit_mb=$((cgroup_raw / 1024 / 1024))
  fi
elif [ -f /sys/fs/cgroup/memory/memory.limit_in_bytes ]; then
  cgroup_raw=$(cat /sys/fs/cgroup/memory/memory.limit_in_bytes 2>/dev/null)
  # cgroups v1 uses a very large number (~2^63) to mean "no limit"
  if [ -n "$cgroup_raw" ] && [ "$cgroup_raw" -lt 9000000000000 ]; then
    cgroup_limit_mb=$((cgroup_raw / 1024 / 1024))
  fi
fi

# Use the most constrained value as the effective memory base
if [ -n "$cgroup_limit_mb" ] && [ "$cgroup_limit_mb" -gt 0 ]; then
  effective_mem=$cgroup_limit_mb
  mem_source="cgroup"
elif [ -n "$avail_mem_mb" ] && [ "$avail_mem_mb" -gt 0 ]; then
  effective_mem=$avail_mem_mb
  mem_source="available"
else
  effective_mem=${total_mem_mb:-0}
  mem_source="total"
fi

if [ "$effective_mem" -eq 0 ]; then
  heap_size=256
else
  heap_size=$((effective_mem / 4))
  [ "$heap_size" -lt 256 ] && heap_size=256
  [ "$heap_size" -gt 2048 ] && heap_size=2048
fi

bashio::log.info "Memory: total=${total_mem_mb:-?}MB, available=${avail_mem_mb:-?}MB, cgroup=${cgroup_limit_mb:-none}MB → using ${mem_source} (${effective_mem}MB) → heap: ${heap_size}MB"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=${heap_size}}"
export APP_VERSION="${APP_VERSION:-$(bashio::addon.version)}"
storage_backend="$(bashio::config 'storage_backend')"
case "${storage_backend:-sqlite}" in
  file|sqlite)
    export HAMH_STORAGE_BACKEND="${storage_backend:-sqlite}"
    ;;
  *)
    export HAMH_STORAGE_BACKEND="sqlite"
    bashio::log.warning "Invalid storage_backend option '${storage_backend}', defaulting to sqlite"
    ;;
esac
bashio::log.info "HAMH_STORAGE_BACKEND=${HAMH_STORAGE_BACKEND}"

http_auth_enabled="$(bashio::config 'http_auth_enabled')"
http_auth_username="$(bashio::config 'http_auth_username')"
http_auth_password="$(bashio::config 'http_auth_password')"
http_auth_enabled="${http_auth_enabled:-false}"

resolved_http_auth_username="${HAMH_HTTP_AUTH_USERNAME:-$http_auth_username}"
resolved_http_auth_password="${HAMH_HTTP_AUTH_PASSWORD:-$http_auth_password}"

if [ -n "${HAMH_HTTP_AUTH_USERNAME:-}" ] && [ -n "${HAMH_HTTP_AUTH_PASSWORD:-}" ]; then
  bashio::log.info "HTTP authentication: enabled from HAMH_HTTP_AUTH_* environment variables"
elif [ "$http_auth_enabled" = "true" ] && [ -n "$resolved_http_auth_username" ] && [ -n "$resolved_http_auth_password" ]; then
  export HAMH_HTTP_AUTH_USERNAME="$resolved_http_auth_username"
  export HAMH_HTTP_AUTH_PASSWORD="$resolved_http_auth_password"
  bashio::log.info "HTTP authentication: enabled from add-on configuration"
elif [ -n "${HAMH_HTTP_AUTH_USERNAME:-}" ] || [ -n "${HAMH_HTTP_AUTH_PASSWORD:-}" ]; then
  bashio::log.warning "HTTP authentication environment variables are incomplete; authentication remains disabled"
elif [ "$http_auth_enabled" = "true" ]; then
  bashio::log.warning "HTTP authentication requested but username/password are incomplete; authentication remains disabled"
else
  bashio::log.info "HTTP authentication: disabled"
fi

exec home-assistant-matter-hub start \
  --log-level=$(bashio::config 'app_log_level') \
  --disable-log-colors=$(bashio::config 'disable_log_colors') \
  --mdns-network-interface="$(bashio::config 'mdns_network_interface')" \
  --storage-location=/config/data \
  --web-port=$(bashio::addon.ingress_port) \
  --home-assistant-url='http://supervisor/core' \
  --home-assistant-access-token="$SUPERVISOR_TOKEN" \
  --http-ip-whitelist="172.30.32.2"

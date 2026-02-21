#!/usr/bin/with-contenv bashio

# Dynamically limit Node.js heap based on available system memory.
# Without a limit, V8 tries to grow to ~4GB on 64-bit systems, which
# triggers the Linux OOM killer on resource-constrained devices (RPi,
# HA Yellow, small VMs). We use 25% of total RAM, clamped to 256-1024MB.
total_mem_mb=$(awk '/MemTotal/ {printf "%d", $2/1024}' /proc/meminfo 2>/dev/null)
if [ -z "$total_mem_mb" ] || [ "$total_mem_mb" -eq 0 ]; then
  heap_size=512
else
  heap_size=$((total_mem_mb / 4))
  [ "$heap_size" -lt 256 ] && heap_size=256
  [ "$heap_size" -gt 1024 ] && heap_size=1024
fi
bashio::log.info "System RAM: ${total_mem_mb:-unknown}MB → Node.js heap: ${heap_size}MB"
export NODE_OPTIONS="--max-old-space-size=${heap_size}"

exec home-assistant-matter-hub start \
  --log-level=$(bashio::config 'app_log_level') \
  --disable-log-colors=$(bashio::config 'disable_log_colors') \
  --mdns-network-interface="$(bashio::config 'mdns_network_interface')" \
  --storage-location=/config/data \
  --web-port=$(bashio::addon.ingress_port) \
  --home-assistant-url='http://supervisor/core' \
  --home-assistant-access-token="$SUPERVISOR_TOKEN" \
  --http-ip-whitelist="172.30.32.2"

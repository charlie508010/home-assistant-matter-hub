ARG NODE_VERSION="22"

FROM node:${NODE_VERSION}-alpine
RUN apk add --no-cache netcat-openbsd tini

ARG PACKAGE_VERSION="unknown"
ENV HAMH_STORAGE_LOCATION="/data"
ENV APP_VERSION="${PACKAGE_VERSION}"
VOLUME /data

LABEL package.version="$PACKAGE_VERSION"

RUN mkdir /install
COPY package.tgz /install/package.tgz
RUN npm install -g /install/package.tgz
RUN rm -rf /install

# Dynamic heap sizing: 25% of total RAM, clamped to 256-1024MB.
# Override with: docker run -e NODE_OPTIONS="--max-old-space-size=1024" ...
CMD total_mem_mb=$(awk '/MemTotal/ {printf "%d", $2/1024}' /proc/meminfo 2>/dev/null); \
    if [ -z "$total_mem_mb" ] || [ "$total_mem_mb" -eq 0 ]; then heap_size=512; \
    else heap_size=$((total_mem_mb / 4)); \
      [ "$heap_size" -lt 256 ] && heap_size=256; \
      [ "$heap_size" -gt 1024 ] && heap_size=1024; \
    fi; \
    echo "System RAM: ${total_mem_mb:-unknown}MB -> Node.js heap: ${heap_size}MB"; \
    export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=${heap_size}}"; \
    exec home-assistant-matter-hub start

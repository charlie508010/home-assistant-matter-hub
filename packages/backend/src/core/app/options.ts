import { createRequire } from "node:module";
import { VendorId } from "@matter/main";
import type { ArgumentsCamelCase } from "yargs";
import type { WebApiProps } from "../../api/web-api.js";
import type { StartOptions } from "../../commands/start/start-options.js";
import type { BridgeServiceProps } from "../../services/bridges/bridge-service.js";
import type { HomeAssistantClientProps } from "../../services/home-assistant/home-assistant-client.js";
import type { LoggerServiceProps } from "./logger.js";
import type { MdnsOptions } from "./mdns.js";
import { resolveActiveStorageRoot, type StorageOptions } from "./storage.js";

function resolveAppVersion(): string {
  try {
    const require = createRequire(import.meta.url);
    // When installed globally via npm, this resolves to the published package.json
    // and provides the real semantic version.
    const pkg = require("home-assistant-matter-hub/package.json") as {
      version?: string;
    };
    if (pkg.version && pkg.version !== "0.0.0") {
      return pkg.version;
    }
  } catch {
    // ignore, fall through to env var
  }
  if (process.env.APP_VERSION) {
    return process.env.APP_VERSION;
  }
  return "0.0.0-dev";
}

function resolveNumericSoftwareVersion(appVersion: string): number {
  const match = appVersion.match(
    /^(\d+)\.(\d+)\.(\d+)(?:-(?:alpha|beta|rc)\.(\d+))?/,
  );
  if (match == null) {
    return 1;
  }

  const major = Number.parseInt(match[1], 10);
  const minor = Number.parseInt(match[2], 10);
  const patch = Number.parseInt(match[3], 10);
  const prerelease = match[4] ? Number.parseInt(match[4], 10) : 0;

  if (
    !Number.isSafeInteger(major) ||
    !Number.isSafeInteger(minor) ||
    !Number.isSafeInteger(patch) ||
    !Number.isSafeInteger(prerelease)
  ) {
    return 1;
  }

  // Stable releases keep the patch number readable, e.g. 2.0.45 -> 200045.
  // Prereleases reserve the last three digits for the prerelease number,
  // e.g. 2.1.0-alpha.805 -> 210805.
  return (
    major * 100_000 +
    minor * 10_000 +
    (match[4] ? patch * 1_000 + prerelease : patch)
  );
}

export type OptionsProps = ArgumentsCamelCase<StartOptions> & {
  webUiDist: string | undefined;
};

export class Options {
  constructor(private readonly startOptions: OptionsProps) {}

  get mdns(): MdnsOptions {
    return {
      ipv4: true,
      networkInterface: notEmpty(this.startOptions.mdnsNetworkInterface),
    };
  }

  get logging(): LoggerServiceProps {
    return {
      level: this.startOptions.logLevel,
      protocolLevel: this.startOptions.protocolLogLevel,
      disableColors: this.startOptions.disableLogColors ?? false,
      jsonOutput: this.startOptions.jsonLogs ?? false,
    };
  }

  get storage(): StorageOptions {
    return {
      location: notEmpty(this.startOptions.storageLocation),
    };
  }

  get homeAssistant(): HomeAssistantClientProps {
    return {
      url: this.startOptions.homeAssistantUrl,
      accessToken: this.startOptions.homeAssistantAccessToken,
      refreshInterval: this.startOptions.homeAssistantRefreshInterval,
      messageTimeoutMs: this.startOptions.haMessageTimeout,
    };
  }

  get webApi(): WebApiProps {
    const auth: WebApiProps["auth"] =
      this.startOptions.httpAuthUsername && this.startOptions.httpAuthPassword
        ? {
            username: this.startOptions.httpAuthUsername,
            password: this.startOptions.httpAuthPassword,
          }
        : undefined;
    return {
      port: this.startOptions.httpPort,
      whitelist: this.startOptions.httpIpWhitelist?.map((item) =>
        item.toString(),
      ),
      webUiDist: this.startOptions.webUiDist,
      version: resolveAppVersion(),
      storageLocation: this.resolveStorageLocation(),
      basePath: normalizeBasePath(this.startOptions.httpBasePath),
      auth,
      mdnsInterface: notEmpty(this.startOptions.mdnsNetworkInterface),
      mdnsIpv4: true,
    };
  }

  private resolveStorageLocation(): string {
    const storageLocation = notEmpty(this.startOptions.storageLocation);
    return resolveActiveStorageRoot(storageLocation);
  }

  get bridgeService(): BridgeServiceProps {
    const appVersion = resolveAppVersion();
    return {
      basicInformation: {
        vendorId: VendorId(0xfff1),
        vendorName: "riddix",
        productId: 0x8000,
        productName: "MatterHub",
        productLabel: "Home Assistant Matter Hub",
        hardwareVersion: 1,
        hardwareVersionString: "1",
        softwareVersion: resolveNumericSoftwareVersion(appVersion),
        softwareVersionString: appVersion,
      },
    };
  }
}

function normalizeBasePath(val: string | undefined): string {
  let p = val?.trim() ?? "/";
  if (!p.startsWith("/")) {
    p = `/${p}`;
  }
  if (p.length > 1 && p.endsWith("/")) {
    p = p.slice(0, -1);
  }
  return p;
}

function notEmpty(val: string | undefined | null): string | undefined {
  const value = val?.trim();
  if (value == null || value.length === 0) {
    return undefined;
  }
  return value;
}

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { type Environment, StorageService } from "@matter/main";
import { LoggerService } from "./logger.js";
import { CustomStorage } from "./storage/custom-storage.js";
import { SqliteCustomStorage } from "./storage/sqlite-custom-storage.js";

export type StorageBackend = "file" | "sqlite";

export interface StorageOptions {
  location?: string;
}

export function storage(environment: Environment, options: StorageOptions) {
  const logger = environment.get(LoggerService).get("CustomStorage");
  const backend = resolveStorageBackend(process.env.HAMH_STORAGE_BACKEND);
  const baseLocation = resolveBaseStorageLocation(options.location);
  const activeLocation = resolveActiveStorageRoot(options.location, backend);
  const legacyRootDetected = fs.existsSync(baseLocation);

  fs.mkdirSync(activeLocation, { recursive: true });

  logger.info(`HAMH storage backend selected: ${backend}`);
  logger.info(`Active storage root: ${activeLocation}`);
  logger.info(
    `Legacy storage root detected: ${legacyRootDetected ? "yes" : "no"}`,
  );

  const storageService = environment.get(StorageService);
  storageService.location = activeLocation;
  storageService.factory = (ns) => {
    const namespaceLocation = path.resolve(activeLocation, ns);
    if (backend === "sqlite") {
      return new SqliteCustomStorage(
        logger,
        namespaceLocation,
        resolveSqliteMigrationSource(baseLocation, ns),
      );
    }
    return new CustomStorage(logger, namespaceLocation);
  };
}

export function resolveStorageBackend(
  value: string | undefined,
): StorageBackend {
  const backend = value?.trim().toLowerCase();
  return backend === "sqlite" ? "sqlite" : "file";
}

export function resolveBaseStorageLocation(
  storageLocation: string | undefined,
) {
  const homedir = os.homedir();
  return storageLocation
    ? path.resolve(storageLocation.replace(/^~\//, `${homedir}/`))
    : path.join(homedir, ".home-assistant-matter-hub");
}

export function resolveActiveStorageRoot(
  storageLocation: string | undefined,
  backend = resolveStorageBackend(process.env.HAMH_STORAGE_BACKEND),
) {
  return path.join(resolveBaseStorageLocation(storageLocation), backend);
}

function resolveSqliteMigrationSource(baseLocation: string, namespace: string) {
  const fileBackendSource = path.join(baseLocation, "file", namespace);
  if (hasStorageFiles(fileBackendSource)) {
    return { kind: "file" as const, path: fileBackendSource };
  }

  const legacySource = path.join(baseLocation, namespace);
  if (hasStorageFiles(legacySource)) {
    return { kind: "legacy-root" as const, path: legacySource };
  }

  return undefined;
}

function hasStorageFiles(location: string): boolean {
  if (!fs.existsSync(location)) {
    return false;
  }

  const entries = fs.readdirSync(location, { withFileTypes: true });
  return entries.some((entry) => {
    if (entry.isFile()) {
      return true;
    }
    if (entry.isDirectory()) {
      return hasStorageFiles(path.join(location, entry.name));
    }
    return false;
  });
}

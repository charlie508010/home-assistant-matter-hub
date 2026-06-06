import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Logger } from "@matter/general";
import { type Environment, StorageService } from "@matter/main";
import { LoggerService } from "./logger.js";
import { CustomStorage } from "./storage/custom-storage.js";
import { SqliteCustomStorage } from "./storage/sqlite-custom-storage.js";
import { migrateSqliteStorageToFileIfNeeded } from "./storage/sqlite-to-file-migration.js";

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
    migrateSqliteStorageToFileIfNeeded(
      logger,
      path.resolve(baseLocation, "sqlite", ns),
      namespaceLocation,
    );
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

export function migratePluginStorageToActiveRootIfNeeded(
  logger: Pick<Logger, "info" | "warn">,
  activeStorageRoot: string,
) {
  if (path.basename(activeStorageRoot) !== "file") {
    return;
  }

  const baseLocation = path.dirname(activeStorageRoot);
  const sqliteRoot = path.join(baseLocation, "sqlite");

  migratePluginDirectoryIfMissing(
    logger,
    path.join(sqliteRoot, "plugin-packages"),
    path.join(activeStorageRoot, "plugin-packages"),
  );
  migratePluginFileIfMissing(
    logger,
    path.join(sqliteRoot, "installed-plugins.json"),
    path.join(activeStorageRoot, "installed-plugins.json"),
  );
}

function migratePluginDirectoryIfMissing(
  logger: Pick<Logger, "info" | "warn">,
  source: string,
  target: string,
) {
  if (
    !fs.existsSync(source) ||
    hasPluginPackageData(target) ||
    !hasPluginPackageData(source)
  ) {
    return;
  }
  try {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.cpSync(source, target, { recursive: true, force: true });
    logger.info("Migrated plugin packages from sqlite to file");
  } catch (e) {
    logger.warn("Failed to migrate plugin packages from sqlite to file:", e);
  }
}

function migratePluginFileIfMissing(
  logger: Pick<Logger, "info" | "warn">,
  source: string,
  target: string,
) {
  if (
    !fs.existsSync(source) ||
    hasInstalledPluginEntries(target) ||
    !hasInstalledPluginEntries(source)
  ) {
    return;
  }
  try {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
    logger.info("Migrated installed plugins from sqlite to file");
  } catch (e) {
    logger.warn("Failed to migrate installed plugins from sqlite to file:", e);
  }
}

function hasPluginPackageData(location: string): boolean {
  const packageJson = path.join(location, "package.json");
  if (fs.existsSync(packageJson)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJson, "utf-8")) as {
        dependencies?: Record<string, unknown>;
      };
      if (Object.keys(pkg.dependencies ?? {}).length > 0) {
        return true;
      }
    } catch {
      return true;
    }
  }

  const nodeModules = path.join(location, "node_modules");
  if (!fs.existsSync(nodeModules)) {
    return false;
  }
  return fs
    .readdirSync(nodeModules)
    .some((entry) => entry !== ".package-lock.json");
}

function hasInstalledPluginEntries(filePath: string): boolean {
  if (!fs.existsSync(filePath)) {
    return false;
  }
  try {
    const entries = JSON.parse(fs.readFileSync(filePath, "utf-8")) as unknown;
    return Array.isArray(entries) && entries.length > 0;
  } catch {
    return true;
  }
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

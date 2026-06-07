import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Logger } from "@matter/general";

type SqliteStorageRow = {
  key: string;
  value: string | Uint8Array;
  value_type: "json" | "blob";
};

export function migrateSqliteStorageToFileIfNeeded(
  log: Logger,
  sourceNamespacePath: string,
  targetNamespacePath: string,
) {
  const sourceDbPath = path.join(sourceNamespacePath, "storage.sqlite");
  log.info(
    `SQLite-to-file migration source: ${path.dirname(sourceNamespacePath)}`,
  );
  log.info(
    `SQLite-to-file migration target: ${path.dirname(targetNamespacePath)}`,
  );

  if (!fs.existsSync(sourceNamespacePath)) {
    log.info("SQLite-to-file migration skipped: source missing");
    log.info(
      `SQLite-to-file migrated keys count per namespace ${path.basename(
        targetNamespacePath,
      )}: 0`,
    );
    return;
  }

  if (!fs.existsSync(sourceDbPath)) {
    log.info("SQLite-to-file migration result: skipped");
    log.info(
      `SQLite-to-file migrated keys count per namespace ${path.basename(
        targetNamespacePath,
      )}: 0`,
    );
    return;
  }

  fs.mkdirSync(targetNamespacePath, { recursive: true });
  const existingKeys = collectFileStorageKeys(targetNamespacePath);
  const db = new DatabaseSync(sourceDbPath, { readOnly: true });

  try {
    const table = db
      .prepare(
        "SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = 'kv_store'",
      )
      .get() as { found: number } | undefined;
    if (table?.found !== 1) {
      log.info("SQLite-to-file migration result: skipped");
      log.info(
        `SQLite-to-file migrated keys count per namespace ${path.basename(
          targetNamespacePath,
        )}: 0`,
      );
      return;
    }

    const rows = db
      .prepare("SELECT key, value, value_type FROM kv_store ORDER BY key")
      .all() as SqliteStorageRow[];
    let migrated = 0;

    for (const row of rows) {
      if (!isValidStorageKey(row.key) || existingKeys.has(row.key)) {
        continue;
      }

      const targetPath = path.join(
        targetNamespacePath,
        encodeFileStorageKey(row.key),
      );
      if (fs.existsSync(targetPath)) {
        continue;
      }

      fs.writeFileSync(
        targetPath,
        row.value_type === "blob"
          ? Buffer.from(row.value as Uint8Array)
          : String(row.value),
      );
      migrated++;
    }

    log.info(
      `SQLite-to-file migration result: ${migrated > 0 ? "done" : "skipped"}`,
    );
    log.info(
      `SQLite-to-file migrated keys count per namespace ${path.basename(
        targetNamespacePath,
      )}: ${migrated}`,
    );
  } finally {
    db.close();
  }
}

function collectFileStorageKeys(namespacePath: string) {
  const keys = new Set<string>();
  if (!fs.existsSync(namespacePath)) {
    return keys;
  }

  for (const entry of fs.readdirSync(namespacePath, { withFileTypes: true })) {
    if (!entry.isFile() || shouldSkipFile(entry.name)) {
      continue;
    }

    try {
      const key = decodeURIComponent(entry.name);
      if (isValidStorageKey(key)) {
        keys.add(key);
      }
    } catch {}
  }
  return keys;
}

function encodeFileStorageKey(key: string) {
  return encodeURIComponent(key)
    .replace(/[!'()]/g, (char) => `%${char.charCodeAt(0).toString(16)}`)
    .replace(/\*/g, "%2A");
}

function shouldSkipFile(name: string) {
  return (
    name.endsWith(".tmp") ||
    name === "storage.sqlite" ||
    name === "storage.sqlite-wal" ||
    name === "storage.sqlite-shm" ||
    (name.startsWith("backup.") && name.endsWith(".json"))
  );
}

function isValidStorageKey(key: string) {
  return (
    key.length > 0 &&
    !key.includes("..") &&
    !key.startsWith(".") &&
    !key.endsWith(".") &&
    key.includes(".")
  );
}

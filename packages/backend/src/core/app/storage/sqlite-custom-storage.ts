import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { ClusterId } from "@home-assistant-matter-hub/common";
import {
  type Bytes,
  fromJson,
  type Logger,
  Storage,
  StorageError,
  type SupportedStorageTypes,
  toJson,
} from "@matter/general";

type MigrationSource =
  | {
      kind: "file" | "legacy-root";
      path: string;
    }
  | undefined;

type StorageRow = {
  key: string;
  value: string | Uint8Array;
  value_type: "json" | "blob";
};

export class SqliteCustomStorage extends Storage {
  readonly #dbPath: string;
  #db?: DatabaseSync;
  #initialized = false;

  constructor(
    private readonly log: Logger,
    private readonly namespacePath: string,
    private readonly migrationSource: MigrationSource,
  ) {
    super();
    this.#dbPath = path.join(namespacePath, "storage.sqlite");
  }

  override get initialized() {
    return this.#initialized;
  }

  override initialize() {
    const existed = fs.existsSync(this.#dbPath);
    fs.mkdirSync(this.namespacePath, { recursive: true });

    this.#db = new DatabaseSync(this.#dbPath);
    this.#db.exec("PRAGMA journal_mode=WAL");
    this.#db.exec("PRAGMA synchronous=NORMAL");
    this.#db.exec(`
      CREATE TABLE IF NOT EXISTS kv_store (
        key TEXT PRIMARY KEY,
        value BLOB NOT NULL,
        value_type TEXT NOT NULL CHECK(value_type IN ('json', 'blob')),
        updated_at INTEGER NOT NULL
      )
    `);

    this.#initialized = true;

    this.log.info(`SQLite DB path: ${this.#dbPath}`);
    this.log.info(
      `Legacy migration source: ${this.migrationSource?.kind ?? "none"}`,
    );

    if (this.migrationSource?.kind === "file") {
      this.log.info(
        `File-to-sqlite migration source: ${path.dirname(
          this.migrationSource.path,
        )}`,
      );
      this.log.info(
        `File-to-sqlite migration target: ${path.dirname(this.namespacePath)}`,
      );
      const migrated = this.#migrateFromFileStorage(this.migrationSource.path);
      this.log.info(
        `File-to-sqlite migrated keys count per namespace ${path.basename(
          this.namespacePath,
        )}: ${migrated}`,
      );
      this.log.info(`Migration result: ${migrated > 0 ? "done" : "skipped"}`);
      return;
    }

    if (!existed && this.migrationSource) {
      const migrated = this.#migrateFromFileStorage(this.migrationSource.path);
      this.log.info(`Migration result: done (${migrated} keys)`);
      return;
    }

    this.log.info("Migration result: skipped");
  }

  override close() {
    this.#initialized = false;
    this.#db?.close();
    this.#db = undefined;
  }

  override get<T extends SupportedStorageTypes>(
    contexts: string[],
    key: string,
  ): T | undefined {
    const row = this.#getRow(this.#buildStorageKey(contexts, key));
    if (!row || row.value_type !== "json") {
      return undefined;
    }
    return fromJson(String(row.value)) as T;
  }

  override has(contexts: string[], key: string) {
    const row = this.#database()
      .prepare("SELECT 1 AS found FROM kv_store WHERE key = ?")
      .get(this.#buildStorageKey(contexts, key)) as
      | { found: number }
      | undefined;
    return row?.found === 1;
  }

  override set(
    contexts: string[],
    key: string,
    value: SupportedStorageTypes,
  ): void;
  override set(
    contexts: string[],
    values: Record<string, SupportedStorageTypes>,
  ): void;
  override set(
    contexts: string[],
    keyOrValues: string | Record<string, SupportedStorageTypes>,
    value?: SupportedStorageTypes,
  ) {
    if (typeof keyOrValues === "string") {
      if (value === undefined) {
        throw new StorageError(
          "Use null instead of undefined for storage values.",
        );
      }
      this.#setJson(this.#buildStorageKey(contexts, keyOrValues), value);
      return;
    }

    this.#withTransaction(() => {
      for (const [key, item] of Object.entries(keyOrValues)) {
        this.#setJson(this.#buildStorageKey(contexts, key), item);
      }
    });
  }

  override delete(contexts: string[], key: string) {
    this.#database()
      .prepare("DELETE FROM kv_store WHERE key = ?")
      .run(this.#buildStorageKey(contexts, key));
  }

  override keys(contexts: string[]) {
    const contextKey = this.#getContextBaseKey(contexts, true);
    const clusters: string[] = Object.values(ClusterId);
    if (
      contextKey.startsWith("root.parts.aggregator.parts.") &&
      clusters.some((cluster) => contextKey.endsWith(cluster))
    ) {
      return [];
    }

    const prefix = contextKey.length > 0 ? `${contextKey}.` : "";
    const keys = new Set<string>();
    for (const key of this.#allStorageKeys()) {
      if (!key.startsWith(prefix)) {
        continue;
      }
      const rest = key.slice(prefix.length);
      if (rest.length > 0 && !rest.includes(".")) {
        keys.add(rest);
      }
    }
    return [...keys];
  }

  override values(contexts: string[]) {
    const values = Object.create(null) as Record<string, SupportedStorageTypes>;
    for (const key of this.keys(contexts)) {
      const value = this.get(contexts, key);
      if (value !== undefined) {
        values[key] = value;
      }
    }
    return values;
  }

  override contexts(contexts: string[]) {
    const contextKey = this.#getContextBaseKey(contexts, true);
    const prefix = contextKey.length > 0 ? `${contextKey}.` : "";
    const childContexts = new Set<string>();

    for (const key of this.#allStorageKeys()) {
      if (!key.startsWith(prefix)) {
        continue;
      }
      const rest = key.slice(prefix.length);
      const separatorIndex = rest.indexOf(".");
      if (separatorIndex > 0) {
        childContexts.add(rest.slice(0, separatorIndex));
      }
    }

    return [...childContexts];
  }

  override clear() {
    this.#database().prepare("DELETE FROM kv_store").run();
  }

  override clearAll(contexts: string[]) {
    if (contexts.length === 0) {
      return;
    }

    const contextKey = this.#getContextBaseKey(contexts);
    const keysToDelete = this.#allStorageKeys().filter(
      (key) => key === contextKey || key.startsWith(`${contextKey}.`),
    );
    if (keysToDelete.length === 0) {
      return;
    }

    this.#withTransaction(() => {
      const statement = this.#database().prepare(
        "DELETE FROM kv_store WHERE key = ?",
      );
      for (const key of keysToDelete) {
        statement.run(key);
      }
    });
  }

  override openBlob(contexts: string[], key: string) {
    const row = this.#getRow(this.#buildStorageKey(contexts, key));
    if (!row) {
      return new Blob();
    }
    if (row.value_type === "blob") {
      return new Blob([toBlobPart(row.value as Uint8Array)]);
    }
    return new Blob([String(row.value)]);
  }

  override async writeBlobFromStream(
    contexts: string[],
    key: string,
    stream: ReadableStream<Bytes>,
  ) {
    const arrayBuffer = await new Response(stream).arrayBuffer();
    this.#database()
      .prepare(
        "INSERT INTO kv_store (key, value, value_type, updated_at) VALUES (?, ?, 'blob', ?) " +
          "ON CONFLICT(key) DO UPDATE SET value = excluded.value, value_type = excluded.value_type, updated_at = excluded.updated_at",
      )
      .run(
        this.#buildStorageKey(contexts, key),
        new Uint8Array(arrayBuffer),
        Date.now(),
      );
  }

  #setJson(key: string, value: SupportedStorageTypes) {
    this.#database()
      .prepare(
        "INSERT INTO kv_store (key, value, value_type, updated_at) VALUES (?, ?, 'json', ?) " +
          "ON CONFLICT(key) DO UPDATE SET value = excluded.value, value_type = excluded.value_type, updated_at = excluded.updated_at",
      )
      .run(key, toJson(value), Date.now());
  }

  #getRow(key: string) {
    return this.#database()
      .prepare("SELECT key, value, value_type FROM kv_store WHERE key = ?")
      .get(key) as StorageRow | undefined;
  }

  #allStorageKeys() {
    const rows = this.#database()
      .prepare("SELECT key FROM kv_store ORDER BY key")
      .all() as Array<{ key: string }>;
    return rows.map((row) => row.key);
  }

  #database() {
    if (!this.#db) {
      throw new StorageError("SQLite storage is not initialized.");
    }
    return this.#db;
  }

  #withTransaction(callback: () => void) {
    const db = this.#database();
    db.exec("BEGIN IMMEDIATE TRANSACTION");
    try {
      callback();
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  #migrateFromFileStorage(sourcePath: string) {
    const files = collectFiles(sourcePath);
    let migrated = 0;

    this.#withTransaction(() => {
      for (const file of files) {
        const relativePath = path.relative(sourcePath, file);
        if (shouldSkipMigrationFile(relativePath)) {
          continue;
        }

        const storageKey = decodeURIComponent(
          relativePath.split(path.sep).join("."),
        );
        if (!isValidStorageKey(storageKey)) {
          continue;
        }
        if (this.#getRow(storageKey)) {
          continue;
        }

        const content = fs.readFileSync(file);
        const text = content.toString("utf8");
        try {
          const value = fromJson(text) as SupportedStorageTypes;
          this.#setJson(storageKey, value);
        } catch {
          this.#database()
            .prepare(
              "INSERT INTO kv_store (key, value, value_type, updated_at) VALUES (?, ?, 'blob', ?) " +
                "ON CONFLICT(key) DO UPDATE SET value = excluded.value, value_type = excluded.value_type, updated_at = excluded.updated_at",
            )
            .run(storageKey, new Uint8Array(content), Date.now());
        }
        migrated++;
      }
    });

    return migrated;
  }

  #getContextBaseKey(contexts: string[], allowEmptyContext = false) {
    const contextKey = contexts.join(".");
    if (
      (!contextKey.length && !allowEmptyContext) ||
      contextKey.includes("..") ||
      contextKey.startsWith(".") ||
      contextKey.endsWith(".")
    ) {
      throw new StorageError(
        "Context must not be empty and must not contain dots.",
      );
    }
    return contextKey;
  }

  #buildStorageKey(contexts: string[], key: string) {
    if (!key.length) {
      throw new StorageError("Key must not be empty.");
    }
    return `${this.#getContextBaseKey(contexts)}.${key}`;
  }
}

function collectFiles(location: string): string[] {
  if (!fs.existsSync(location)) {
    return [];
  }

  const files: string[] = [];
  for (const entry of fs.readdirSync(location, { withFileTypes: true })) {
    const fullPath = path.join(location, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

function shouldSkipMigrationFile(relativePath: string) {
  const name = path.basename(relativePath);
  return (
    name === "storage.sqlite" ||
    name === "storage.sqlite-wal" ||
    name === "storage.sqlite-shm" ||
    (name.startsWith("backup.") && name.endsWith(".json"))
  );
}

function isValidStorageKey(storageKey: string) {
  return (
    storageKey.length > 0 &&
    !storageKey.includes("..") &&
    !storageKey.startsWith(".") &&
    !storageKey.endsWith(".") &&
    storageKey.includes(".")
  );
}

function toBlobPart(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

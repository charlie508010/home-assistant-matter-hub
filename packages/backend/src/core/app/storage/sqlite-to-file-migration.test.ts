import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SqliteCustomStorage } from "./sqlite-custom-storage.js";
import { migrateSqliteStorageToFileIfNeeded } from "./sqlite-to-file-migration.js";

function createTempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "hamh-sqlite-migration-test-"));
}

function createLogger() {
  return {
    info: vi.fn(),
  };
}

describe("migrateSqliteStorageToFileIfNeeded", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  it("does not create sqlite source directories when source is missing", () => {
    const root = createTempRoot();
    roots.push(root);
    const logger = createLogger();

    migrateSqliteStorageToFileIfNeeded(
      logger as never,
      path.join(root, "sqlite", "App"),
      path.join(root, "file", "App"),
    );

    expect(fs.existsSync(path.join(root, "sqlite"))).toBe(false);
    expect(fs.existsSync(path.join(root, "file", "App"))).toBe(false);
    expect(logger.info).toHaveBeenCalledWith(
      "SQLite-to-file migration skipped: source missing",
    );
  });

  it("does not migrate sqlite keys into an existing file storage", () => {
    const root = createTempRoot();
    roots.push(root);
    const sourcePath = path.join(root, "sqlite", "App");
    const targetPath = path.join(root, "file", "App");

    const sourceStorage = new SqliteCustomStorage(
      createLogger() as never,
      sourcePath,
      undefined,
    );
    sourceStorage.initialize();
    sourceStorage.set(["root"], "foo", "from-sqlite");
    sourceStorage.close();

    fs.mkdirSync(targetPath, { recursive: true });
    fs.writeFileSync(path.join(targetPath, "root.keep"), '"from-file"');

    const logger = createLogger();
    migrateSqliteStorageToFileIfNeeded(
      logger as never,
      sourcePath,
      targetPath,
    );

    expect(fs.existsSync(path.join(targetPath, "root.foo"))).toBe(false);
    expect(logger.info).toHaveBeenCalledWith(
      "SQLite-to-file migration skipped: target already has data",
    );
  });

  it("migrates sqlite keys when file storage is empty", () => {
    const root = createTempRoot();
    roots.push(root);
    const sourcePath = path.join(root, "sqlite", "App");
    const targetPath = path.join(root, "file", "App");

    const sourceStorage = new SqliteCustomStorage(
      createLogger() as never,
      sourcePath,
      undefined,
    );
    sourceStorage.initialize();
    sourceStorage.set(["root"], "foo", "from-sqlite");
    sourceStorage.close();

    const logger = createLogger();
    migrateSqliteStorageToFileIfNeeded(
      logger as never,
      sourcePath,
      targetPath,
    );

    expect(fs.readFileSync(path.join(targetPath, "root.foo"), "utf-8")).toBe(
      '"from-sqlite"',
    );
    expect(logger.info).toHaveBeenCalledWith(
      "SQLite-to-file migrated keys count per namespace App: 1",
    );
  });
});

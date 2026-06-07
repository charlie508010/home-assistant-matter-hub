import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
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
});

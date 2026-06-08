import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SqliteCustomStorage } from "./sqlite-custom-storage.js";

function createTempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "hamh-sqlite-storage-test-"));
}

function createLogger() {
  return {
    info: vi.fn(),
  };
}

describe("SqliteCustomStorage file migration", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  it("migrates missing file storage keys into existing sqlite storage without overwriting", () => {
    const root = createTempRoot();
    roots.push(root);
    const sourcePath = path.join(root, "file", "App");
    const targetPath = path.join(root, "sqlite", "App");
    fs.mkdirSync(sourcePath, { recursive: true });
    fs.writeFileSync(path.join(sourcePath, "root.foo"), '"from-file"');
    fs.writeFileSync(path.join(sourcePath, "root.keep"), '"from-file"');

    const setupStorage = new SqliteCustomStorage(
      createLogger() as never,
      targetPath,
      undefined,
    );
    setupStorage.initialize();
    setupStorage.set(["root"], "keep", "from-sqlite");
    setupStorage.close();

    const logger = createLogger();
    const storage = new SqliteCustomStorage(logger as never, targetPath, {
      kind: "file",
      path: sourcePath,
    });
    storage.initialize();

    expect(storage.get(["root"], "foo")).toBe("from-file");
    expect(storage.get(["root"], "keep")).toBe("from-sqlite");
    expect(logger.info).toHaveBeenCalledWith(
      `File-to-sqlite migration source: ${path.join(root, "file")}`,
    );
    expect(logger.info).toHaveBeenCalledWith(
      `File-to-sqlite migration target: ${path.join(root, "sqlite")}`,
    );
    expect(logger.info).toHaveBeenCalledWith(
      "File-to-sqlite migrated keys count per namespace App: 1",
    );
    storage.close();
  });
});

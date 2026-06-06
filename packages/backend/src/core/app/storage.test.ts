import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { migratePluginStorageToActiveRootIfNeeded } from "./storage.js";

function createTempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "hamh-storage-test-"));
}

function createLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
  };
}

describe("migratePluginStorageToActiveRootIfNeeded", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  it("copies plugin packages and registry from sqlite to file when file targets are missing", () => {
    const root = createTempRoot();
    roots.push(root);
    const sqlitePluginDir = path.join(root, "sqlite", "plugin-packages");
    fs.mkdirSync(path.join(sqlitePluginDir, "node_modules", "test-plugin"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(sqlitePluginDir, "package.json"),
      JSON.stringify({ dependencies: { "test-plugin": "1.0.0" } }),
    );
    fs.writeFileSync(
      path.join(sqlitePluginDir, "node_modules", "test-plugin", "index.js"),
      "export default class TestPlugin {}",
    );
    fs.writeFileSync(
      path.join(root, "sqlite", "installed-plugins.json"),
      JSON.stringify([{ packageName: "test-plugin" }]),
    );

    const logger = createLogger();
    migratePluginStorageToActiveRootIfNeeded(logger, path.join(root, "file"));

    expect(
      fs.existsSync(
        path.join(
          root,
          "file",
          "plugin-packages",
          "node_modules",
          "test-plugin",
          "index.js",
        ),
      ),
    ).toBe(true);
    expect(
      fs.readFileSync(
        path.join(root, "file", "installed-plugins.json"),
        "utf-8",
      ),
    ).toContain("test-plugin");
    expect(fs.existsSync(path.join(root, "sqlite", "plugin-packages"))).toBe(
      true,
    );
    expect(logger.info).toHaveBeenCalledWith(
      "Migrated plugin packages from sqlite to file",
    );
    expect(logger.info).toHaveBeenCalledWith(
      "Migrated installed plugins from sqlite to file",
    );
  });

  it("does not overwrite existing file backend plugin data", () => {
    const root = createTempRoot();
    roots.push(root);
    fs.mkdirSync(path.join(root, "sqlite", "plugin-packages"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(root, "sqlite", "installed-plugins.json"),
      JSON.stringify([{ packageName: "sqlite-plugin" }]),
    );
    fs.mkdirSync(path.join(root, "file", "plugin-packages"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(root, "file", "installed-plugins.json"),
      JSON.stringify([{ packageName: "file-plugin" }]),
    );

    const logger = createLogger();
    migratePluginStorageToActiveRootIfNeeded(logger, path.join(root, "file"));

    expect(
      fs.readFileSync(
        path.join(root, "file", "installed-plugins.json"),
        "utf-8",
      ),
    ).toContain("file-plugin");
    expect(logger.info).not.toHaveBeenCalled();
  });

  it("fills empty file backend plugin data from sqlite", () => {
    const root = createTempRoot();
    roots.push(root);
    fs.mkdirSync(path.join(root, "sqlite", "plugin-packages"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(root, "sqlite", "plugin-packages", "package.json"),
      JSON.stringify({ dependencies: { "sqlite-plugin": "1.2.3" } }),
    );
    fs.writeFileSync(
      path.join(root, "sqlite", "installed-plugins.json"),
      JSON.stringify([{ packageName: "sqlite-plugin" }]),
    );
    fs.mkdirSync(path.join(root, "file", "plugin-packages"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(root, "file", "plugin-packages", "package.json"),
      JSON.stringify({ name: "hamh-plugins", private: true }),
    );
    fs.writeFileSync(path.join(root, "file", "installed-plugins.json"), "[]");

    const logger = createLogger();
    migratePluginStorageToActiveRootIfNeeded(logger, path.join(root, "file"));

    expect(
      fs.readFileSync(
        path.join(root, "file", "plugin-packages", "package.json"),
        "utf-8",
      ),
    ).toContain("sqlite-plugin");
    expect(
      fs.readFileSync(
        path.join(root, "file", "installed-plugins.json"),
        "utf-8",
      ),
    ).toContain("sqlite-plugin");
  });

  it("does nothing for sqlite backend roots", () => {
    const root = createTempRoot();
    roots.push(root);
    fs.mkdirSync(path.join(root, "sqlite", "plugin-packages"), {
      recursive: true,
    });

    const logger = createLogger();
    migratePluginStorageToActiveRootIfNeeded(logger, path.join(root, "sqlite"));

    expect(fs.existsSync(path.join(root, "file"))).toBe(false);
    expect(logger.info).not.toHaveBeenCalled();
  });
});

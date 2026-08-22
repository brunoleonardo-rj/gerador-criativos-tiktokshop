import { lstat, mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { prepareStandalone } from "./prepare-standalone";

const temporaryDirectories: string[] = [];

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "gerador-standalone-"));
  temporaryDirectories.push(root);
  const source = path.join(root, ".next", "standalone");
  await mkdir(path.join(source, "node_modules", "example"), { recursive: true });
  await mkdir(path.join(root, "public"), { recursive: true });
  await mkdir(path.join(root, ".next", "static"), { recursive: true });
  await writeFile(path.join(source, "server.js"), "console.log('server');\n");
  await writeFile(path.join(source, "node_modules", "example", "index.js"), "module.exports = 'ok';\n");
  await writeFile(path.join(root, "public", "asset.txt"), "public asset");
  await writeFile(path.join(root, ".next", "static", "asset.txt"), "static asset");
  return { root, source, destination: path.join(root, ".next", "deploy") };
}

async function noLinks(directory: string): Promise<boolean> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const item = path.join(directory, entry.name);
    const info = await lstat(item);
    if (info.isSymbolicLink()) return false;
    if (info.isDirectory() && !(await noLinks(item))) return false;
  }
  return true;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("prepareStandalone", () => {
  it("dereferences file and directory links and copies runtime assets without links", async () => {
    const { root, source, destination } = await fixture();
    const outside = path.join(root, "outside");
    await mkdir(path.join(outside, "directory-target"), { recursive: true });
    await writeFile(path.join(outside, "file-target.js"), "module.exports = 'linked file';\n");
    await writeFile(path.join(outside, "directory-target", "nested.js"), "module.exports = 'linked directory';\n");
    try {
      await symlink(path.join(outside, "file-target.js"), path.join(source, "linked-file.js"), "file");
      await symlink(path.join(outside, "directory-target"), path.join(source, "linked-directory"), "junction");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EPERM") return;
      throw error;
    }

    await prepareStandalone({ workspaceRoot: root, source, destination });

    expect(await readFile(path.join(destination, "linked-file.js"), "utf8")).toBe("module.exports = 'linked file';\n");
    expect(await readFile(path.join(destination, "linked-directory", "nested.js"), "utf8")).toBe("module.exports = 'linked directory';\n");
    expect(await readFile(path.join(destination, "public", "asset.txt"), "utf8")).toBe("public asset");
    expect(await readFile(path.join(destination, ".next", "static", "asset.txt"), "utf8")).toBe("static asset");
    expect(await noLinks(destination)).toBe(true);
  });

  it("rejects a destination outside .next without removing an outside sentinel", async () => {
    const { root, source } = await fixture();
    const outside = path.join(root, "outside-destination");
    await mkdir(outside, { recursive: true });
    await writeFile(path.join(outside, "sentinel.txt"), "keep me");

    await expect(prepareStandalone({ workspaceRoot: root, source, destination: outside })).rejects.toThrow(/\.next/i);
    expect(await readFile(path.join(outside, "sentinel.txt"), "utf8")).toBe("keep me");
  });

  it("rejects a directory-link cycle before producing a deployment tree", async () => {
    const { root, source, destination } = await fixture();
    try {
      await symlink(source, path.join(source, "cycle"), "junction");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EPERM") return;
      throw error;
    }

    await expect(prepareStandalone({ workspaceRoot: root, source, destination })).rejects.toThrow(/ciclo/i);
    await expect(lstat(destination)).rejects.toThrow();
  });

  it("reports a pnpm-shaped broken link explicitly without touching the destination", async () => {
    const { root, source, destination } = await fixture();
    const packageDirectory = path.join(source, "node_modules", ".pnpm", "@img+sharp-darwin-arm64@0.35.3", "node_modules", "@img");
    await mkdir(packageDirectory, { recursive: true });
    const link = path.join(packageDirectory, "sharp-libvips-darwin-arm64");
    try {
      await symlink("../../../../@img+sharp-libvips-darwin-arm64@1.3.2/node_modules/@img/sharp-libvips-darwin-arm64", link, "file");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EPERM") return;
      throw error;
    }

    await expect(prepareStandalone({ workspaceRoot: root, source, destination })).rejects.toThrow(/link quebrado/i);
    await expect(lstat(destination)).rejects.toThrow();
  });

  it("promotes a traced pnpm Next runtime dependency that has no top-level link", async () => {
    const { source, root, destination } = await fixture();
    const next = path.join(source, "node_modules", "next");
    const env = path.join(source, "node_modules", ".pnpm", "@next+env@1.0.0", "node_modules", "@next", "env");
    await mkdir(next, { recursive: true });
    await mkdir(env, { recursive: true });
    await writeFile(path.join(next, "package.json"), JSON.stringify({ dependencies: { "@next/env": "1.0.0" } }));
    await writeFile(path.join(env, "package.json"), JSON.stringify({ name: "@next/env", version: "1.0.0" }));
    await writeFile(path.join(env, "index.js"), "module.exports = 'runtime env';\n");

    await prepareStandalone({ workspaceRoot: root, source, destination });

    expect(await readFile(path.join(destination, "node_modules", "@next", "env", "index.js"), "utf8"))
      .toBe("module.exports = 'runtime env';\n");
  });
});

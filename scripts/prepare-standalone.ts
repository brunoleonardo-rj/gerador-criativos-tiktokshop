import { chmod, copyFile, lstat, mkdir, readFile, readlink, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type StandaloneOptions = {
  workspaceRoot?: string;
  source?: string;
  destination?: string;
};

function isStrictlyInside(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative !== "" && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative);
}

async function assertDestinationIsSafe(workspaceRoot: string, source: string, destination: string): Promise<void> {
  const nextRoot = path.resolve(workspaceRoot, ".next");
  if (!isStrictlyInside(nextRoot, destination)) throw new Error("O destino deve ficar estritamente dentro de .next.");
  if (destination === source || isStrictlyInside(destination, source)) {
    throw new Error("O destino não pode ser a origem nem conter a origem standalone.");
  }

  let current = workspaceRoot;
  const components = path.relative(workspaceRoot, destination).split(path.sep);
  for (const component of components) {
    current = path.join(current, component);
    try {
      const info = await lstat(current);
      if (info.isSymbolicLink()) throw new Error("O destino não pode atravessar um link simbólico ou junction existente.");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      break;
    }
  }
}

function lexicalPath(value: string): string {
  const resolved = path.resolve(value);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

async function targetOfLink(source: string): Promise<string> {
  const target = await readlink(source);
  const resolved = path.resolve(path.dirname(source), target);
  try {
    await lstat(resolved);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error("A árvore standalone contém um link quebrado.");
    }
    throw error;
  }
  return resolved;
}

async function copyMaterialized(
  source: string,
  destination: string,
  activeDirectories: Set<string>,
  activeLinks: Set<string>,
): Promise<void> {
  const resolved = path.resolve(source);
  const sourceLink = await lstat(resolved);
  if (sourceLink.isSymbolicLink()) {
    const linkKey = lexicalPath(resolved);
    if (activeLinks.has(linkKey)) throw new Error("Foi detectado um ciclo de links na árvore standalone.");
    activeLinks.add(linkKey);
    try {
      await copyMaterialized(await targetOfLink(resolved), destination, activeDirectories, activeLinks);
    } finally {
      activeLinks.delete(linkKey);
    }
    return;
  }

  const info = await stat(resolved);
  if (info.isDirectory()) {
    const directoryKey = lexicalPath(resolved);
    if (activeDirectories.has(directoryKey)) throw new Error("Foi detectado um ciclo de links na árvore standalone.");
    activeDirectories.add(directoryKey);
    try {
      await mkdir(destination, { recursive: true, mode: info.mode & 0o777 });
      for (const entry of await readdir(resolved)) {
        await copyMaterialized(path.join(resolved, entry), path.join(destination, entry), activeDirectories, activeLinks);
      }
      await chmod(destination, info.mode & 0o777);
    } finally {
      activeDirectories.delete(directoryKey);
    }
    return;
  }
  if (!info.isFile()) throw new Error("A árvore standalone contém um tipo de arquivo não suportado.");
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(resolved, destination);
  await chmod(destination, info.mode & 0o777);
}

async function assertNoLinks(directory: string): Promise<void> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const item = path.join(directory, entry.name);
    const info = await lstat(item);
    if (info.isSymbolicLink()) throw new Error("A entrega materializada ainda contém um link simbólico ou junction.");
    if (info.isDirectory()) await assertNoLinks(item);
  }
}

async function pathExists(item: string): Promise<boolean> {
  try {
    await lstat(item);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function readPackageManifest(packageDirectory: string): Promise<{ name?: string; version?: string; dependencies?: Record<string, string> }> {
  return JSON.parse(await readFile(path.join(packageDirectory, "package.json"), "utf8")) as {
    name?: string;
    version?: string;
    dependencies?: Record<string, string>;
  };
}

async function findPnpmPackage(store: string, packageName: string, version?: string): Promise<string | undefined> {
  for (const entry of await readdir(store, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const candidate = path.join(store, entry.name, "node_modules", packageName);
    if (!(await pathExists(candidate))) continue;
    const manifest = await readPackageManifest(candidate);
    if (manifest.name === packageName && (!version || manifest.version === version)) return candidate;
  }
  return undefined;
}

async function packageDirectories(nodeModules: string): Promise<string[]> {
  const packages: string[] = [];
  for (const entry of await readdir(nodeModules, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const item = path.join(nodeModules, entry.name);
    if (!entry.name.startsWith("@")) {
      packages.push(item);
      continue;
    }
    for (const scopedEntry of await readdir(item, { withFileTypes: true })) {
      if (scopedEntry.isDirectory()) packages.push(path.join(item, scopedEntry.name));
    }
  }
  return packages;
}

async function materializePackageDependencies(nodeModules: string, store: string): Promise<void> {
  const queue = await packageDirectories(nodeModules);
  const visited = new Set<string>();
  while (queue.length > 0) {
    const packageDirectory = queue.shift()!;
    const key = lexicalPath(packageDirectory);
    if (visited.has(key)) continue;
    visited.add(key);
    if (!(await pathExists(path.join(packageDirectory, "package.json")))) continue;

    const manifest = await readPackageManifest(packageDirectory);
    const dependencies: Array<[string, string | undefined]> = Object.entries(manifest.dependencies ?? {});
    if (manifest.name === "better-sqlite3") dependencies.push(["bindings", undefined]);

    for (const [name, version] of dependencies) {
      const target = path.join(nodeModules, name);
      if (!(await pathExists(target))) {
        const candidate = await findPnpmPackage(store, name, version);
        if (!candidate) continue;
        await copyMaterialized(candidate, target, new Set(), new Set());
      }
      queue.push(target);
    }
  }
}

async function materializeRuntimeDependencies(destination: string): Promise<void> {
  const rootNodeModules = path.join(destination, "node_modules");
  const store = path.join(rootNodeModules, ".pnpm");
  if (!(await pathExists(store))) return;

  await materializePackageDependencies(rootNodeModules, store);
  const tracedNodeModules = path.join(destination, ".next", "node_modules");
  if (await pathExists(tracedNodeModules)) {
    await materializePackageDependencies(tracedNodeModules, store);
  }
}

export async function prepareStandalone(options: StandaloneOptions = {}): Promise<{ destination: string }> {
  const workspaceRoot = path.resolve(options.workspaceRoot ?? process.cwd());
  const source = path.resolve(options.source ?? path.join(workspaceRoot, ".next", "standalone"));
  const destination = path.resolve(options.destination ?? path.join(workspaceRoot, ".next", "deploy"));
  if (!(await stat(source)).isDirectory()) throw new Error("A origem standalone não existe ou não é um diretório.");
  await assertDestinationIsSafe(workspaceRoot, source, destination);

  await rm(destination, { recursive: true, force: true });
  try {
    await copyMaterialized(source, destination, new Set(), new Set());
    for (const asset of [
      { source: path.join(workspaceRoot, "public"), destination: path.join(destination, "public") },
      { source: path.join(workspaceRoot, ".next", "static"), destination: path.join(destination, ".next", "static") },
    ]) {
      try {
        await stat(asset.source);
        await copyMaterialized(asset.source, asset.destination, new Set(), new Set());
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    await materializeRuntimeDependencies(destination);
    await assertNoLinks(destination);
    if (!(await stat(path.join(destination, "server.js"))).isFile() || !(await stat(path.join(destination, "node_modules"))).isDirectory()) {
      throw new Error("A entrega materializada não contém o runtime standalone completo.");
    }
  } catch (error) {
    await rm(destination, { recursive: true, force: true });
    throw error;
  }
  return { destination };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  prepareStandalone().then(({ destination }) => {
    process.stdout.write(`Standalone materializado em ${destination}.\n`);
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Falha ao materializar standalone.";
    process.stderr.write(`Standalone não preparado: ${message}\n`);
    process.exitCode = 1;
  });
}

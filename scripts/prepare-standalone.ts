import { chmod, copyFile, lstat, mkdir, readdir, realpath, rm, stat } from "node:fs/promises";
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

async function copyMaterialized(source: string, destination: string, activeDirectories: Set<string>): Promise<void> {
  const sourceLink = await lstat(source);
  const resolved = sourceLink.isSymbolicLink() ? await realpath(source) : source;
  const info = await stat(resolved);
  if (info.isDirectory()) {
    const canonicalDirectory = await realpath(resolved);
    if (activeDirectories.has(canonicalDirectory)) throw new Error("Foi detectado um ciclo de links na árvore standalone.");
    activeDirectories.add(canonicalDirectory);
    try {
      await mkdir(destination, { recursive: true, mode: info.mode & 0o777 });
      for (const entry of await readdir(canonicalDirectory)) {
        await copyMaterialized(path.join(canonicalDirectory, entry), path.join(destination, entry), activeDirectories);
      }
      await chmod(destination, info.mode & 0o777);
    } finally {
      activeDirectories.delete(canonicalDirectory);
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

export async function prepareStandalone(options: StandaloneOptions = {}): Promise<{ destination: string }> {
  const workspaceRoot = path.resolve(options.workspaceRoot ?? process.cwd());
  const source = path.resolve(options.source ?? path.join(workspaceRoot, ".next", "standalone"));
  const destination = path.resolve(options.destination ?? path.join(workspaceRoot, ".next", "deploy"));
  if (!(await stat(source)).isDirectory()) throw new Error("A origem standalone não existe ou não é um diretório.");
  await assertDestinationIsSafe(workspaceRoot, source, destination);

  await rm(destination, { recursive: true, force: true });
  try {
    await copyMaterialized(source, destination, new Set());
    for (const asset of [
      { source: path.join(workspaceRoot, "public"), destination: path.join(destination, "public") },
      { source: path.join(workspaceRoot, ".next", "static"), destination: path.join(destination, ".next", "static") },
    ]) {
      try {
        await stat(asset.source);
        await copyMaterialized(asset.source, asset.destination, new Set());
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
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

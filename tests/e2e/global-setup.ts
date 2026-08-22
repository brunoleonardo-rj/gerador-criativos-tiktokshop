import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { runMigrations } from "../../scripts/migrate";

const runtimeDir = path.resolve("test-results/runtime-data");

export default async function globalSetup() {
  await rm(runtimeDir, { recursive: true, force: true });
  await mkdir(runtimeDir, { recursive: true });
  const source = await readFile(path.resolve("resources/library/Biblioteca_Mestra_Copys_TikTok_Shop.xlsx"));
  const endOfCentralDirectory = source.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (endOfCentralDirectory < 0) throw new Error("Planilha de teste não é um ZIP válido.");
  const comment = Buffer.from("e2e");
  const commentLength = Buffer.alloc(2);
  commentLength.writeUInt16LE(comment.length);
  await writeFile(path.join(runtimeDir, "biblioteca-e2e.xlsx"), Buffer.concat([
    source.subarray(0, endOfCentralDirectory + 20), commentLength, comment,
  ]));
  await runMigrations({ env: { DATA_DIR: runtimeDir } });
}

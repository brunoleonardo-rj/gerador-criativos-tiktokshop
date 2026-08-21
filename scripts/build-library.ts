import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseLibraryWorkbook } from "../src/features/library/workbook";
import { serializeCorpus } from "../src/features/library/serialize";

const resourceDir = path.resolve("resources/library");
const sourcePath = path.join(resourceDir, "Biblioteca_Mestra_Copys_TikTok_Shop.xlsx");
const outputPath = path.join(resourceDir, "library.default.json");

async function main() {
  const source = await readFile(sourcePath);
  const sourceHash = createHash("sha256").update(source).digest("hex");
  const corpus = await parseLibraryWorkbook(source);
  if (corpus.creatives.length !== 75) throw new Error(`A fonte inicial deve conter exatamente 75 registros; encontrados ${corpus.creatives.length}`);
  const serialized = serializeCorpus(corpus);
  const outputHash = createHash("sha256").update(serialized).digest("hex");
  await mkdir(resourceDir, { recursive: true });
  const tempPath = path.join(resourceDir, `.library.default.${process.pid}.${Date.now()}.tmp`);
  await writeFile(tempPath, serialized, { encoding: "utf8", flag: "wx" });
  await rename(tempPath, outputPath);
  console.log(`Biblioteca gerada: ${corpus.creatives.length} registros | fonte ${sourceHash} | JSON ${outputHash}`);
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });

import { inflateRawSync } from "node:zlib";

const EOCD = 0x06054b50; const CENTRAL = 0x02014b50; const LOCAL = 0x04034b50;
const MAX_ENTRIES = 256; const MAX_ENTRY_EXPANDED = 5 * 1024 * 1024; const MAX_EXPANDED = 40 * 1024 * 1024;
const crcTable = Uint32Array.from({ length: 256 }, (_, seed) => { let value = seed; for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0); return value >>> 0; });
function crc32(data: Buffer) { let value = 0xffffffff; for (const byte of data) value = (value >>> 8) ^ crcTable[(value ^ byte) & 0xff]; return (value ^ 0xffffffff) >>> 0; }
function fail(message: string): never { throw new Error(`XLSX inválido: ${message}`); }
function findEocd(buffer: Buffer) { for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 65_557); offset -= 1) if (buffer.readUInt32LE(offset) === EOCD) return offset; return -1; }
function safeName(bytes: Buffer) { const name = bytes.toString("utf8"); if (!name || name.includes("\uFFFD") || name.startsWith("/") || name.includes("\\") || name.split("/").includes("..")) fail("caminho inseguro"); return name.normalize("NFC"); }

export function preflightXlsx(buffer: Buffer) {
  if (buffer.length < 22 || buffer.readUInt32LE(0) !== LOCAL) fail("assinatura ZIP ausente");
  const end = findEocd(buffer); if (end < 0) fail("diretório central ausente");
  if (end + 22 + buffer.readUInt16LE(end + 20) !== buffer.length) fail("metadados finais malformados");
  const disk = buffer.readUInt16LE(end + 4); const startDisk = buffer.readUInt16LE(end + 6); const diskCount = buffer.readUInt16LE(end + 8); const count = buffer.readUInt16LE(end + 10); const size = buffer.readUInt32LE(end + 12); const offset = buffer.readUInt32LE(end + 16);
  if (disk !== 0 || startDisk !== 0 || count === 0xffff || size === 0xffffffff || offset === 0xffffffff) fail("ZIP64 ou múltiplos discos não suportados");
  if (diskCount !== count) fail("contagem central inconsistente"); if (count > MAX_ENTRIES) fail("muitas entradas"); if (offset + size > end) fail("diretório central fora do arquivo");
  let cursor = offset; let actualTotal = 0; const names = new Set<string>(); const ranges: Array<{ start: number; end: number }> = [];
  for (let index = 0; index < count; index += 1) {
    if (cursor + 46 > offset + size || buffer.readUInt32LE(cursor) !== CENTRAL) fail("entrada central malformada");
    const flags = buffer.readUInt16LE(cursor + 8); const method = buffer.readUInt16LE(cursor + 10); const crc = buffer.readUInt32LE(cursor + 16); const compressed = buffer.readUInt32LE(cursor + 20); const uncompressed = buffer.readUInt32LE(cursor + 24); const nameLength = buffer.readUInt16LE(cursor + 28); const extraLength = buffer.readUInt16LE(cursor + 30); const noteLength = buffer.readUInt16LE(cursor + 32); const localOffset = buffer.readUInt32LE(cursor + 42); const entryEnd = cursor + 46 + nameLength + extraLength + noteLength;
    if (entryEnd > offset + size || localOffset + 30 > offset) fail("offset local inválido"); if ((flags & 1) !== 0) fail("entrada criptografada"); if ((flags & 8) !== 0) fail("data descriptor não suportado"); if ((flags & ~0x0800) !== 0) fail("flags ZIP não suportadas"); if (method !== 0 && method !== 8) fail("compressão não suportada"); if (uncompressed > MAX_ENTRY_EXPANDED) fail("entrada expandida excede o limite");
    const centralName = buffer.subarray(cursor + 46, cursor + 46 + nameLength); const normalizedName = safeName(centralName); if (names.has(normalizedName)) fail("entrada duplicada"); names.add(normalizedName);
    if (buffer.readUInt32LE(localOffset) !== LOCAL) fail("assinatura local inválida"); const localFlags = buffer.readUInt16LE(localOffset + 6); const localMethod = buffer.readUInt16LE(localOffset + 8); const localCrc = buffer.readUInt32LE(localOffset + 14); const localCompressed = buffer.readUInt32LE(localOffset + 18); const localUncompressed = buffer.readUInt32LE(localOffset + 22); const localNameLength = buffer.readUInt16LE(localOffset + 26); const localExtraLength = buffer.readUInt16LE(localOffset + 28); const dataStart = localOffset + 30 + localNameLength + localExtraLength; const dataEnd = dataStart + compressed;
    if (dataStart > offset || dataEnd > offset) fail("tamanho de entrada inválido"); const localName = buffer.subarray(localOffset + 30, localOffset + 30 + localNameLength);
    if (!localName.equals(centralName) || safeName(localName) !== normalizedName) fail("nome local inconsistente"); if (localFlags !== flags || localMethod !== method) fail("flags ou compressão local inconsistentes"); if (localCrc !== crc || localCompressed !== compressed || localUncompressed !== uncompressed) fail("tamanhos locais inconsistentes");
    let expanded: Buffer; const compressedData = buffer.subarray(dataStart, dataEnd);
    if (method === 0) { if (compressed !== uncompressed) fail("tamanho armazenado inconsistente"); expanded = compressedData; }
    else { try { expanded = inflateRawSync(compressedData, { maxOutputLength: MAX_ENTRY_EXPANDED }); } catch { fail("expansão deflate excede o limite ou é inválida"); } }
    if (expanded.length !== uncompressed) fail("conteúdo expandido não corresponde ao declarado"); if (crc32(expanded) !== crc) fail("CRC inválido"); actualTotal += expanded.length; if (actualTotal > MAX_EXPANDED) fail("conteúdo expandido excede o limite");
    ranges.push({ start: localOffset, end: dataEnd }); cursor = entryEnd;
  }
  if (cursor !== offset + size) fail("tamanho do diretório central inconsistente"); ranges.sort((a, b) => a.start - b.start); for (let index = 1; index < ranges.length; index += 1) if (ranges[index].start < ranges[index - 1].end) fail("entradas locais sobrepostas");
}

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;
const MAX_ENTRIES = 256;
const MAX_ENTRY_EXPANDED = 5 * 1024 * 1024;
const MAX_EXPANDED = 40 * 1024 * 1024;

function fail(message: string): never { throw new Error(`XLSX inválido: ${message}`); }
function findEocd(buffer: Buffer) {
  for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 65_557); offset -= 1) if (buffer.readUInt32LE(offset) === EOCD) return offset;
  return -1;
}
export function preflightXlsx(buffer: Buffer) {
  if (buffer.length < 22 || buffer.readUInt32LE(0) !== LOCAL) fail("assinatura ZIP ausente");
  const end = findEocd(buffer); if (end < 0) fail("diretório central ausente");
  const commentLength = buffer.readUInt16LE(end + 20); if (end + 22 + commentLength !== buffer.length) fail("metadados finais malformados");
  const disk = buffer.readUInt16LE(end + 4); const startDisk = buffer.readUInt16LE(end + 6); const diskCount = buffer.readUInt16LE(end + 8); const count = buffer.readUInt16LE(end + 10); const size = buffer.readUInt32LE(end + 12); const offset = buffer.readUInt32LE(end + 16);
  if (disk !== 0 || startDisk !== 0 || count === 0xffff || size === 0xffffffff || offset === 0xffffffff) fail("ZIP64 ou múltiplos discos não suportados");
  if (diskCount !== count) fail("contagem central inconsistente"); if (count > MAX_ENTRIES) fail("muitas entradas"); if (offset + size > end) fail("diretório central fora do arquivo");
  let cursor = offset; let expanded = 0;
  for (let index = 0; index < count; index += 1) {
    if (cursor + 46 > offset + size || buffer.readUInt32LE(cursor) !== CENTRAL) fail("entrada central malformada");
    const flags = buffer.readUInt16LE(cursor + 8); const compressed = buffer.readUInt32LE(cursor + 20); const uncompressed = buffer.readUInt32LE(cursor + 24); const nameLength = buffer.readUInt16LE(cursor + 28); const extraLength = buffer.readUInt16LE(cursor + 30); const noteLength = buffer.readUInt16LE(cursor + 32); const localOffset = buffer.readUInt32LE(cursor + 42); const entryEnd = cursor + 46 + nameLength + extraLength + noteLength;
    if ((flags & 1) !== 0) fail("entrada criptografada"); if (uncompressed > MAX_ENTRY_EXPANDED) fail("entrada expandida excede o limite"); expanded += uncompressed; if (expanded > MAX_EXPANDED) fail("conteúdo expandido excede o limite");
    if (entryEnd > offset + size || localOffset + 30 > offset || buffer.readUInt32LE(localOffset) !== LOCAL) fail("offset local inválido");
    const name = buffer.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8"); if (!name || name.startsWith("/") || name.includes("\\") || name.split("/").includes("..")) fail("caminho inseguro");
    const localName = buffer.readUInt16LE(localOffset + 26); const localExtra = buffer.readUInt16LE(localOffset + 28); if (localOffset + 30 + localName + localExtra + compressed > offset) fail("tamanho de entrada inválido");
    cursor = entryEnd;
  }
  if (cursor !== offset + size) fail("tamanho do diretório central inconsistente");
}

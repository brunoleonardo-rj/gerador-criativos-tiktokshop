import { describe, expect, it } from "vitest";
import { deflateRawSync } from "node:zlib";
import { buildWorkbookFixture } from "./workbook.test";
import { preflightXlsx } from "./zip";
const eocd = (buffer: Buffer) => buffer.lastIndexOf(Buffer.from("PK\x05\x06"));
const central = (buffer: Buffer) => buffer.indexOf(Buffer.from("PK\x01\x02"));
const localFor = (buffer: Buffer, centralOffset = central(buffer)) => buffer.readUInt32LE(centralOffset + 42);
const nextCentral = (buffer: Buffer, offset = central(buffer)) => buffer.indexOf(Buffer.from("PK\x01\x02"), offset + 4);
function deflatedCentral(buffer: Buffer) { for (let offset = central(buffer); offset >= 0; offset = nextCentral(buffer, offset)) if (buffer.readUInt16LE(offset + 10) === 8) return offset; throw new Error("fixture sem deflate"); }
function sameLengthPair(buffer: Buffer) { const entries: number[] = []; for (let offset = central(buffer); offset >= 0; offset = nextCentral(buffer, offset)) entries.push(offset); for (const first of entries) for (const second of entries) if (first !== second && buffer.readUInt16LE(first + 28) === buffer.readUInt16LE(second + 28)) return [first, second] as const; throw new Error("fixture sem par de nomes"); }
function oversizedDeflate() { const name = Buffer.from("xl/large.bin"); const compressed = deflateRawSync(Buffer.alloc(6 * 1024 * 1024)); const local = Buffer.alloc(30 + name.length + compressed.length); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8); local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(1, 22); local.writeUInt16LE(name.length, 26); name.copy(local, 30); compressed.copy(local, 30 + name.length); const centralDirectory = Buffer.alloc(46 + name.length); centralDirectory.writeUInt32LE(0x02014b50, 0); centralDirectory.writeUInt16LE(20, 4); centralDirectory.writeUInt16LE(20, 6); centralDirectory.writeUInt16LE(8, 10); centralDirectory.writeUInt32LE(compressed.length, 20); centralDirectory.writeUInt32LE(1, 24); centralDirectory.writeUInt16LE(name.length, 28); name.copy(centralDirectory, 46); const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10); end.writeUInt32LE(centralDirectory.length, 12); end.writeUInt32LE(local.length, 16); return Buffer.concat([local, centralDirectory, end]); }
describe("preflightXlsx", () => {
  it("aceita um XLSX normal", async () => {
    const valid = await buildWorkbookFixture([{ id: "1", produto: "P", mecanismo: "M" }]);
    expect(() => preflightXlsx(valid)).not.toThrow();
  });
  it("rejeita contagem e tamanho central além dos limites", async () => {
    const many = await buildWorkbookFixture([{ id: "1", produto: "P", mecanismo: "M" }]); many.writeUInt16LE(257, eocd(many) + 10); expect(() => preflightXlsx(many)).toThrow(/contagem|entradas/);
    const large = await buildWorkbookFixture([{ id: "1", produto: "P", mecanismo: "M" }]); large.writeUInt32LE(6 * 1024 * 1024, central(large) + 24); expect(() => preflightXlsx(large)).toThrow(/expandid/);
  });
  it("rejeita contradições de nome, tamanhos, flags e data descriptor", async () => {
    const name = await buildWorkbookFixture([{ id: "1", produto: "P", mecanismo: "M" }]); const nameCentral = central(name); name[localFor(name, nameCentral) + 30] ^= 1; expect(() => preflightXlsx(name)).toThrow(/nome/);
    const size = await buildWorkbookFixture([{ id: "1", produto: "P", mecanismo: "M" }]); const sizeCentral = central(size); size.writeUInt32LE(1, localFor(size, sizeCentral) + 18); expect(() => preflightXlsx(size)).toThrow(/tamanhos/);
    const flags = await buildWorkbookFixture([{ id: "1", produto: "P", mecanismo: "M" }]); const flagsCentral = central(flags); flags.writeUInt16LE(8, flagsCentral + 8); flags.writeUInt16LE(8, localFor(flags, flagsCentral) + 6); expect(() => preflightXlsx(flags)).toThrow(/data descriptor/);
    const encrypted = await buildWorkbookFixture([{ id: "1", produto: "P", mecanismo: "M" }]); const encryptedCentral = central(encrypted); encrypted.writeUInt16LE(1, encryptedCentral + 8); encrypted.writeUInt16LE(1, localFor(encrypted, encryptedCentral) + 6); expect(() => preflightXlsx(encrypted)).toThrow(/criptografada/);
  });
  it("rejeita entradas duplicadas/sobrepostas e expansão deflate diferente da declarada", async () => {
    const duplicate = await buildWorkbookFixture([{ id: "1", produto: "P", mecanismo: "M" }]); const [nameSource, nameTarget] = sameLengthPair(duplicate); const length = duplicate.readUInt16LE(nameSource + 28); duplicate.copy(duplicate, nameTarget + 46, nameSource + 46, nameSource + 46 + length); duplicate.copy(duplicate, localFor(duplicate, nameTarget) + 30, nameSource + 46, nameSource + 46 + length); expect(() => preflightXlsx(duplicate)).toThrow(/duplicada/);
    const overlap = await buildWorkbookFixture([{ id: "1", produto: "P", mecanismo: "M" }]); const first = central(overlap); const second = nextCentral(overlap, first); overlap.writeUInt32LE(localFor(overlap, first), second + 42); expect(() => preflightXlsx(overlap)).toThrow(/nome local inconsistente|sobrepostas/);
    const inflated = await buildWorkbookFixture([{ id: "1", produto: "P", mecanismo: "M" }]); const deflated = deflatedCentral(inflated); const local = localFor(inflated, deflated); inflated.writeUInt32LE(1, deflated + 24); inflated.writeUInt32LE(1, local + 22); expect(() => preflightXlsx(inflated)).toThrow(/expandido/);
    expect(() => preflightXlsx(oversizedDeflate())).toThrow(/deflate excede/);
  });
});

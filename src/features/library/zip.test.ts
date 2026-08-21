import { describe, expect, it } from "vitest";
import { buildWorkbookFixture } from "./workbook.test";
import { preflightXlsx } from "./zip";
const eocd = (buffer: Buffer) => buffer.lastIndexOf(Buffer.from("PK\x05\x06"));
const central = (buffer: Buffer) => buffer.indexOf(Buffer.from("PK\x01\x02"));
describe("preflightXlsx", () => {
  it("aceita um XLSX normal", async () => {
    const valid = await buildWorkbookFixture([{ id: "1", produto: "P", mecanismo: "M" }]);
    expect(() => preflightXlsx(valid)).not.toThrow();
  });
  it("rejeita contagem e tamanho central além dos limites", async () => {
    const many = await buildWorkbookFixture([{ id: "1", produto: "P", mecanismo: "M" }]); many.writeUInt16LE(257, eocd(many) + 10); expect(() => preflightXlsx(many)).toThrow(/contagem|entradas/);
    const large = await buildWorkbookFixture([{ id: "1", produto: "P", mecanismo: "M" }]); large.writeUInt32LE(6 * 1024 * 1024, central(large) + 24); expect(() => preflightXlsx(large)).toThrow(/expandid/);
  });
});

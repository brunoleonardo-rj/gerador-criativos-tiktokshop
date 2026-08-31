// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readImageDimensions } from "./image-dimensions";

// Cabeçalhos mínimos, montados à mão, porque o diagnóstico depende de ler isto certo.
function pngHeader(width: number, height: number): Buffer {
  const bytes = Buffer.alloc(24);
  bytes.writeUInt32BE(0x89504e47, 0);
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
}

function jpegHeader(width: number, height: number): Buffer {
  const bytes = Buffer.alloc(20, 0);
  bytes[0] = 0xff; bytes[1] = 0xd8;
  bytes[2] = 0xff; bytes[3] = 0xc0;
  bytes.writeUInt16BE(11, 4);
  bytes[6] = 8;
  bytes.writeUInt16BE(height, 7);
  bytes.writeUInt16BE(width, 9);
  return bytes;
}

describe("readImageDimensions", () => {
  it("lê PNG", () => {
    expect(readImageDimensions(pngHeader(1080, 7000))).toEqual({ width: 1080, height: 7000 });
  });

  it("lê JPEG", () => {
    expect(readImageDimensions(jpegHeader(769, 1465))).toEqual({ width: 769, height: 1465 });
  });

  it("devolve null em vez de lançar quando não reconhece", () => {
    expect(readImageDimensions(Buffer.from("não é imagem"))).toBeNull();
    expect(readImageDimensions(Buffer.alloc(0))).toBeNull();
  });
});

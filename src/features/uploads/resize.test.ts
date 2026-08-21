import { afterEach, describe, expect, it, vi } from "vitest";
import { calculateResizeDimensions, resizeImage } from "./resize";

const originalBitmap = globalThis.createImageBitmap;
afterEach(() => { vi.restoreAllMocks(); Object.defineProperty(globalThis, "createImageBitmap", { configurable: true, value: originalBitmap }); });

function canvasFixture(alpha = 255, encoded: Blob | null = new Blob(["encoded"], { type: "image/jpeg" })) {
  const context = { drawImage: vi.fn(), getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([0, 0, 0, alpha]) })) };
  const canvas = { width: 0, height: 0, getContext: vi.fn(() => context), toBlob: vi.fn((callback: (blob: Blob | null) => void) => callback(encoded)) } as unknown as HTMLCanvasElement;
  vi.spyOn(document, "createElement").mockReturnValue(canvas);
  return { canvas, context };
}

describe("calculateResizeDimensions", () => {
  it("limits landscape, portrait, and square images while retaining proportion", () => {
    expect(calculateResizeDimensions(4000, 3000)).toEqual({ width: 1568, height: 1176 });
    expect(calculateResizeDimensions(3000, 4000)).toEqual({ width: 1176, height: 1568 });
    expect(calculateResizeDimensions(2000, 2000)).toEqual({ width: 1568, height: 1568 });
  });

  it("never enlarges smaller images and rounds dimensions", () => {
    expect(calculateResizeDimensions(800, 600)).toEqual({ width: 800, height: 600 });
    expect(calculateResizeDimensions(1569, 1000)).toEqual({ width: 1568, height: 999 });
  });

  it("rejects invalid source or maximum dimensions", () => {
    expect(() => calculateResizeDimensions(0, 100)).toThrow(/dimensions/i);
    expect(() => calculateResizeDimensions(100, Number.NaN)).toThrow(/dimensions/i);
    expect(() => calculateResizeDimensions(100, 100, 0)).toThrow(/maximum/i);
  });
});

describe("resizeImage", () => {
  it("orients, resizes, encodes JPEG at quality .85, and renames its file", async () => {
    const close = vi.fn(); const bitmap = { width: 4000, height: 3000, close } as unknown as ImageBitmap;
    Object.defineProperty(globalThis, "createImageBitmap", { configurable: true, value: vi.fn().mockResolvedValue(bitmap) });
    const { canvas, context } = canvasFixture();
    const output = await resizeImage(new File(["x"], "original.png", { type: "image/png" }));
    expect(createImageBitmap).toHaveBeenCalledWith(expect.any(File), { imageOrientation: "from-image" });
    expect([canvas.width, canvas.height]).toEqual([1568, 1176]);
    expect(context.drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 1568, 1176);
    expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), "image/jpeg", 0.85);
    expect(output).toMatchObject({ type: "image/jpeg", name: "original.jpg", width: 1568, height: 1176 });
    expect(close).toHaveBeenCalledOnce();
  });

  it("keeps transparent PNG and WEBP extensions coherent", async () => {
    const bitmap = { width: 10, height: 10, close: vi.fn() } as unknown as ImageBitmap;
    Object.defineProperty(globalThis, "createImageBitmap", { configurable: true, value: vi.fn().mockResolvedValue(bitmap) });
    const first = canvasFixture(0, new Blob(["x"], { type: "image/png" }));
    await expect(resizeImage(new File(["x"], "alpha.jpg", { type: "image/png" }))).resolves.toMatchObject({ type: "image/png", name: "alpha.png" });
    expect(first.canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), "image/png", 0.85);
    const second = canvasFixture(255, new Blob(["x"], { type: "image/webp" }));
    await expect(resizeImage(new File(["x"], "still.png", { type: "image/webp" }))).resolves.toMatchObject({ type: "image/webp", name: "still.webp" });
    expect(second.canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), "image/webp", 0.85);
  });

  it("closes decoded sources on decode, context, and encode failures", async () => {
    const close = vi.fn(); const bitmap = { width: 10, height: 10, close } as unknown as ImageBitmap;
    Object.defineProperty(globalThis, "createImageBitmap", { configurable: true, value: vi.fn().mockResolvedValue(bitmap) });
    const canvas = { width: 0, height: 0, getContext: vi.fn(() => null) } as unknown as HTMLCanvasElement;
    vi.spyOn(document, "createElement").mockReturnValue(canvas);
    await expect(resizeImage(new File(["x"], "x.jpg", { type: "image/jpeg" }))).rejects.toThrow(/preparar/i);
    expect(close).toHaveBeenCalledOnce();
    Object.defineProperty(globalThis, "createImageBitmap", { configurable: true, value: vi.fn().mockRejectedValue(new Error("decode")) });
    await expect(resizeImage(new File(["x"], "x.jpg", { type: "image/jpeg" }))).rejects.toThrow("decode");
  });
});

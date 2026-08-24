import { afterEach, describe, expect, it, vi } from "vitest";
import type { StoredImage } from "@/features/draft/storage";
import { calculateResizeDimensions } from "./resize";
import { calculateVerticalTiles, findContentBounds, prepareSourceImages } from "./analysis-images";

const originalBitmap = globalThis.createImageBitmap;
afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(globalThis, "createImageBitmap", { configurable: true, value: originalBitmap });
});

describe("findContentBounds", () => {
  it("removes uniform black sidebars without cutting the page content", () => {
    const width = 20;
    const height = 100;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offset = (y * width + x) * 4;
        const value = x >= 6 && x < 14 ? 255 : 0;
        data[offset] = value;
        data[offset + 1] = value;
        data[offset + 2] = value;
        data[offset + 3] = 255;
      }
    }

    expect(findContentBounds({ data, width, height })).toEqual({ x: 6, y: 0, width: 8, height: 100 });
  });
});

describe("calculateVerticalTiles", () => {
  it("turns the reported TikTok capture into eight readable overlapping parts", () => {
    const tiles = calculateVerticalTiles({ x: 726, y: 0, width: 468, height: 13_715 }, 8);

    expect(tiles).toHaveLength(8);
    expect(tiles[0]).toMatchObject({ x: 726, y: 0, width: 468 });
    expect(tiles.at(-1)!.y + tiles.at(-1)!.height).toBe(13_715);
    expect(tiles.every((tile) => calculateResizeDimensions(tile.width, tile.height).width >= 400)).toBe(true);
    expect(tiles.slice(1).every((tile, index) => tile.y < tiles[index].y + tiles[index].height)).toBe(true);
  });
});

describe("prepareSourceImages", () => {
  it("keeps one uploaded capture in the UI but emits eight cropped files for the API", async () => {
    const detectionWidth = 287;
    const detectionHeight = 2048;
    const pixels = new Uint8ClampedArray(detectionWidth * detectionHeight * 4);
    for (let y = 0; y < detectionHeight; y += 1) {
      for (let x = 0; x < detectionWidth; x += 1) {
        const offset = (y * detectionWidth + x) * 4;
        const value = x >= 108 && x < 179 ? 255 : 0;
        pixels[offset] = value;
        pixels[offset + 1] = value;
        pixels[offset + 2] = value;
        pixels[offset + 3] = 255;
      }
    }
    const close = vi.fn();
    const bitmap = { width: 1920, height: 13_717, close } as unknown as ImageBitmap;
    Object.defineProperty(globalThis, "createImageBitmap", { configurable: true, value: vi.fn().mockResolvedValue(bitmap) });
    const tileCanvases: HTMLCanvasElement[] = [];
    let canvasCount = 0;
    vi.spyOn(document, "createElement").mockImplementation(() => {
      const isDetection = canvasCount++ === 0;
      const context = {
        drawImage: vi.fn(),
        getImageData: vi.fn(() => ({ data: pixels, width: detectionWidth, height: detectionHeight })),
      };
      const canvas = {
        width: 0,
        height: 0,
        getContext: vi.fn(() => context),
        toBlob: vi.fn((callback: (blob: Blob | null) => void, type: string) => callback(new Blob(["tile"], { type }))),
      } as unknown as HTMLCanvasElement;
      if (!isDetection) tileCanvases.push(canvas);
      return canvas;
    });
    const screenshot: StoredImage = {
      id: "11111111-1111-4111-8111-111111111111",
      role: "product",
      blob: new Blob(["original"], { type: "image/png" }),
      name: "page.png",
      type: "image/png",
      width: 1920,
      height: 13_717,
      size: 2_732_067,
    };

    const result = await prepareSourceImages([screenshot]);

    expect(result).toHaveLength(8);
    expect(result.map((part) => part.name)).toEqual(Array.from({ length: 8 }, (_, index) => `page-parte-${index + 1}.png`));
    expect(result.every((part) => part.role === "product" && part.type === "image/png")).toBe(true);
    expect(tileCanvases).toHaveLength(8);
    expect(tileCanvases.every((canvas) => canvas.width >= 400 && canvas.height <= 1568)).toBe(true);
    expect(close).toHaveBeenCalledOnce();
  });
});

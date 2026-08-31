import type { StoredImage } from "@/features/draft/storage";
import { calculateResizeDimensions, MAX_IMAGE_SIDE } from "./resize";

export type ImageBounds = { x: number; y: number; width: number; height: number };
export type PreparedSourceImage = Pick<StoredImage, "role" | "type"> & { blob: Blob; name: string };

type PixelImage = { data: Uint8ClampedArray; width: number; height: number };

function pixel(image: PixelImage, x: number, y: number): [number, number, number] {
  const offset = (y * image.width + x) * 4;
  return [image.data[offset], image.data[offset + 1], image.data[offset + 2]];
}

function distance(a: readonly number[], b: readonly number[]): number {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
}

export function findContentBounds(image: PixelImage): ImageBounds {
  const full = { x: 0, y: 0, width: image.width, height: image.height };
  if (image.width < 2 || image.height < 2 || image.data.length < image.width * image.height * 4) return full;

  const corners = [
    pixel(image, 0, 0),
    pixel(image, image.width - 1, 0),
    pixel(image, 0, image.height - 1),
    pixel(image, image.width - 1, image.height - 1),
  ];
  if (corners.some((corner) => distance(corners[0], corner) > 48)) return full;
  const background = corners[0];
  const differs = (x: number, y: number) => distance(pixel(image, x, y), background) > 60;

  const activeColumns: number[] = [];
  const columnThreshold = Math.max(1, Math.floor(image.height * 0.005));
  for (let x = 0; x < image.width; x += 1) {
    let active = 0;
    for (let y = 0; y < image.height && active < columnThreshold; y += 1) if (differs(x, y)) active += 1;
    if (active >= columnThreshold) activeColumns.push(x);
  }
  const activeRows: number[] = [];
  const rowThreshold = Math.max(1, Math.floor(image.width * 0.005));
  for (let y = 0; y < image.height; y += 1) {
    let active = 0;
    for (let x = 0; x < image.width && active < rowThreshold; x += 1) if (differs(x, y)) active += 1;
    if (active >= rowThreshold) activeRows.push(y);
  }
  if (!activeColumns.length || !activeRows.length) return full;

  const bounds = {
    x: activeColumns[0],
    y: activeRows[0],
    width: activeColumns.at(-1)! - activeColumns[0] + 1,
    height: activeRows.at(-1)! - activeRows[0] + 1,
  };
  return bounds.width >= image.width * 0.1 && bounds.height >= image.height * 0.1 ? bounds : full;
}

export function calculateVerticalTiles(bounds: ImageBounds, maxParts: number): ImageBounds[] {
  if (bounds.width <= 0 || bounds.height <= 0 || !Number.isInteger(maxParts) || maxParts < 1) throw new Error("Invalid tiling dimensions.");
  // Cada parte precisa caber na altura máxima aceita, senão o redimensionamento
  // volta a mirar a altura e derruba a largura junto. Com 3,5x a largura, toda
  // parte saía em ~470px e o texto virava borrão.
  const desiredParts = Math.max(1, Math.ceil(bounds.height / MAX_IMAGE_SIDE));
  const partCount = Math.min(maxParts, desiredParts);
  if (partCount === 1) return [{ ...bounds }];

  const overlap = Math.min(Math.round(bounds.width * 0.15), Math.floor(bounds.height / (partCount * 4)));
  const tileHeight = Math.ceil((bounds.height + overlap * (partCount - 1)) / partCount);
  const step = tileHeight - overlap;
  const finalY = bounds.y + bounds.height - tileHeight;
  return Array.from({ length: partCount }, (_, index) => ({
    x: bounds.x,
    y: index === partCount - 1 ? finalY : Math.min(bounds.y + index * step, finalY),
    width: bounds.width,
    height: tileHeight,
  }));
}

function encodedCanvas(canvas: HTMLCanvasElement, type: StoredImage["type"]): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Não foi possível preparar um recorte da imagem.")), type, 0.92);
  });
}

function detectionDimensions(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(1, 512 / width, 2048 / height);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

async function prepareLongImage(image: StoredImage, maxParts: number): Promise<PreparedSourceImage[]> {
  if (typeof createImageBitmap !== "function") throw new Error("Não foi possível decodificar a captura longa neste navegador.");
  const bitmap = await createImageBitmap(image.blob, { imageOrientation: "from-image" });
  try {
    const detection = detectionDimensions(bitmap.width, bitmap.height);
    const detectionCanvas = document.createElement("canvas");
    detectionCanvas.width = detection.width;
    detectionCanvas.height = detection.height;
    const detectionContext = detectionCanvas.getContext("2d", { willReadFrequently: true });
    if (!detectionContext) throw new Error("Não foi possível analisar as margens da imagem.");
    detectionContext.drawImage(bitmap, 0, 0, detection.width, detection.height);
    const sampledBounds = findContentBounds(detectionContext.getImageData(0, 0, detection.width, detection.height));
    const scaleX = bitmap.width / detection.width;
    const scaleY = bitmap.height / detection.height;
    const left = Math.floor(sampledBounds.x * scaleX);
    const top = Math.floor(sampledBounds.y * scaleY);
    const right = Math.min(bitmap.width, Math.ceil((sampledBounds.x + sampledBounds.width) * scaleX));
    const bottom = Math.min(bitmap.height, Math.ceil((sampledBounds.y + sampledBounds.height) * scaleY));
    const tiles = calculateVerticalTiles({ x: left, y: top, width: right - left, height: bottom - top }, maxParts);
    const baseName = image.name.replace(/\.[^.]*$/u, "") || "captura";
    const extension = image.type === "image/jpeg" ? "jpg" : image.type === "image/png" ? "png" : "webp";
    const prepared: PreparedSourceImage[] = [];
    for (const [index, tile] of tiles.entries()) {
      const output = calculateResizeDimensions(tile.width, tile.height);
      const canvas = document.createElement("canvas");
      canvas.width = output.width;
      canvas.height = output.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Não foi possível preparar um recorte da imagem.");
      context.drawImage(bitmap, tile.x, tile.y, tile.width, tile.height, 0, 0, output.width, output.height);
      prepared.push({
        role: image.role,
        type: image.type,
        blob: await encodedCanvas(canvas, image.type),
        name: `${baseName}-parte-${index + 1}.${extension}`,
      });
    }
    return prepared;
  } finally {
    bitmap.close();
  }
}

export async function prepareSourceImages(images: StoredImage[], maxParts = 8): Promise<PreparedSourceImage[]> {
  if (!Number.isInteger(maxParts) || maxParts < 1) throw new Error("Quantidade de recortes inválida.");
  const prepared: PreparedSourceImage[] = [];
  for (const [index, image] of images.entries()) {
    if (prepared.length >= maxParts) break;
    const remainingImages = images.length - index - 1;
    const available = maxParts - prepared.length;
    const reserved = Math.min(remainingImages, available - 1);
    const allowance = available - reserved;
    // Vale recortar sempre que a altura passa do limite, não só em capturas
    // muito longas: uma de 1080x3900 não era recortada e chegava com 434px.
    if (image.height > MAX_IMAGE_SIDE) {
      prepared.push(...await prepareLongImage(image, allowance));
    } else {
      prepared.push({ role: image.role, type: image.type, blob: image.blob, name: image.name });
    }
  }
  return prepared;
}

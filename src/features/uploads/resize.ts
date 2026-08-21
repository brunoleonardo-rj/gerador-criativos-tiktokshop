export const MAX_IMAGE_SIDE = 1568;
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AcceptedImageType = (typeof ACCEPTED_IMAGE_TYPES)[number];
export type ResizedImage = { blob: Blob; name: string; type: AcceptedImageType; width: number; height: number; size: number };

export function calculateResizeDimensions(width: number, height: number, maxSide = MAX_IMAGE_SIDE): { width: number; height: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error("Invalid image dimensions.");
  if (!Number.isFinite(maxSide) || maxSide <= 0) throw new Error("Invalid maximum image dimension.");
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

function acceptedType(type: string): type is AcceptedImageType { return (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(type); }

function canvasBlob(canvas: HTMLCanvasElement, type: AcceptedImageType): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Unable to encode image.")), type, 0.85));
}

function hasTransparency(canvas: HTMLCanvasElement): boolean {
  const { data } = canvas.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 3; index < data.length; index += 4) if (data[index] < 255) return true;
  return false;
}

export async function resizeImage(file: File): Promise<ResizedImage> {
  if (!acceptedType(file.type)) throw new Error("Formato de imagem não suportado. Use JPEG, PNG ou WEBP.");
  if (typeof createImageBitmap !== "function") throw new Error("Não foi possível decodificar a imagem neste navegador.");
  let source: ImageBitmap | undefined;
  try {
    source = await createImageBitmap(file, { imageOrientation: "from-image" });
    const dimensions = calculateResizeDimensions(source.width, source.height);
    const canvas = document.createElement("canvas");
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível preparar a imagem.");
    context.drawImage(source, 0, 0, dimensions.width, dimensions.height);
    const type: AcceptedImageType = file.type === "image/png" && hasTransparency(canvas) ? "image/png" : file.type === "image/webp" ? "image/webp" : "image/jpeg";
    const blob = await canvasBlob(canvas, type);
    return { blob, name: file.name, type, width: dimensions.width, height: dimensions.height, size: blob.size };
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error("Não foi possível processar a imagem.");
  } finally { source?.close(); }
}

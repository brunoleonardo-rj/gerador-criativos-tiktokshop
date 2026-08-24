import type { StoredImage } from "@/features/draft/storage";

export function getProductSourceImages(images: StoredImage[]): StoredImage[] {
  return images.filter((image) => image.role === "product" || image.role === "ad");
}

export function imageSelectionKey(images: StoredImage[]): string {
  return JSON.stringify(images.map(({ id, name, type, width, height, size }) => [id, name, type, width, height, size]));
}

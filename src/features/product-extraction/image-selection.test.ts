import { describe, expect, it } from "vitest";
import type { StoredImage } from "@/features/draft/storage";
import { getProductSourceImages, imageSelectionKey } from "./image-selection";

const image = (overrides: Partial<StoredImage> = {}): StoredImage => ({
  id: "11111111-1111-4111-8111-111111111111",
  role: "product",
  blob: new Blob(["product"], { type: "image/jpeg" }),
  name: "product.jpg",
  type: "image/jpeg",
  width: 800,
  height: 600,
  size: 7,
  order: 0,
  ...overrides,
});

describe("getProductSourceImages", () => {
  it("keeps displayed product and legacy ad sources in order without rewriting them", () => {
    const ad = image({ id: "22222222-2222-4222-8222-222222222222", role: "ad", name: "ad.jpg", order: 8 });
    const ugc = image({ id: "33333333-3333-4333-8333-333333333333", role: "ugc", name: "ugc.jpg", order: 1 });
    const product = image({ order: 4 });

    expect(getProductSourceImages([ad, ugc, product])).toEqual([ad, product]);
    expect(ad.role).toBe("ad");
  });
});

describe("imageSelectionKey", () => {
  it("changes when an image is added, removed, replaced, or reordered", () => {
    const first = image();
    const second = image({ id: "22222222-2222-4222-8222-222222222222", name: "detail.webp", type: "image/webp", size: 9 });

    expect(imageSelectionKey([first])).not.toBe(imageSelectionKey([first, second]));
    expect(imageSelectionKey([first, second])).not.toBe(imageSelectionKey([second, first]));
    expect(imageSelectionKey([first])).not.toBe(imageSelectionKey([{ ...first, size: first.size + 1 }]));
    expect(imageSelectionKey([first, second])).not.toBe(imageSelectionKey([first, { ...second, id: "44444444-4444-4444-8444-444444444444" }]));
  });

  it("uses only stable identity and image metadata", () => {
    const source = image();
    const sameMetadata = { ...source, role: "ad" as const, blob: new Blob(["different"], { type: source.type }), order: 99 };

    expect(imageSelectionKey([sameMetadata])).toBe(imageSelectionKey([source]));
  });
});

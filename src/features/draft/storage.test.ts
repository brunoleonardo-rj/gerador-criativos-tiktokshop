import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { assetStorage, draftStorage, type StoredImage } from "./storage";
import { validateCreativeBatch } from "@/features/generation/validation";
import { creativeBatchFixture, generationInputFixture } from "../../../tests/fixtures/creative-result";

const draft = {
  nomeProduto: "Body splash",
  categoria: "Perfumaria",
  descricaoPdp: "Cheiro marcante.",
  perfilUgc: "com_pessoa",
  quantidadeCriativos: 5,
  ambientesPermitidos: ["Quarto"],
  politicaPreco: "sem_preco" as const,
  duracaoTotal: 20 as const,
  povComEmoji: true,
  maxPalavrasPov: 11,
  quantidadeHashtags: 5,
  tomVoz: "natural",
};

const image: StoredImage = { id: "2e0f3224-5ab1-4a4c-bb09-49a8f66be4ef", role: "product", blob: new Blob(["x"], { type: "image/jpeg" }), name: "produto.jpg", type: "image/jpeg", width: 1, height: 1, size: 1 };

describe("draftStorage", () => {
  beforeEach(async () => {
    localStorage.clear();
    await assetStorage.clearImages();
    await assetStorage.clearResults();
  });

  it("persists only validated textual draft data", () => {
    draftStorage.save(draft);
    expect(draftStorage.load()).toEqual(draft);
    expect(localStorage.getItem("creative-generator:draft:v1")).not.toMatch(/Blob|data:image/i);
  });

  it("returns null for a corrupt or incompatible draft", () => {
    localStorage.setItem("creative-generator:draft:v1", "{not json");
    expect(draftStorage.load()).toBeNull();
    localStorage.setItem("creative-generator:draft:v1", JSON.stringify({ version: 2, draft }));
    expect(draftStorage.load()).toBeNull();
  });

  it("clears a saved draft without propagating unavailable storage failures", () => {
    draftStorage.save(draft);
    draftStorage.clear();
    expect(draftStorage.load()).toBeNull();
  });
});

describe("assetStorage", () => {
  beforeEach(async () => {
    await assetStorage.clearImages();
    await assetStorage.clearResults();
  });

  it("stores, lists, deletes, and clears images in IndexedDB", async () => {
    await assetStorage.putImage(image);
    expect(await assetStorage.listImages()).toMatchObject([{ id: image.id, role: "product", name: "produto.jpg" }]);
    await assetStorage.deleteImage(image.id);
    expect(await assetStorage.listImages()).toEqual([]);
    await assetStorage.putImage(image);
    await assetStorage.clearImages();
    expect(await assetStorage.listImages()).toEqual([]);
  });

  it("keeps generation results isolated from images", async () => {
    const result = { ...validateCreativeBatch(generationInputFixture(), creativeBatchFixture(), "Produto {{produto}} {{copy_completa}}"), id: "0ed35cb8-4f88-4ded-9f51-08404fc0f34f" };
    await assetStorage.putImage(image);
    await assetStorage.putResult(result);
    expect(await assetStorage.getResult(result.id)).toEqual(result);
    await assetStorage.clearImages();
    expect(await assetStorage.getResult(result.id)).toEqual(result);
  });

  it("preserves selection order instead of sorting opaque UUIDs", async () => {
    const first = { ...image, id: "f0000000-0000-4000-8000-000000000000" };
    const second = { ...image, id: "10000000-0000-4000-8000-000000000000", name: "segundo.jpg" };
    await assetStorage.putImage(first); await assetStorage.putImage(second);
    expect((await assetStorage.listImages()).map((item) => item.id)).toEqual([first.id, second.id]);
  });

  it("rejects malformed results and hides corrupt stored records", async () => {
    await expect(assetStorage.putResult({ id: "not-a-uuid" } as never)).rejects.toThrow();
    expect(await assetStorage.getResult("not-a-uuid")).toBeUndefined();
  });
});

import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { assetStorage, draftStorage, type StoredImage } from "./storage";

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

const image: StoredImage = { id: "img-1", role: "product", blob: new Blob(["x"], { type: "image/jpeg" }), name: "produto.jpg", type: "image/jpeg", width: 1, height: 1, size: 1 };

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
    expect(await assetStorage.listImages()).toMatchObject([{ id: "img-1", role: "product", name: "produto.jpg" }]);
    await assetStorage.deleteImage("img-1");
    expect(await assetStorage.listImages()).toEqual([]);
    await assetStorage.putImage(image);
    await assetStorage.clearImages();
    expect(await assetStorage.listImages()).toEqual([]);
  });

  it("keeps generation results isolated from images", async () => {
    const result = { id: "result-1", produtoNormalizado: "Body splash", fatos: [], riscos: [], checklistPublicacao: [], creatives: [], batchIssues: [], status: "valid" as const, settingsUpdatedAt: null };
    await assetStorage.putImage(image);
    await assetStorage.putResult(result);
    expect(await assetStorage.getResult("result-1")).toEqual(result);
    await assetStorage.clearImages();
    expect(await assetStorage.getResult("result-1")).toEqual(result);
  });
});

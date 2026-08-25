import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StoredImage } from "@/features/draft/storage";
import type { ProductExtraction } from "@/features/product-extraction/schema";
import { generationInputFixture, creativeBatchFixture } from "../../../tests/fixtures/creative-result";
import { validateCreativeBatch } from "@/features/generation/validation";
import { GenerationWizard, fromDraft, toDraft, type ProductAnalysisDraft, type WizardFormValues, type WizardServices } from "./generation-wizard";

vi.mock("@/features/uploads/resize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/uploads/resize")>()),
  resizeImage: vi.fn(async (file: File) => ({
    blob: new Blob([file], { type: "image/jpeg" }),
    name: file.name,
    type: "image/jpeg" as const,
    width: 20,
    height: 20,
    size: file.size,
  })),
}));

vi.mock("@/features/uploads/analysis-images", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/uploads/analysis-images")>()),
  prepareSourceImages: vi.fn(async (images: StoredImage[]) => images.flatMap((image) => image.height / image.width >= 4
    ? Array.from({ length: 8 }, (_, index) => ({ role: image.role, blob: new Blob([`part-${index + 1}`], { type: image.type }), type: image.type, name: `page-parte-${index + 1}.png` }))
    : [{ role: image.role, blob: image.blob, type: image.type, name: image.name }])),
}));

const base = generationInputFixture({ perfilUgc: "sem_pessoa" });
const product: StoredImage = { id: "11111111-1111-4111-8111-111111111111", role: "product", blob: new Blob(["product"], { type: "image/jpeg" }), name: "product.jpg", type: "image/jpeg", width: 400, height: 400, size: 7 };
const ad: StoredImage = { ...product, id: "33333333-3333-4333-8333-333333333333", role: "ad", name: "ad.jpg" };
const ugc: StoredImage = { ...product, id: "22222222-2222-4222-8222-222222222222", role: "ugc", name: "ugc.jpg" };
const productSelectionKey = '[["11111111-1111-4111-8111-111111111111","product.jpg","image/jpeg",400,400,7]]';
const validExtraction: ProductExtraction = {
  nomeProduto: "Garrafa",
  categoria: "Casa",
  descricaoPdp: "Garrafa térmica de aço inox.",
  avaliacoes: "Mantém a bebida gelada.",
  notaMedia: 4.8,
  quantidadeAvaliacoes: 1250,
  precoAtual: "R$ 79,90",
  precoAnterior: "R$ 99,90",
  especificacoesCriticas: ["Aço inox", "500 ml"],
  publicoAlvo: null,
  avisos: ["Público-alvo não identificado."],
  formatoUso: "manuseado",
  zonaFoco: "maos",
  detalheCritico: null,
};

type TestWizardServices = WizardServices & {
  extractProduct(form: FormData): Promise<ProductExtraction>;
};

function services(overrides: Partial<TestWizardServices> = {}): TestWizardServices {
  return {
    saveDraft: vi.fn(),
    loadDraft: () => base,
    listImages: async () => [],
    extractProduct: vi.fn(async () => validExtraction),
    generate: vi.fn(),
    saveResult: vi.fn(),
    navigate: vi.fn(),
    ...overrides,
  };
}

async function analyze(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "Analisar imagens" }));
  return screen.findByLabelText("Nome do produto");
}

describe("GenerationWizard", () => {
  it("keeps optional partial draft fields when a required field is empty", () => {
    const values: WizardFormValues = { nomeProduto: "", categoria: "Casa", descricaoPdp: "", avaliacoes: "Ótimas", notaMedia: "4.5", quantidadeAvaliacoes: "12", precoAtual: "R$ 20", precoAnterior: "R$ 30", especificacoesTexto: "Aço\n500 ml", publicoAlvo: "Adultos", perfilUgc: "", linkProduto: "https://example.com/p", quantidadeCriativos: "7", ambientesTexto: "cozinha\nquarto", politicaPreco: "teto_folgado", duracaoTotal: "30", povComEmoji: false, maxPalavrasPov: "9", quantidadeHashtags: "4", tomVoz: "direto", formatoUso: "manuseado", zonaFoco: "maos", detalheCriticoTexto: "" };
    const draft = toDraft(values);
    expect(draft).toMatchObject({ avaliacoes: "Ótimas", notaMedia: 4.5, quantidadeAvaliacoes: 12, precoAtual: "R$ 20", precoAnterior: "R$ 30", especificacoesCriticas: ["Aço", "500 ml"], publicoAlvo: "Adultos", linkProduto: "https://example.com/p", quantidadeCriativos: 7, ambientesPermitidos: ["cozinha", "quarto"], duracaoTotal: 30 });
    expect(fromDraft(draft)).toMatchObject({ ...values, nomeProduto: "", descricaoPdp: "", perfilUgc: "" });
  });

  it("omits blank optional numbers while preserving explicit zero", () => {
    const blank = toDraft({ ...fromDraft(base), notaMedia: "   ", quantidadeAvaliacoes: "" });
    expect(blank.notaMedia).toBeUndefined();
    expect(blank.quantidadeAvaliacoes).toBeUndefined();
    const zero = toDraft({ ...fromDraft(base), notaMedia: "0", quantidadeAvaliacoes: "0" });
    expect(zero.notaMedia).toBe(0);
    expect(zero.quantidadeAvaliacoes).toBe(0);
  });

  it("adds optional product analysis metadata to the textual draft", () => {
    const analysis: ProductAnalysisDraft = { productAnalysisKey: "selection-key", productExtractionWarnings: ["Preço não identificado"] };
    expect(toDraft(fromDraft(base), analysis)).toMatchObject(analysis);
  });

  it("shows an accessible three-step progress indicator", () => {
    render(<GenerationWizard services={services()} />);
    const navigation = screen.getByRole("navigation", { name: "Etapas da geração" });
    expect(navigation).toHaveTextContent("Produto");
    expect(navigation).toHaveTextContent("Referências");
    expect(navigation).toHaveTextContent("Direção");
    expect(screen.getByText("Etapa 1 de 3: Produto")).toBeVisible();
    expect(screen.getByText("Produto").closest("li")).toHaveAttribute("aria-current", "step");
  });

  it("flushes the latest partial draft when unmounted before the debounce", async () => {
    vi.useFakeTimers();
    const saveDraft = vi.fn();
    const view = render(<GenerationWizard services={services({ saveDraft, loadDraft: () => ({ ...base, productAnalysisKey: productSelectionKey }), listImages: async () => [product] })} />);
    await act(async () => undefined);
    vi.clearAllTimers();
    saveDraft.mockClear();
    fireEvent.change(screen.getByLabelText("Nome do produto"), { target: { value: "Rascunho" } });
    await vi.advanceTimersByTimeAsync(299);
    expect(saveDraft).not.toHaveBeenCalled();
    view.unmount();
    expect(saveDraft).toHaveBeenLastCalledWith(expect.objectContaining({ nomeProduto: "Rascunho", productAnalysisKey: productSelectionKey }));
  });

  it("persists once at exactly 300ms, never at 299ms", async () => {
    vi.useFakeTimers();
    const saveDraft = vi.fn();
    render(<GenerationWizard services={services({ saveDraft, loadDraft: () => ({ ...base, productAnalysisKey: productSelectionKey }), listImages: async () => [product] })} />);
    await act(async () => undefined);
    vi.clearAllTimers();
    saveDraft.mockClear();
    fireEvent.change(screen.getByLabelText("Nome do produto"), { target: { value: "Cronômetro" } });
    await vi.advanceTimersByTimeAsync(299);
    expect(saveDraft).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(saveDraft).toHaveBeenCalledTimes(1);
  });

  it("ignores a late image load after unmount", async () => {
    let resolveImages!: (images: []) => void;
    const listImages = vi.fn(() => new Promise<[]>((resolve) => { resolveImages = resolve; }));
    const view = render(<GenerationWizard services={services({ listImages })} />);
    view.unmount();
    await act(async () => { resolveImages([]); });
    expect(listImages).toHaveBeenCalledOnce();
  });

  it("finishes restoring persisted sources before accepting a new selection", async () => {
    let resolveImages!: (images: StoredImage[]) => void;
    const listImages = vi.fn(() => new Promise<StoredImage[]>((resolve) => { resolveImages = resolve; }));
    const putImage = vi.fn(async () => undefined);
    render(<GenerationWizard services={services({ listImages, putImage })} />);

    expect(screen.getByRole("status")).toHaveTextContent("Carregando imagens do produto");
    expect(screen.queryByLabelText("Fotos e prints do produto")).not.toBeInTheDocument();

    await act(async () => { resolveImages([product]); });
    const input = await screen.findByLabelText("Fotos e prints do produto");
    expect(screen.getByAltText("Prévia de product.jpg")).toBeInTheDocument();
    fireEvent.change(input, { target: { files: [new File(["new"], "new.jpg", { type: "image/jpeg" })] } });

    expect(await screen.findByAltText("Prévia de new.jpg")).toBeInTheDocument();
    expect(screen.getByAltText("Prévia de product.jpg")).toBeInTheDocument();
  });

  it("extracts product and legacy ad sources, opens review and blocks stale analysis", async () => {
    const saveDraft = vi.fn();
    const extractProduct = vi.fn(async (form: FormData) => {
      expect(form.getAll("source").map((entry) => entry instanceof File ? entry.name : "text")).toEqual(["product.jpg", "ad.jpg"]);
      return validExtraction;
    });
    const user = userEvent.setup();
    render(<GenerationWizard services={services({ saveDraft, listImages: async () => [product, ugc, ad], deleteImage: vi.fn(async () => undefined), extractProduct })} />);

    expect(await analyze(user)).toHaveValue("Garrafa");
    expect(screen.getByLabelText("Categoria")).toHaveValue("Casa");
    expect(screen.getByLabelText("Descrição do anúncio")).toHaveValue("Garrafa térmica de aço inox.");
    expect(screen.getByLabelText("Nota média")).toHaveValue(4.8);
    expect(screen.getByText("Público-alvo não identificado.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /trocar imagens/i }));
    await user.click(screen.getByRole("button", { name: /remover product.jpg/i }));

    expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("As imagens mudaram. Analise novamente antes de continuar.");
    await waitFor(() => expect(saveDraft).toHaveBeenLastCalledWith(expect.objectContaining({ nomeProduto: "Garrafa" })));
  });

  it("sends a single long capture as eight readable parts during extraction", async () => {
    const screenshot: StoredImage = { ...product, blob: new Blob(["long"], { type: "image/png" }), name: "page.png", type: "image/png", width: 1920, height: 13_717, size: 2_732_067 };
    const extractProduct = vi.fn(async (form: FormData) => {
      expect(form.getAll("source").map((entry) => entry instanceof File ? entry.name : "text"))
        .toEqual(Array.from({ length: 8 }, (_, index) => `page-parte-${index + 1}.png`));
      return validExtraction;
    });
    const user = userEvent.setup();
    render(<GenerationWizard services={services({ listImages: async () => [screenshot], extractProduct })} />);

    await analyze(user);

    await waitFor(() => expect(extractProduct).toHaveBeenCalledOnce());
  });

  it("prevents duplicate extraction requests while analysis is pending", async () => {
    let resolveExtraction!: (value: ProductExtraction) => void;
    const extractProduct = vi.fn(() => new Promise<ProductExtraction>((resolve) => { resolveExtraction = resolve; }));
    render(<GenerationWizard services={services({ listImages: async () => [product], extractProduct })} />);
    const button = await screen.findByRole("button", { name: "Analisar imagens" });

    fireEvent.click(button);
    fireEvent.click(button);

    await waitFor(() => expect(extractProduct).toHaveBeenCalledOnce());
    expect(await screen.findByRole("status")).toHaveTextContent(/lendo os dados do produto/i);
    resolveExtraction(validExtraction);
    expect(await screen.findByLabelText("Nome do produto")).toHaveValue("Garrafa");
  });

  it("links to settings when product extraction is not configured", async () => {
    const extractProduct = vi.fn().mockRejectedValue(new Error("API_NOT_CONFIGURED"));
    const user = userEvent.setup();
    render(<GenerationWizard services={services({ listImages: async () => [product], extractProduct })} />);

    await user.click(await screen.findByRole("button", { name: "Analisar imagens" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("A API ainda não foi configurada.");
    expect(screen.getByRole("link", { name: "Abrir Configurações" })).toHaveAttribute("href", "/configuracoes");
    expect(screen.getByAltText("Prévia de product.jpg")).toBeInTheDocument();
  });

  it("retries a failed extraction without losing source thumbnails", async () => {
    const extractProduct = vi.fn().mockRejectedValueOnce(new Error("UPSTREAM_UNAVAILABLE")).mockResolvedValueOnce(validExtraction);
    const user = userEvent.setup();
    render(<GenerationWizard services={services({ listImages: async () => [product], extractProduct })} />);

    await user.click(await screen.findByRole("button", { name: "Analisar imagens" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("O serviço está indisponível no momento.");
    expect(screen.getByAltText("Prévia de product.jpg")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(await screen.findByLabelText("Nome do produto")).toHaveValue("Garrafa");
    expect(extractProduct).toHaveBeenCalledTimes(2);
  });

  it("requires the reviewed product name, category and description before advancing", async () => {
    const extraction = { ...validExtraction, nomeProduto: null, categoria: null, descricaoPdp: null };
    const user = userEvent.setup();
    render(<GenerationWizard services={services({ listImages: async () => [product], extractProduct: vi.fn(async () => extraction) })} />);
    await analyze(user);

    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByText("Informe o nome do produto")).toBeInTheDocument();
    expect(screen.getByText("Informe a categoria")).toBeInTheDocument();
    expect(screen.getByText("Informe a descrição do anúncio")).toBeInTheDocument();
    expect(screen.getByText("Etapa 1 de 3: Produto")).toBeVisible();
  });

  it("keeps an old textual draft in upload state until its images receive a fresh analysis", async () => {
    const deleteImage = vi.fn();
    render(<GenerationWizard services={services({ loadDraft: () => base, listImages: async () => [product], deleteImage })} />);

    expect(await screen.findByRole("button", { name: "Analisar imagens" })).toBeEnabled();
    expect(screen.queryByLabelText("Nome do produto")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled();
    expect(deleteImage).not.toHaveBeenCalled();
  });

  it("does not analyze or auto-delete a legacy selection over eight sources", async () => {
    const legacySources = Array.from({ length: 9 }, (_, index): StoredImage => ({ ...product, id: `legacy-${index}`, role: index === 0 ? "ad" : "product", name: `source-${index}.jpg` }));
    const deleteImage = vi.fn(async () => undefined);
    const extractProduct = vi.fn(async () => validExtraction);
    const user = userEvent.setup();
    render(<GenerationWizard services={services({ listImages: async () => legacySources, deleteImage, extractProduct })} />);

    await user.click(await screen.findByRole("button", { name: "Analisar imagens" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/máximo de 8 imagens/i);
    expect(extractProduct).not.toHaveBeenCalled();
    expect(deleteImage).not.toHaveBeenCalled();
    expect(screen.getAllByRole("img")).toHaveLength(9);

    await user.click(screen.getByRole("button", { name: "Remover source-0.jpg" }));
    await waitFor(() => expect(deleteImage).toHaveBeenCalledWith("legacy-0"));
    await user.click(screen.getByRole("button", { name: "Analisar imagens" }));
    expect(await screen.findByLabelText("Nome do produto")).toHaveValue("Garrafa");
  });

  it("requires a profile and conditionally requires a UGC image in References", async () => {
    const user = userEvent.setup();
    render(<GenerationWizard services={services({ loadDraft: () => ({ ...base, perfilUgc: undefined }), listImages: async () => [product] })} />);
    await analyze(user);
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByText("Informe o perfil UGC")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Perfil UGC"), "masculino");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByText("Adicione ao menos uma foto da pessoa UGC.")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Perfil UGC"), "sem_pessoa");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByRole("group", { name: "Direção" })).toBeInTheDocument();
  });

  it("envia o briefing revisado com só a foto do produto e espera o resultado salvo", async () => {
    const result = validateCreativeBatch(base, creativeBatchFixture(), "{{copy_completa}}");
    let resolveSave!: () => void;
    const saveResult = vi.fn(() => new Promise<void>((resolve) => { resolveSave = resolve; }));
    const generate = vi.fn(async (form: FormData) => {
      expect([...form.keys()].sort()).toEqual(["payload", "product", "requestId"]);
      expect(String(form.get("requestId"))).toMatch(/^[0-9a-f-]{36}$/u);
      const payload = JSON.parse(String(form.get("payload"))) as Record<string, unknown>;
      expect(payload.nomeProduto).toBe("Garrafa revisada");
      expect(payload.perfilUgc).toBe("sem_pessoa");
      expect(payload.ambientesPermitidos).toEqual(["cozinha"]);
      expect(payload.quantidadeCriativos).toBe(1);
      expect(payload).not.toHaveProperty("linkProduto");
      expect(payload).not.toHaveProperty("productAnalysisKey");
      expect(payload).not.toHaveProperty("productExtractionWarnings");
      return result;
    });
    const navigate = vi.fn();
    const user = userEvent.setup();
    render(<GenerationWizard services={services({ loadDraft: () => ({ ...base, linkProduto: "https://example.com/link-antigo" }), listImages: async () => [product, ugc, ad], generate, saveResult, navigate })} />);
    await analyze(user);
    await user.clear(screen.getByLabelText("Nome do produto"));
    await user.type(screen.getByLabelText("Nome do produto"), "Garrafa revisada");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Gerar criativos" }));

    await waitFor(() => expect(saveResult).toHaveBeenCalled());
    expect(navigate).not.toHaveBeenCalled();
    resolveSave();
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(expect.stringMatching(/^\/resultado\//)));
  });

  it("não incentiva uma nova chamada paga quando a resposta do modelo é inválida", async () => {
    const generate = vi.fn().mockRejectedValue(new Error("INVALID_MODEL_OUTPUT"));
    const user = userEvent.setup();
    render(<GenerationWizard services={services({ loadDraft: () => ({ ...base, productAnalysisKey: productSelectionKey }), listImages: async () => [product], generate })} />);

    await screen.findByLabelText("Nome do produto");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Gerar criativos" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("não gere novamente com os mesmos dados");
    expect(screen.queryByRole("button", { name: "Tentar novamente" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gerar criativos" })).toBeDisabled();
    await user.clear(screen.getByLabelText("Quantidade de criativos"));
    await user.type(screen.getByLabelText("Quantidade de criativos"), "2");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gerar criativos" })).toBeEnabled();
    expect(generate).toHaveBeenCalledOnce();
  });

  it("reutiliza o identificador ao reenviar o mesmo briefing após indisponibilidade", async () => {
    const requestIds: string[] = [];
    const generate = vi.fn(async (form: FormData) => {
      requestIds.push(String(form.get("requestId")));
      throw new Error("UPSTREAM_UNAVAILABLE");
    });
    const user = userEvent.setup();
    render(<GenerationWizard services={services({ loadDraft: () => ({ ...base, productAnalysisKey: productSelectionKey }), listImages: async () => [product], generate })} />);

    await screen.findByLabelText("Nome do produto");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Gerar criativos" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("protegida contra nova cobrança por 5 minutos");
    expect(screen.queryByRole("button", { name: "Tentar novamente" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Gerar criativos" }));

    await waitFor(() => expect(generate).toHaveBeenCalledTimes(2));
    expect(requestIds[0]).toMatch(/^[0-9a-f-]{36}$/u);
    expect(requestIds[1]).toBe(requestIds[0]);
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GenerationWizard, fromDraft, toDraft, type WizardFormValues, type WizardServices } from "./generation-wizard";
import { generationInputFixture } from "../../../tests/fixtures/creative-result";
import { validateCreativeBatch } from "@/features/generation/validation";
import { creativeBatchFixture } from "../../../tests/fixtures/creative-result";

const base = generationInputFixture({ perfilUgc: "sem_pessoa" });
function services(overrides: Partial<WizardServices> = {}): WizardServices {
  return {
    saveDraft: vi.fn(), loadDraft: () => base, listImages: async () => [], generate: vi.fn(), saveResult: vi.fn(), navigate: vi.fn(),
    ...overrides,
  };
}

describe("GenerationWizard", () => {
  it("keeps optional partial draft fields when a required field is empty", () => {
    const values: WizardFormValues = { nomeProduto: "", categoria: "Casa", descricaoPdp: "", avaliacoes: "Ótimas", notaMedia: "4.5", quantidadeAvaliacoes: "12", precoAtual: "R$ 20", precoAnterior: "R$ 30", especificacoesTexto: "Aço\n500 ml", publicoAlvo: "Adultos", perfilUgc: "", linkProduto: "https://example.com/p", quantidadeCriativos: "7", ambientesTexto: "cozinha\nquarto", politicaPreco: "teto_folgado", duracaoTotal: "30", povComEmoji: false, maxPalavrasPov: "9", quantidadeHashtags: "4", tomVoz: "direto" };
    const draft = toDraft(values);
    expect(draft).toMatchObject({ avaliacoes: "Ótimas", notaMedia: 4.5, quantidadeAvaliacoes: 12, precoAtual: "R$ 20", precoAnterior: "R$ 30", especificacoesCriticas: ["Aço", "500 ml"], publicoAlvo: "Adultos", linkProduto: "https://example.com/p", quantidadeCriativos: 7, ambientesPermitidos: ["cozinha", "quarto"], duracaoTotal: 30 });
    expect(fromDraft(draft)).toMatchObject({ ...values, nomeProduto: "", descricaoPdp: "", perfilUgc: "" });
  });

  it("omits blank optional numbers while preserving explicit zero", () => {
    const blank = toDraft({ ...fromDraft(base), notaMedia: "   ", quantidadeAvaliacoes: "" });
    expect(blank.notaMedia).toBeUndefined(); expect(blank.quantidadeAvaliacoes).toBeUndefined();
    const zero = toDraft({ ...fromDraft(base), notaMedia: "0", quantidadeAvaliacoes: "0" });
    expect(zero.notaMedia).toBe(0); expect(zero.quantidadeAvaliacoes).toBe(0);
  });

  it("flushes the latest partial draft when unmounted before the debounce", async () => {
    vi.useFakeTimers(); const saveDraft = vi.fn();
    const view = render(<GenerationWizard services={services({ saveDraft })} />);
    fireEvent.change(screen.getByLabelText("Nome do produto"), { target: { value: "Rascunho" } });
    await vi.advanceTimersByTimeAsync(299); expect(saveDraft).not.toHaveBeenCalled();
    view.unmount(); expect(saveDraft).toHaveBeenLastCalledWith(expect.objectContaining({ nomeProduto: "Rascunho" })); vi.useRealTimers();
  });

  it("persists once at exactly 300ms, never at 299ms", async () => {
    vi.useFakeTimers(); const saveDraft = vi.fn();
    render(<GenerationWizard services={services({ saveDraft })} />);
    fireEvent.change(screen.getByLabelText("Nome do produto"), { target: { value: "Cronômetro" } });
    await vi.advanceTimersByTimeAsync(299); expect(saveDraft).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1); expect(saveDraft).toHaveBeenCalledTimes(1);
  });

  it("ignores a late image load after unmount", async () => {
    let resolveImages!: (images: []) => void; const listImages = vi.fn(() => new Promise<[]>((resolve) => { resolveImages = resolve; }));
    const view = render(<GenerationWizard services={services({ listImages })} />); view.unmount();
    await act(async () => { resolveImages([]); });
    expect(listImages).toHaveBeenCalledOnce();
  });

  it("restores a draft without persisting defaults over it and blocks the required product name", async () => {
    const saveDraft = vi.fn();
    render(<GenerationWizard services={services({ saveDraft })} />);
    expect(await screen.findByLabelText("Nome do produto")).toHaveValue("Garrafa térmica");
    await userEvent.clear(screen.getByLabelText("Nome do produto"));
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByText("Informe o nome do produto")).toBeInTheDocument();
    await waitFor(() => expect(saveDraft).toHaveBeenCalled(), { timeout: 1000 });
  });

  it("sends only payload, product and ad images and waits for saved result before navigation", async () => {
    const product = { id: "11111111-1111-4111-8111-111111111111", role: "product" as const, blob: new Blob(["x"], { type: "image/jpeg" }), name: "product.jpg", type: "image/jpeg" as const, width: 1, height: 1, size: 1 };
    const ugc = { ...product, id: "22222222-2222-4222-8222-222222222222", role: "ugc" as const, name: "ugc.jpg" };
    const result = validateCreativeBatch(base, creativeBatchFixture(), "{{copy_completa}}");
    let resolveSave!: () => void; const saveResult = vi.fn(() => new Promise<void>((resolve) => { resolveSave = resolve; }));
    const generate = vi.fn(async (form: FormData) => { expect([...form.keys()].sort()).toEqual(["ad", "payload", "product"]); return result; });
    const navigate = vi.fn(); const user = userEvent.setup();
    render(<GenerationWizard services={services({ listImages: async () => [product, ugc, { ...product, id: "33333333-3333-4333-8333-333333333333", role: "ad", name: "ad.jpg" }], generate, saveResult, navigate })} />);
    await screen.findByLabelText("Nome do produto");
    await user.click(screen.getByRole("button", { name: "Continuar" })); await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Gerar criativos" }));
    await waitFor(() => expect(saveResult).toHaveBeenCalled()); expect(navigate).not.toHaveBeenCalled();
    resolveSave(); await waitFor(() => expect(navigate).toHaveBeenCalledWith(expect.stringMatching(/^\/resultado\//)));
  });
});

afterEach(() => { cleanup(); vi.useRealTimers(); });

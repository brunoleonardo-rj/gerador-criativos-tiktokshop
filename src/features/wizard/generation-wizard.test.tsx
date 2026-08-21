import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GenerationWizard, type WizardServices } from "./generation-wizard";
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

afterEach(cleanup);

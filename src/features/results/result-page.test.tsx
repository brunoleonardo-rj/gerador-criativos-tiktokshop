import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResultPage } from "./result-page";
import { generationInputFixture, creativeBatchFixture } from "../../../tests/fixtures/creative-result";
import { validateCreativeBatch } from "@/features/generation/validation";

const id = "11111111-1111-4111-8111-111111111111";
const result = validateCreativeBatch(generationInputFixture(), creativeBatchFixture(), "{{copy_trecho}}");
describe("ResultPage", () => {
  afterEach(() => cleanup());
  it("loads the current browser result once from storage", async () => {
    const getResult = vi.fn().mockResolvedValue({ ...result, id });
    render(<ResultPage id={id} storage={{ getResult }} />);
    expect(screen.getByText("Carregando resultado…")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Garrafa térmica" })).toBeInTheDocument();
    expect(getResult).toHaveBeenCalledOnce();
  });
  it("shows one selected creative at a time", async () => {
    const first = result.creatives[0];
    const stored = {
      ...result,
      id,
      creatives: [first, { ...first, id: "creative-2", angulo: "Benefícios do produto" }],
    };
    const user = userEvent.setup();
    render(<ResultPage id={id} storage={{ getResult: vi.fn().mockResolvedValue(stored) }} />);

    expect(await screen.findByRole("heading", { name: "Criativo 01" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Criativo 02" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Selecionar Criativo 02/i }));
    expect(screen.getByRole("heading", { name: "Criativo 02" })).toBeInTheDocument();
    expect(within(screen.getByRole("article", { name: /Criativo 02/ })).getByText("Benefícios do produto")).toBeInTheDocument();
  });
  it("keeps historic generated content immutable when it is opened", async () => {
    const getResult = vi.fn().mockResolvedValue({ ...result, id, settingsUpdatedAt: null });
    const putResult = vi.fn().mockResolvedValue(undefined);
    render(<ResultPage id={id} storage={{ getResult, putResult }} />);
    await screen.findByRole("heading", { name: "Garrafa térmica" });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(putResult).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("tab", { name: "Selfie" }));
    expect(screen.getAllByText(/Eu deixo minha água pronta logo cedo/).length).toBeGreaterThan(0);
  });
  it("renders safe missing state for rejected or absent browser storage", async () => {
    const { rerender } = render(<ResultPage id={id} storage={{ getResult: vi.fn().mockRejectedValue(new Error("db")) }} />);
    expect(await screen.findByText("Resultado não encontrado neste navegador")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Nova geração" })).toHaveAttribute("href", "/");
    rerender(<ResultPage id="not-a-uuid" storage={{ getResult: vi.fn() }} />);
    expect(await screen.findByText("Resultado não encontrado neste navegador")).toBeInTheDocument();
  });
  it("ignores a previous ID completion after the id changes", async () => {
    let completeFirst!: (value: typeof result & { id: string }) => void; let completeSecond!: (value: typeof result & { id: string }) => void;
    const getResult = vi.fn((requestedId: string) => new Promise<typeof result & { id: string }>((resolve) => { if (requestedId === id) completeFirst = resolve; else completeSecond = resolve; }));
    const view = render(<ResultPage id={id} storage={{ getResult }} />); view.rerender(<ResultPage id="22222222-2222-4222-8222-222222222222" storage={{ getResult }} />);
    await act(async () => { completeFirst({ ...result, id }); });
    expect(screen.getByText("Carregando resultado…")).toBeInTheDocument();
    await act(async () => { completeSecond({ ...result, id: "22222222-2222-4222-8222-222222222222" }); });
  });
});

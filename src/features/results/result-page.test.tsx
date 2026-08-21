import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResultPage } from "./result-page";
import { generationInputFixture, creativeBatchFixture } from "../../../tests/fixtures/creative-result";
import { validateCreativeBatch } from "@/features/generation/validation";

const id = "11111111-1111-4111-8111-111111111111";
const result = validateCreativeBatch(generationInputFixture(), creativeBatchFixture(), "{{copy_completa}}");
describe("ResultPage", () => {
  afterEach(() => cleanup());
  it("loads the current browser result once without fetch", async () => {
    const getResult = vi.fn().mockResolvedValue({ ...result, id }); const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<ResultPage id={id} storage={{ getResult }} />);
    expect(screen.getByText("Carregando resultado…")).toBeInTheDocument();
    expect(await screen.findByText("Garrafa térmica")).toBeInTheDocument();
    expect(getResult).toHaveBeenCalledOnce(); expect(fetchSpy).not.toHaveBeenCalled();
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

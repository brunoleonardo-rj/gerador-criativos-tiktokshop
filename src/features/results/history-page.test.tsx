import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HistoryPage } from "./history-page";
import { generationInputFixture, creativeBatchFixture } from "../../../tests/fixtures/creative-result";
import { validateCreativeBatch } from "@/features/generation/validation";

const result = { ...validateCreativeBatch(generationInputFixture(), creativeBatchFixture(), "{{copy_completa}}"), id: "11111111-1111-4111-8111-111111111111", createdAt: "2026-08-24T12:00:00.000Z" };

describe("HistoryPage", () => {
  afterEach(() => cleanup());
  it("lists stored results with a link to each one, newest first", async () => {
    const older = { ...result, id: "22222222-2222-4222-8222-222222222222", createdAt: "2026-08-20T12:00:00.000Z" };
    const listResults = vi.fn().mockResolvedValue([result, older]);
    render(<HistoryPage storage={{ listResults }} />);
    expect(screen.getByText("Carregando histórico…")).toBeInTheDocument();
    const links = await screen.findAllByRole("link");
    expect(links[0]).toHaveAttribute("href", `/resultado/${result.id}`);
    expect(links[1]).toHaveAttribute("href", `/resultado/${older.id}`);
  });
  it("renders an empty state when nothing was generated yet", async () => {
    render(<HistoryPage storage={{ listResults: vi.fn().mockResolvedValue([]) }} />);
    expect(await screen.findByText("Nenhum resultado gerado ainda neste navegador")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Nova geração" })).toHaveAttribute("href", "/");
  });
});

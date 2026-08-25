import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { ResultSummary } from "./result-summary";
import { generationInputFixture, creativeBatchFixture } from "../../../tests/fixtures/creative-result";
import { validateCreativeBatch } from "@/features/generation/validation";
import { DEFAULT_GEMINI_TEMPLATE } from "@/features/settings/gemini-template";

describe("ResultSummary", () => {
  afterEach(() => cleanup());
  it("keeps validation details collapsed until requested", async () => {
    const user = userEvent.setup();
    const result = validateCreativeBatch(generationInputFixture(), creativeBatchFixture(), "{{copy_trecho}}", DEFAULT_GEMINI_TEMPLATE, "2026-08-21T12:00:00.000Z");
    render(<ResultSummary result={result} />);

    expect(screen.getByText("1 criativo pronto")).toBeInTheDocument();
    expect(screen.getByText("Ver validação geral").closest("details")).not.toHaveAttribute("open");
    await user.click(screen.getByText("Ver validação geral"));
    expect(screen.getByText("Ver validação geral").closest("details")).toHaveAttribute("open");
    for (const name of [
      "Copiar produto", "Copiar status geral", "Copiar configuração usada", "Copiar fatos verificados",
      "Copiar riscos detectados", "Copiar checklist de publicação", "Copiar alertas da geração",
    ]) expect(screen.getByRole("button", { name })).toBeInTheDocument();
  });

  it("shows status, safe date and explicit empty states", () => {
    const result = validateCreativeBatch(generationInputFixture(), { ...creativeBatchFixture(), fatos: [], riscos: [], checklistPublicacao: [] }, "{{copy_trecho}}", DEFAULT_GEMINI_TEMPLATE, "2026-08-21T12:00:00.000Z");
    render(<ResultSummary result={result} />);
    expect(screen.getAllByText("Atenção").length).toBeGreaterThan(0);
    expect(screen.getByText("Nenhum fato verificado.")).toBeInTheDocument();
    expect(screen.getByText("Nenhum risco detectado.")).toBeInTheDocument();
    expect(screen.getByText("Nenhum item no checklist.")).toBeInTheDocument();
    expect(screen.getByText(/Configuração usada em/)).toBeInTheDocument();
  });

  it("shows blocked batch issues instead of hiding them", () => {
    const result = validateCreativeBatch(generationInputFixture(), creativeBatchFixture(), "{{copy_trecho}}");
    render(<ResultSummary result={{ ...result, status: "blocked", batchIssues: [{ code: "X", severity: "block", field: "creative", message: "Corrija antes de publicar." }] }} />);
    expect(screen.getAllByText("Bloqueado").length).toBeGreaterThan(0);
    expect(screen.getByText("Corrija antes de publicar.")).toBeInTheDocument();
  });
});

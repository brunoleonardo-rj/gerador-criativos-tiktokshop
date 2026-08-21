import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ResultSummary } from "./result-summary";
import { generationInputFixture, creativeBatchFixture } from "../../../tests/fixtures/creative-result";
import { validateCreativeBatch } from "@/features/generation/validation";

describe("ResultSummary", () => {
  it("shows status, safe date and explicit empty states", () => {
    const result = validateCreativeBatch(generationInputFixture(), { ...creativeBatchFixture(), fatos: [], riscos: [], checklistPublicacao: [] }, "{{copy_completa}}", "2026-08-21T12:00:00.000Z");
    render(<ResultSummary result={result} />);
    expect(screen.getByText("Atenção")).toBeInTheDocument();
    expect(screen.getByText("Nenhum fato verificado.")).toBeInTheDocument();
    expect(screen.getByText("Nenhum risco detectado.")).toBeInTheDocument();
    expect(screen.getByText("Nenhum item no checklist.")).toBeInTheDocument();
    expect(screen.getByText(/Configuração usada em/)).toBeInTheDocument();
  });

  it("shows blocked batch issues instead of hiding them", () => {
    const result = validateCreativeBatch(generationInputFixture(), creativeBatchFixture(), "{{copy_completa}}");
    render(<ResultSummary result={{ ...result, status: "blocked", batchIssues: [{ code: "X", severity: "block", field: "creative", message: "Corrija antes de publicar." }] }} />);
    expect(screen.getByText("Bloqueado")).toBeInTheDocument();
    expect(screen.getByText("Corrija antes de publicar.")).toBeInTheDocument();
  });
});

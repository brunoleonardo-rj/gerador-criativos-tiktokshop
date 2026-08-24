import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResultCard } from "./result-card";
import { generationInputFixture, creativeBatchFixture } from "../../../tests/fixtures/creative-result";
import { validateCreativeBatch } from "@/features/generation/validation";

function result() { return validateCreativeBatch(generationInputFixture(), creativeBatchFixture(), "VEO {{copy_completa}}", "2026-08-21T12:00:00.000Z").creatives[0]; }
describe("ResultCard", () => {
  afterEach(() => cleanup());
  it("offers a copy control for every displayed creative field", () => {
    render(<ResultCard creative={result()} />);

    for (const name of [
      "Copiar ID", "Copiar ângulo", "Copiar status", "Copiar ambiente", "Copiar figurino", "Copiar pose",
      "Copiar trecho 1", "Copiar trecho 2", "Copiar descrição", "Copiar hashtags", "Copiar POV",
      "Copiar texto na tela", "Copiar Prompt Gemini", "Copiar Prompt VEO 3", "Copiar descarte", "Copiar alertas do criativo",
    ]) expect(screen.getByRole("button", { name })).toBeInTheDocument();
  });

  it("blocks only description while VEO stays copyable", () => {
    const creative = { ...result(), issues: [{ code: "PRICE", severity: "block" as const, field: "descricao", message: "Preço proibido" }], status: "blocked" as const };
    render(<ResultCard creative={creative} />);
    expect(screen.getByRole("button", { name: "Copiar descrição" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Copiar Prompt VEO 3" })).toBeEnabled();
  });

  it("keeps warning fields copyable and keeps null VEO disabled", () => {
    const warning = { ...result(), issues: [{ code: "WORDS", severity: "warning" as const, field: "descricao", message: "Revise" }], status: "needs_review" as const };
    const { rerender } = render(<ResultCard creative={warning} />);
    expect(screen.getByRole("button", { name: "Copiar descrição" })).toBeEnabled();
    rerender(<ResultCard creative={{ ...warning, veoPrompt: null }} />);
    expect(screen.getByRole("button", { name: "Copiar Prompt VEO 3" })).toBeDisabled();
  });

  it("blocks POV subfields without blocking another copy field", () => {
    const creative = { ...result(), issues: [{ code: "POV", severity: "block" as const, field: "pov.texto", message: "POV inválido" }], status: "blocked" as const };
    render(<ResultCard creative={creative} />);
    expect(screen.getByRole("button", { name: "Copiar POV" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Copiar descrição" })).toBeEnabled();
  });

  it("keeps copy segment blocking precise and builds a package without blocked sections", async () => {
    const creative = { ...result(), issues: [{ code: "COPY", severity: "block" as const, field: "copy.trecho1.texto", message: "Bloqueado" }], status: "blocked" as const };
    render(<ResultCard creative={creative} />);
    expect(screen.getByRole("button", { name: "Copiar trecho 1" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Copiar trecho 2" })).toBeEnabled();
    const writeText = vi.fn().mockResolvedValue(undefined); Object.assign(navigator, { clipboard: { writeText } });
    await userEvent.click(screen.getByRole("button", { name: "Copiar pacote completo" }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("## Copy — trecho 2"));
    expect(writeText).toHaveBeenCalledWith(expect.not.stringContaining("## Copy — trecho 1"));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("## Prompt VEO 3"));
  });

  it("blocks all copy segments for a copy ancestor issue while retaining safe package fields", async () => {
    const creative = { ...result(), issues: [{ code: "SEGMENT_STRUCTURE", severity: "block" as const, field: "copy", message: "Estrutura inválida" }], status: "blocked" as const };
    const writeText = vi.fn().mockResolvedValue(undefined); Object.assign(navigator, { clipboard: { writeText } });
    render(<ResultCard creative={creative} />);
    expect(screen.getByRole("button", { name: "Copiar trecho 1" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Copiar trecho 2" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Copiar pacote completo" }));
    expect(writeText).toHaveBeenCalledWith(expect.not.stringContaining("## Copy — trecho"));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("## Descrição"));
  });

  it("blocks duplicate environment, pose and hashtags in controls and the complete package", async () => {
    const base = result();
    const creative = {
      ...base,
      issues: ["ambiente", "pose", "hashtags"].map((field) => ({ code: "CREATIVE_DUPLICATE", severity: "block" as const, field, message: "Criativo duplicado" })),
      status: "blocked" as const,
    };
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<ResultCard creative={creative} />);

    expect(screen.getByRole("button", { name: "Copiar ambiente" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Copiar pose" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Copiar hashtags" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Copiar pacote completo" }));
    expect(writeText).toHaveBeenCalledWith(expect.not.stringContaining("## Ambiente"));
    expect(writeText).toHaveBeenCalledWith(expect.not.stringContaining("## Pose"));
    expect(writeText).toHaveBeenCalledWith(expect.not.stringContaining("## Hashtags"));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("## Figurino"));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("## Descrição"));
  });

  it("labels warnings and blocks with accessible severity", () => {
    const creative = { ...result(), issues: [{ code: "ONE", severity: "block" as const, field: "descricao", message: "Bloqueie" }, { code: "TWO", severity: "warning" as const, field: "pov", message: "Revise" }], status: "blocked" as const };
    render(<ResultCard creative={creative} />);
    expect(screen.getByText("Bloqueio:")).toBeInTheDocument();
    expect(screen.getByText("Atenção:")).toBeInTheDocument();
  });

  it("opens with keyboard and displays real counts and rendered prompts", async () => {
    render(<ResultCard creative={result()} />);
    await userEvent.keyboard("{Tab}{Enter}");
    expect(screen.getAllByText(/Palavras reais:/).length).toBeGreaterThan(0);
    expect(screen.getByText(/VEO Eu deixo minha água/)).toBeInTheDocument();
  });
});

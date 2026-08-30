import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResultCard } from "./result-card";
import { generationInputFixture, creativeBatchFixture } from "../../../tests/fixtures/creative-result";
import { validateCreativeBatch } from "@/features/generation/validation";
import { DEFAULT_GEMINI_TEMPLATE } from "@/features/settings/gemini-template";

function result() { return validateCreativeBatch(generationInputFixture(), creativeBatchFixture(), "VEO {{copy_trecho}}", DEFAULT_GEMINI_TEMPLATE, "2026-08-21T12:00:00.000Z").creatives[0]; }
function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  return writeText;
}
describe("ResultCard", () => {
  afterEach(() => cleanup());
  it("keeps result groups behind compact tabs and exposes the Gemini prompt", async () => {
    const user = userEvent.setup();
    render(<ResultCard creative={result()} />);

    for (const name of ["Copy", "Selfie", "POV", "Publicação"]) {
      expect(screen.getByRole("tab", { name })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Copiar trecho 1" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copiar Prompt Gemini" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Selfie" }));
    expect(screen.getByText("Prompt Gemini")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copiar Prompt Gemini" })).toBeInTheDocument();
  });

  it("blocks only description while VEO stays copyable", async () => {
    const user = userEvent.setup();
    const creative = { ...result(), issues: [{ code: "PRICE", severity: "block" as const, field: "descricao", message: "Preço proibido" }], status: "blocked" as const };
    render(<ResultCard creative={creative} />);
    await user.click(screen.getByRole("tab", { name: "Publicação" }));
    expect(screen.getByRole("button", { name: "Copiar descrição" })).toBeDisabled();
    await user.click(screen.getByRole("tab", { name: "Selfie" }));
    expect(screen.getByRole("button", { name: "Copiar Prompt VEO 3 — Trecho 1" })).toBeEnabled();
  });

  it("blocks only the POV Gemini prompt while POV VEO trechos stay copyable", async () => {
    const user = userEvent.setup();
    const creative = { ...result(), issues: [{ code: "GEMINI_POV_TEMPLATE_INVALID", severity: "block" as const, field: "promptGeminiPov", message: "Template inválido" }], status: "blocked" as const };
    render(<ResultCard creative={creative} />);
    await user.click(screen.getByRole("tab", { name: "POV" }));
    expect(screen.getByRole("button", { name: "Copiar Prompt Gemini (POV)" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Copiar Prompt VEO 3 (POV) — Trecho 1" })).toBeEnabled();
  });

  it("keeps warning fields copyable and keeps null VEO disabled", async () => {
    const user = userEvent.setup();
    const warning = { ...result(), issues: [{ code: "WORDS", severity: "warning" as const, field: "descricao", message: "Revise" }], status: "needs_review" as const };
    render(<ResultCard creative={warning} />);
    await user.click(screen.getByRole("tab", { name: "Publicação" }));
    expect(screen.getByRole("button", { name: "Copiar descrição" })).toBeEnabled();
    await user.click(screen.getByRole("tab", { name: "Selfie" }));
    expect(screen.getByRole("button", { name: "Copiar Prompt VEO 3 — Trecho 1" })).toBeEnabled();
    cleanup();
    render(<ResultCard creative={{ ...warning, veoPrompts: { trecho1: null, trecho2: null, trecho3: null } }} />);
    await user.click(screen.getByRole("tab", { name: "Selfie" }));
    expect(screen.getByRole("button", { name: "Copiar Prompt VEO 3 — Trecho 1" })).toBeDisabled();
  });

  it("blocks POV subfields without blocking another copy field", async () => {
    const user = userEvent.setup();
    const creative = { ...result(), issues: [{ code: "POV", severity: "block" as const, field: "pov.texto", message: "POV inválido" }], status: "blocked" as const };
    render(<ResultCard creative={creative} />);
    expect(screen.getByRole("button", { name: "Copiar POV" })).toBeDisabled();
    await user.click(screen.getByRole("tab", { name: "Publicação" }));
    expect(screen.getByRole("button", { name: "Copiar descrição" })).toBeEnabled();
  });

  it("keeps copy segment blocking precise and builds a package without blocked sections", async () => {
    const creative = { ...result(), issues: [{ code: "COPY", severity: "block" as const, field: "copy.trecho1.texto", message: "Bloqueado" }], status: "blocked" as const };
    render(<ResultCard creative={creative} />);
    expect(screen.getByRole("button", { name: "Copiar trecho 1" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Copiar trecho 2" })).toBeEnabled();
    const writeText = mockClipboard();
    await userEvent.click(screen.getByRole("button", { name: "Copiar pacote completo" }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("## Copy — trecho 2"));
    expect(writeText).toHaveBeenCalledWith(expect.not.stringContaining("## Copy — trecho 1"));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("## Prompt VEO 3"));
  });

  it("blocks all copy segments for a copy ancestor issue while retaining safe package fields", async () => {
    const creative = { ...result(), issues: [{ code: "SEGMENT_STRUCTURE", severity: "block" as const, field: "copy", message: "Estrutura inválida" }], status: "blocked" as const };
    const writeText = mockClipboard();
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
    const writeText = mockClipboard();
    render(<ResultCard creative={creative} />);

    await userEvent.click(screen.getByRole("tab", { name: "Publicação" }));
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

  it("labels warnings and blocks with accessible severity", async () => {
    const user = userEvent.setup();
    const creative = { ...result(), issues: [{ code: "ONE", severity: "block" as const, field: "descricao", message: "Bloqueie" }, { code: "TWO", severity: "warning" as const, field: "pov", message: "Revise" }], status: "blocked" as const };
    render(<ResultCard creative={creative} />);
    await user.click(screen.getByRole("tab", { name: "Publicação" }));
    expect(screen.getByText("Bloqueio:")).toBeInTheDocument();
    expect(screen.getByText("Atenção:")).toBeInTheDocument();
  });

  it("switches tabs with the keyboard and displays real rendered prompts", async () => {
    render(<ResultCard creative={result()} />);
    expect(screen.getAllByText(/Palavras reais:/).length).toBeGreaterThan(0);
    screen.getByRole("tab", { name: "Selfie" }).focus();
    await userEvent.keyboard("{Enter}");
    expect(screen.getByText(/VEO Eu deixo minha água/)).toBeInTheDocument();
    expect(screen.getByText(/PRODUTO: Garrafa térmica/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "POV" }));
    expect(screen.getByText(/estilo POV/)).toBeInTheDocument();
    expect(screen.getByText(/Eu deixo minha água pronta/)).toBeInTheDocument();
  });
});

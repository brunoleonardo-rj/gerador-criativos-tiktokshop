import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsForm, type PublicSettingsView } from "./settings-form";

const publicSettingsFixture: PublicSettingsView = {
  apiKeyConfigured: true,
  apiKeyMask: "••••7890",
  model: "claude-sonnet-5",
  veoTemplate: "{{copy_trecho}}",
  geminiTemplate: "{{produto}}",
  updatedAt: "2026-08-21T12:00:00.000Z",
};

describe("SettingsForm", () => {
  afterEach(cleanup);

  it("mostra chave mascarada e prévia do template", async () => {
    const user = userEvent.setup();
    render(<SettingsForm initial={publicSettingsFixture} onSave={vi.fn()} onDeleteKey={vi.fn()} />);

    expect(screen.getByText("••••7890")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Prompt VEO 3" }));
    await user.clear(screen.getByLabelText("Template VEO 3"));
    await user.type(screen.getByLabelText("Template VEO 3"), "Fala: {{{{copy_trecho}}}}");

    expect(screen.getByText(/Fala:/, { selector: "output" })).toBeInTheDocument();
    expect(screen.getByText(/variáveis não permitidas/i)).toBeInTheDocument();
  });

  it("edita e pré-visualiza o template Gemini em uma aba própria", async () => {
    const user = userEvent.setup();
    render(<SettingsForm initial={publicSettingsFixture} onSave={vi.fn()} onDeleteKey={vi.fn()} />);

    await user.click(screen.getByRole("tab", { name: "Prompt Gemini" }));
    const editor = screen.getByLabelText("Template Gemini");
    fireEvent.change(editor, { target: { value: "Produto: {{produto}}" } });

    expect(screen.getByText(/Produto: Garrafa térmica Aurora/, { selector: "output" })).toBeInTheDocument();
  });

  it("descreve o template somente com ids existentes", async () => {
    const user = userEvent.setup();
    render(<SettingsForm initial={publicSettingsFixture} onSave={vi.fn()} onDeleteKey={vi.fn()} />);
    await user.click(screen.getByRole("tab", { name: "Prompt VEO 3" }));
    const editor = screen.getByLabelText("Template VEO 3");

    expect(editor).toHaveAttribute("aria-describedby", "veo-template-help");
    await user.clear(editor);
    await user.type(editor, "{{variavel_inexistente}}");
    expect(editor).toHaveAttribute("aria-describedby", "veo-template-help veo-template-error");
    expect(document.getElementById("veo-template-error")).toBeInTheDocument();
  });

  it("não envia a chave salva quando o campo de substituição fica vazio", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<SettingsForm initial={publicSettingsFixture} onSave={onSave} onDeleteKey={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Salvar configurações" }));

    expect(onSave).toHaveBeenCalledWith({ model: "claude-sonnet-5", veoTemplate: "{{copy_trecho}}", geminiTemplate: "{{produto}}" });
    expect(screen.getByLabelText("Nova chave da Anthropic")).toHaveValue("");
  });

  it("permite excluir a chave apenas por uma ação explícita", async () => {
    const user = userEvent.setup();
    const onDeleteKey = vi.fn().mockResolvedValue(undefined);
    render(<SettingsForm initial={publicSettingsFixture} onSave={vi.fn()} onDeleteKey={onDeleteKey} />);

    await user.click(screen.getByRole("button", { name: "Remover credencial" }));

    expect(onDeleteKey).toHaveBeenCalledOnce();
  });

  it("atualiza a máscara pública após substituir a chave", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue({ ...publicSettingsFixture, apiKeyMask: "••••4321", model: "claude-updated", veoTemplate: "Fala {{copy_trecho}}", geminiTemplate: "Produto {{produto}}", updatedAt: "2026-08-21T12:01:00.000Z" });
    render(<SettingsForm initial={publicSettingsFixture} onSave={onSave} onDeleteKey={vi.fn()} />);

    await user.type(screen.getByLabelText("Nova chave da Anthropic"), "sk-ant-new-4321");
    await user.click(screen.getByRole("button", { name: "Salvar configurações" }));

    expect(await screen.findByText("••••4321")).toBeInTheDocument();
    expect(screen.queryByText("••••7890")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Nova chave da Anthropic")).toHaveValue("");
    expect(screen.getByLabelText("Modelo Anthropic")).toHaveValue("claude-updated");
    expect(screen.getByLabelText("Template VEO 3")).toHaveValue("Fala {{copy_trecho}}");
    expect(screen.getByLabelText("Template Gemini")).toHaveValue("Produto {{produto}}");
  });

  it("remove imediatamente a máscara e a ação após excluir a chave", async () => {
    const user = userEvent.setup();
    const onDeleteKey = vi.fn().mockResolvedValue({ ...publicSettingsFixture, apiKeyConfigured: false, apiKeyMask: null, updatedAt: "2026-08-21T12:01:00.000Z" });
    render(<SettingsForm initial={publicSettingsFixture} onSave={vi.fn()} onDeleteKey={onDeleteKey} />);

    await user.click(screen.getByRole("button", { name: "Remover credencial" }));

    expect(await screen.findByText("Nenhuma chave configurada.")).toBeInTheDocument();
    expect(screen.queryByText("••••7890")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remover credencial" })).not.toBeInTheDocument();
  });
});

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsForm, type PublicSettingsView } from "./settings-form";

const publicSettingsFixture: PublicSettingsView = {
  apiKeyConfigured: true,
  apiKeyMask: "••••7890",
  model: "claude-sonnet-5",
  veoTemplate: "{{copy_completa}}",
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
    await user.type(screen.getByLabelText("Template VEO 3"), "Fala: {{{{copy_completa}}}}");

    expect(screen.getByText(/Fala:/, { selector: "output" })).toBeInTheDocument();
    expect(screen.getByText(/variáveis não permitidas/i)).toBeInTheDocument();
  });

  it("não envia a chave salva quando o campo de substituição fica vazio", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<SettingsForm initial={publicSettingsFixture} onSave={onSave} onDeleteKey={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Salvar configurações" }));

    expect(onSave).toHaveBeenCalledWith({ model: "claude-sonnet-5", veoTemplate: "{{copy_completa}}" });
    expect(screen.getByLabelText("Nova chave da Anthropic")).toHaveValue("");
  });

  it("permite excluir a chave apenas por uma ação explícita", async () => {
    const user = userEvent.setup();
    const onDeleteKey = vi.fn().mockResolvedValue(undefined);
    render(<SettingsForm initial={publicSettingsFixture} onSave={vi.fn()} onDeleteKey={onDeleteKey} />);

    await user.click(screen.getByRole("button", { name: "Remover credencial" }));

    expect(onDeleteKey).toHaveBeenCalledOnce();
  });
});

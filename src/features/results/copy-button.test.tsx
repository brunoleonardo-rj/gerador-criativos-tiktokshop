import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CopyButton } from "./copy-button";

describe("CopyButton", () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it("writes only the supplied safe text and announces success", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<CopyButton text="texto seguro" label="Copiar descrição" />);
    await userEvent.click(screen.getByRole("button", { name: "Copiar descrição" }));
    expect(writeText).toHaveBeenCalledWith("texto seguro");
    expect(await screen.findByText("Copiado com sucesso.")).toHaveAttribute("role", "status");
  });

  it("does not write disabled or empty content", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<><CopyButton text="seguro" label="Desabilitado" disabled /><CopyButton text="" label="Vazio" /></>);
    await userEvent.click(screen.getByRole("button", { name: "Desabilitado" }));
    await userEvent.click(screen.getByRole("button", { name: "Vazio" }));
    expect(writeText).not.toHaveBeenCalled();
  });

  it("prevents a second activation while clipboard is pending and contains failures", async () => {
    let finish!: () => void;
    const writeText = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    Object.assign(navigator, { clipboard: { writeText } });
    render(<CopyButton text="seguro" label="Copiar" />);
    const button = screen.getByRole("button", { name: "Copiar" });
    await userEvent.click(button); await userEvent.click(button);
    expect(writeText).toHaveBeenCalledOnce(); expect(button).toBeDisabled();
    finish(); await waitFor(() => expect(button).toBeEnabled());
  });

  it("announces clipboard failure without throwing", async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("no")) } });
    render(<CopyButton text="seguro" label="Copiar" />);
    await userEvent.click(screen.getByRole("button", { name: "Copiar" }));
    expect(await screen.findByText("Não foi possível copiar. Tente novamente.")).toHaveAttribute("role", "status");
  });

  it("announces unavailable clipboard permissions without a fallback", async () => {
    Object.assign(navigator, { clipboard: undefined });
    render(<CopyButton text="seguro" label="Copiar" />);
    await userEvent.click(screen.getByRole("button", { name: "Copiar" }));
    expect(await screen.findByText("Não foi possível copiar. Tente novamente.")).toBeInTheDocument();
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProductStep } from "./product-step";

describe("ProductStep", () => {
  it("exposes the required product fields with accessible Portuguese labels", () => {
    render(<ProductStep register={() => ({}) as never} errors={{}} />);
    expect(screen.getByLabelText("Nome do produto")).toBeInTheDocument();
    expect(screen.getByLabelText("Categoria")).toBeInTheDocument();
    expect(screen.getByLabelText("Descrição do anúncio")).toBeInTheDocument();
    expect(screen.getByLabelText("Perfil UGC")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Sem pessoa" })).toHaveValue("sem_pessoa");
  });
});

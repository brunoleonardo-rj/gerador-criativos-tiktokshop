import { cleanup, render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { afterEach, describe, expect, it } from "vitest";
import type { WizardFormValues } from "./generation-wizard";
import { ProductReviewForm } from "./product-review-form";

afterEach(cleanup);

function ReviewFixture() {
  const form = useForm<WizardFormValues>({
    defaultValues: {
      nomeProduto: "Garrafa",
      categoria: "Casa",
      descricaoPdp: "Garrafa térmica",
      avaliacoes: "Mantém a bebida gelada",
      notaMedia: "4.8",
      quantidadeAvaliacoes: "1250",
      precoAtual: "R$ 79,90",
      precoAnterior: "R$ 99,90",
      especificacoesTexto: "Aço inox\n500 ml",
      publicoAlvo: "Adultos",
    } as WizardFormValues,
  });
  return <ProductReviewForm register={form.register} errors={{ nomeProduto: { type: "required", message: "Informe o nome do produto" } }} />;
}

describe("ProductReviewForm", () => {
  it("groups all extracted fields into product, offer and specification sections", () => {
    render(<ReviewFixture />);

    expect(screen.getByRole("group", { name: "Produto" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Oferta e prova social" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Especificações" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nome do produto")).toHaveValue("Garrafa");
    expect(screen.getByLabelText("Preço atual")).toHaveValue("R$ 79,90");
    expect(screen.getByLabelText("Especificações críticas (uma por linha)")).toHaveValue("Aço inox\n500 ml");
  });

  it("associates validation messages with their fields", () => {
    render(<ReviewFixture />);

    expect(screen.getByLabelText("Nome do produto")).toHaveAccessibleErrorMessage("Informe o nome do produto");
    expect(screen.getByRole("alert")).toHaveTextContent("Informe o nome do produto");
  });
});

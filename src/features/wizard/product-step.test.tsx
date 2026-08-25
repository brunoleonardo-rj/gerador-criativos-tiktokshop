import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StoredImage } from "@/features/draft/storage";
import type { WizardFormValues } from "./generation-wizard";
import { ProductStep, type ProductStepProps } from "./product-step";

const productImage: StoredImage = {
  id: "11111111-1111-4111-8111-111111111111",
  role: "product",
  blob: new Blob(["product"], { type: "image/jpeg" }),
  name: "product.jpg",
  type: "image/jpeg",
  width: 400,
  height: 400,
  size: 7,
};

const defaults: WizardFormValues = {
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
  perfilUgc: "",
  linkProduto: "",
  quantidadeCriativos: "5",
  ambientesTexto: "casa",
  politicaPreco: "sem_preco",
  duracaoTotal: "20",
  povComEmoji: true,
  maxPalavrasPov: "11",
  quantidadeHashtags: "5",
  tomVoz: "natural",
  formatoUso: "manuseado",
  zonaFoco: "maos",
  detalheCriticoTexto: "",
};

type TestProps = Omit<ProductStepProps, "register" | "errors">;

function ProductStepFixture(props: TestProps) {
  const form = useForm<WizardFormValues>({ defaultValues: defaults });
  return <ProductStep {...props} register={form.register} errors={form.formState.errors} />;
}

const uploadProps: TestProps = {
  images: [],
  state: "upload",
  warnings: [],
  error: null,
  onImagesChange: vi.fn(),
  onAnalyze: vi.fn(),
  onBackToImages: vi.fn(),
};

afterEach(cleanup);

describe("ProductStep", () => {
  it("shows only image upload before analysis", () => {
    render(<ProductStepFixture {...uploadProps} />);

    expect(screen.getByLabelText("Fotos e prints do produto")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Analisar imagens" })).toBeDisabled();
    expect(screen.queryByLabelText("Nome do produto")).not.toBeInTheDocument();
  });

  it("enables analysis after at least one image is selected", () => {
    render(<ProductStepFixture {...uploadProps} images={[productImage]} />);

    expect(screen.getByRole("button", { name: "Analisar imagens" })).toBeEnabled();
    expect(screen.getByAltText("Prévia de product.jpg")).toBeInTheDocument();
  });

  it("preserves thumbnails and blocks image edits while analyzing", async () => {
    const onAnalyze = vi.fn();
    const onImagesChange = vi.fn();
    render(<ProductStepFixture {...uploadProps} images={[productImage]} state="analyzing" onAnalyze={onAnalyze} onImagesChange={onImagesChange} />);

    expect(screen.getByRole("status")).toHaveTextContent(/lendo os dados do produto/i);
    expect(screen.getByRole("status").closest('[aria-busy="true"]')).toBeNull();
    expect(screen.getByAltText("Prévia de product.jpg")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Analisando imagens…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remover product.jpg" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Analisando imagens…" }));
    expect(onAnalyze).not.toHaveBeenCalled();
    expect(onImagesChange).not.toHaveBeenCalled();
  });

  it("shows editable extracted fields only in review state", () => {
    render(<ProductStepFixture {...uploadProps} images={[productImage]} state="review" />);

    expect(screen.getByLabelText("Nome do produto")).toHaveValue("Garrafa");
    expect(screen.getByRole("button", { name: "Analisar novamente" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Trocar imagens" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Fotos e prints do produto")).not.toBeInTheDocument();
  });

  it("shows extraction warnings and a retryable analysis error", async () => {
    const onAnalyze = vi.fn();
    render(<ProductStepFixture {...uploadProps} images={[productImage]} state="review" warnings={["Preço anterior não estava legível."]} error="A análise falhou." onAnalyze={onAnalyze} />);

    expect(screen.getByText("Preço anterior não estava legível.")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("A análise falhou.");
    await userEvent.click(screen.getByRole("button", { name: "Analisar novamente" }));
    expect(onAnalyze).toHaveBeenCalledOnce();
  });
});

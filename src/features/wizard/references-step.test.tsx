import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ReferencesStep } from "./references-step";

describe("ReferencesStep", () => {
  it("does not require UGC references for the sem pessoa profile", () => {
    render(<ReferencesStep profile="sem_pessoa" images={[]} loading={false} error={null} onImagesChange={() => undefined} />);
    expect(screen.getAllByText(/0 e 5 imagens/i)).toHaveLength(2);
    expect(screen.getByText(/1 e 8 imagens/i)).toBeInTheDocument();
  });

  it("identifies missing references as requirements instead of a loading failure", () => {
    render(<ReferencesStep profile="masculino" images={[]} loading={false} error={{ productRequired: true, ugcRequired: true }} onImagesChange={() => undefined} />);
    expect(screen.getByText("Adicione ao menos uma foto do produto.")).toHaveAttribute("role", "alert");
    expect(screen.getByText("Adicione ao menos uma foto da pessoa UGC.")).toHaveAttribute("role", "alert");
    expect(screen.queryByText(/não foi possível carregar/i)).not.toBeInTheDocument();
  });
});

afterEach(cleanup);

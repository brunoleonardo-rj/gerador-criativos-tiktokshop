import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReferencesStep } from "./references-step";

describe("ReferencesStep", () => {
  it("does not require UGC references for the sem pessoa profile", () => {
    render(<ReferencesStep profile="sem_pessoa" images={[]} loading={false} error={null} onImagesChange={() => undefined} />);
    expect(screen.getAllByText(/0 e 5 imagens/i)).toHaveLength(2);
    expect(screen.getByText(/1 e 8 imagens/i)).toBeInTheDocument();
  });
});

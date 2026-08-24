import { cleanup, render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { afterEach, describe, expect, it } from "vitest";
import type { ImageRole, StoredImage } from "@/features/draft/storage";
import { generationInputFixture } from "../../../tests/fixtures/creative-result";
import { fromDraft, type WizardFormValues } from "./generation-wizard";
import { ReferencesStep, type ReferenceError } from "./references-step";

function ReferencesFixture({ profile, error = null, onImagesChange = () => undefined }: { profile: string; error?: ReferenceError; onImagesChange?: (role: ImageRole, images: StoredImage[]) => void }) {
  const form = useForm<WizardFormValues>({ defaultValues: { ...fromDraft(generationInputFixture()), perfilUgc: profile } });
  return <ReferencesStep register={form.register} errors={form.formState.errors} profile={profile} images={[]} loading={false} error={error} onImagesChange={onImagesChange} />;
}

describe("ReferencesStep", () => {
  it("owns the profile selector and only the UGC upload", () => {
    render(<ReferencesFixture profile="sem_pessoa" />);

    expect(screen.getByLabelText("Perfil UGC")).toHaveValue("sem_pessoa");
    expect(screen.getByLabelText("Fotos da pessoa UGC")).toHaveAccessibleDescription(/0 e 5 imagens/i);
    expect(screen.queryByLabelText("Fotos do produto")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Prints do anúncio")).not.toBeInTheDocument();
  });

  it("requires UGC references for a person profile", () => {
    render(<ReferencesFixture profile="masculino" error={{ ugcRequired: true }} />);

    expect(screen.getByLabelText("Fotos da pessoa UGC")).toHaveAccessibleDescription(/1 e 5 imagens/i);
    expect(screen.getByText("Adicione ao menos uma foto da pessoa UGC.")).toHaveAttribute("role", "alert");
    expect(screen.queryByText(/não foi possível carregar/i)).not.toBeInTheDocument();
  });
});

afterEach(cleanup);

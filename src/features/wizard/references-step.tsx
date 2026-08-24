"use client";

import type { FieldErrors, UseFormRegister } from "react-hook-form";
import type { ImageRole, StoredImage } from "@/features/draft/storage";
import { UploadField } from "@/features/uploads/upload-field";
import type { WizardFormValues } from "./generation-wizard";
import styles from "./wizard.module.css";

export type ReferenceError = { load?: boolean; save?: boolean; ugcRequired?: boolean } | null;

type Props = {
  register: UseFormRegister<WizardFormValues>;
  errors: FieldErrors<WizardFormValues>;
  profile: string;
  images: StoredImage[];
  loading: boolean;
  error: ReferenceError;
  onImagesChange(role: ImageRole, images: StoredImage[]): void;
};

export function ReferencesStep({ register, errors, profile, images, loading, error, onImagesChange }: Props) {
  const ugcImages = images.filter((image) => image.role === "ugc");
  const profileError = errors.perfilUgc?.message;

  return <section className={styles.referencesStep} aria-labelledby="references-title">
    <header className={styles.sectionHeader}>
      <p className={styles.eyebrow}>Referências visuais</p>
      <h2 id="references-title">Quem aparece no criativo?</h2>
      <p>Escolha o perfil UGC e envie fotos da pessoa somente quando o roteiro precisar de alguém em cena.</p>
    </header>

    <div className={styles.profileField}>
      <label htmlFor="perfilUgc">Perfil UGC</label>
      <select
        id="perfilUgc"
        {...register("perfilUgc")}
        aria-invalid={Boolean(profileError)}
        aria-errormessage={profileError ? "perfilUgc-error" : undefined}
      >
        <option value="">Selecione</option>
        <option value="feminino">Feminino</option>
        <option value="masculino">Masculino</option>
        <option value="sem_pessoa">Sem pessoa</option>
      </select>
      <p className={styles.fieldHint}>“Sem pessoa” permite gerar cenas focadas apenas no produto.</p>
      {profileError && <p id="perfilUgc-error" className={styles.fieldError} role="alert">{profileError}</p>}
    </div>

    {error?.load && <p className={styles.referenceError} role="alert">Não foi possível carregar as referências. Recarregue a página e tente novamente.</p>}
    {error?.save && <p className={styles.referenceError} role="alert">Não foi possível salvar a alteração das referências. Tente novamente.</p>}
    {error?.ugcRequired && <p className={styles.referenceError} role="alert" tabIndex={-1}>Adicione ao menos uma foto da pessoa UGC.</p>}

    {loading
      ? <p className={styles.loadingReferences} role="status">Carregando referências…</p>
      : <div className={styles.referenceUploader}>
        <UploadField
          role="ugc"
          min={profile === "sem_pessoa" ? 0 : 1}
          max={5}
          items={ugcImages}
          onChange={(items) => onImagesChange("ugc", items)}
        />
      </div>}
  </section>;
}

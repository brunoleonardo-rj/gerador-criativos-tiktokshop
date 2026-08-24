"use client";

import type { ReactNode } from "react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";
import type { StoredImage } from "@/features/draft/storage";
import { UploadField } from "@/features/uploads/upload-field";
import type { WizardFormValues } from "./generation-wizard";
import { ProductReviewForm } from "./product-review-form";
import styles from "./wizard.module.css";

export type ProductStepState = "upload" | "analyzing" | "review";

export type ProductStepProps = {
  register: UseFormRegister<WizardFormValues>;
  errors: FieldErrors<WizardFormValues>;
  images?: StoredImage[];
  state?: ProductStepState;
  warnings?: string[];
  error?: ReactNode;
  onImagesChange?(images: StoredImage[]): void;
  onAnalyze?(): void;
  onBackToImages?(): void;
};

const noop = () => undefined;

export function ProductStep({
  register,
  errors,
  images = [],
  state = "upload",
  warnings = [],
  error = null,
  onImagesChange = noop,
  onAnalyze = noop,
  onBackToImages = noop,
}: ProductStepProps) {
  const analyzing = state === "analyzing";
  const reviewing = state === "review";

  return <section className={styles.productStep} aria-labelledby="product-step-title" aria-busy={analyzing}>
    <header className={styles.productHeader}>
      <p className={styles.eyebrow}>Etapa do produto</p>
      <h2 id="product-step-title">{reviewing ? "Revise os dados extraídos" : "Mostre o produto para a IA"}</h2>
      <p>{reviewing ? "Confira os fatos identificados e corrija qualquer informação antes de continuar." : "Envie fotos do produto e prints do anúncio. Os campos de revisão aparecem depois da análise."}</p>
    </header>

    {error && <div className={styles.analysisError} role="alert">{error}</div>}

    {!reviewing && <>
      <div className={styles.productUploader}>
        <UploadField
          role="product"
          min={1}
          max={8}
          items={images}
          label="Fotos e prints do produto"
          help="Envie de 1 a 8 imagens JPEG, PNG ou WEBP. Combine fotos do produto com prints da página do anúncio."
          disabled={analyzing}
          onChange={onImagesChange}
        />
      </div>

      <aside className={styles.uploadExamples} aria-label="Exemplos de imagens úteis">
        <strong>Para uma análise melhor, inclua:</strong>
        <ul>
          <li>frente, verso e embalagem do produto;</li>
          <li>detalhes, variações, composição ou medidas;</li>
          <li>prints da oferta, avaliações e descrição do anúncio.</li>
        </ul>
      </aside>

      {analyzing && <div className={styles.analyzingStatus} role="status" aria-live="polite">
        <span className={styles.spinner} aria-hidden="true" />
        <span><strong>Analisando suas imagens…</strong> A IA está lendo os dados do produto. Mantenha esta página aberta.</span>
      </div>}

      <div className={styles.productActions}>
        <button className={styles.primaryButton} type="button" onClick={onAnalyze} disabled={analyzing || images.length === 0}>
          {analyzing ? "Analisando imagens…" : "Analisar imagens"}
        </button>
      </div>
    </>}

    {reviewing && <>
      {warnings.length > 0 && <aside className={styles.analysisWarnings} aria-labelledby="analysis-warnings-title">
        <strong id="analysis-warnings-title">Pontos para conferir</strong>
        <ul>{warnings.map((warning, index) => <li key={`${index}-${warning}`}>{warning}</li>)}</ul>
      </aside>}
      <ProductReviewForm register={register} errors={errors} />
      <div className={styles.productActions}>
        <button className={styles.secondaryButton} type="button" onClick={onBackToImages}>Trocar imagens</button>
        <button className={styles.primaryButton} type="button" onClick={onAnalyze} disabled={images.length === 0}>Analisar novamente</button>
      </div>
    </>}
  </section>;
}

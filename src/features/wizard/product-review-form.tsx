"use client";

import type { FieldErrors, UseFormRegister } from "react-hook-form";
import type { WizardFormValues } from "./generation-wizard";
import styles from "./wizard.module.css";

export type ProductReviewFormProps = {
  register: UseFormRegister<WizardFormValues>;
  errors: FieldErrors<WizardFormValues>;
};

type ReviewField = "nomeProduto" | "categoria" | "descricaoPdp" | "avaliacoes" | "notaMedia" | "quantidadeAvaliacoes" | "precoAtual" | "precoAnterior" | "especificacoesTexto" | "publicoAlvo";

const FORMATO_USO_OPTIONS = [
  { value: "vestido", label: "Vestido — roupa, calçado, acessório usado no corpo" },
  { value: "manuseado", label: "Manuseado — segurado durante o uso (aparelho, utensílio)" },
  { value: "aplicado_no_corpo", label: "Aplicado no corpo — cosmético, perfume" },
  { value: "consumido", label: "Consumido — alimento, bebida, suplemento" },
  { value: "ambiente", label: "Ambiente — objeto de casa, decoração" },
] as const;

const ZONA_FOCO_OPTIONS = [
  { value: "cabeca", label: "Cabeça — cabelo, rosto, brinco, óculos" },
  { value: "tronco", label: "Tronco — blusa, colete, colar, perfume" },
  { value: "corpo_inteiro", label: "Corpo inteiro — conjunto, vestido, look completo" },
  { value: "pernas_pes", label: "Pernas e pés — calça, legging, calçado" },
  { value: "maos", label: "Mãos — esmalte, anel, creme de mão" },
  { value: "objeto", label: "Objeto — não fica no corpo" },
] as const;

function validation(error: FieldErrors<WizardFormValues>[ReviewField], id: string) {
  if (!error?.message) return null;
  return <p id={id} className={styles.fieldError} role="alert">{error.message}</p>;
}

export function ProductReviewForm({ register, errors }: ProductReviewFormProps) {
  const fieldState = (field: ReviewField) => ({
    "aria-invalid": Boolean(errors[field]),
    "aria-errormessage": errors[field]?.message ? `${field}-error` : undefined,
  } as const);

  return <div className={styles.reviewForm}>
    <fieldset className={styles.reviewGroup}>
      <legend>Produto</legend>
      <div className={styles.fieldGrid}>
        <div className={styles.field}>
          <label htmlFor="nomeProduto">Nome do produto</label>
          <input id="nomeProduto" {...register("nomeProduto")} {...fieldState("nomeProduto")} placeholder="Não identificado — revise este campo" />
          {validation(errors.nomeProduto, "nomeProduto-error")}
        </div>
        <div className={styles.field}>
          <label htmlFor="categoria">Categoria</label>
          <input id="categoria" {...register("categoria")} {...fieldState("categoria")} placeholder="Não identificada — revise este campo" />
          {validation(errors.categoria, "categoria-error")}
        </div>
        <div className={`${styles.field} ${styles.fullWidth}`}>
          <label htmlFor="descricaoPdp">Descrição do anúncio</label>
          <textarea id="descricaoPdp" rows={4} {...register("descricaoPdp")} {...fieldState("descricaoPdp")} placeholder="Não identificada — revise este campo" />
          {validation(errors.descricaoPdp, "descricaoPdp-error")}
        </div>
      </div>
    </fieldset>

    <fieldset className={styles.reviewGroup}>
      <legend>Oferta e prova social</legend>
      <div className={styles.fieldGrid}>
        <div className={`${styles.field} ${styles.fullWidth}`}>
          <label htmlFor="avaliacoes">Avaliações</label>
          <textarea id="avaliacoes" rows={3} {...register("avaliacoes")} {...fieldState("avaliacoes")} placeholder="Nenhuma avaliação legível" />
          {validation(errors.avaliacoes, "avaliacoes-error")}
        </div>
        <div className={styles.field}>
          <label htmlFor="notaMedia">Nota média</label>
          <input id="notaMedia" type="number" min="0" max="5" step="0.1" {...register("notaMedia")} {...fieldState("notaMedia")} placeholder="Ex.: 4,8" />
          {validation(errors.notaMedia, "notaMedia-error")}
        </div>
        <div className={styles.field}>
          <label htmlFor="quantidadeAvaliacoes">Quantidade de avaliações</label>
          <input id="quantidadeAvaliacoes" type="number" min="0" step="1" {...register("quantidadeAvaliacoes")} {...fieldState("quantidadeAvaliacoes")} placeholder="Ex.: 1250" />
          {validation(errors.quantidadeAvaliacoes, "quantidadeAvaliacoes-error")}
        </div>
        <div className={styles.field}>
          <label htmlFor="precoAtual">Preço atual</label>
          <input id="precoAtual" {...register("precoAtual")} {...fieldState("precoAtual")} placeholder="Não identificado" />
          {validation(errors.precoAtual, "precoAtual-error")}
        </div>
        <div className={styles.field}>
          <label htmlFor="precoAnterior">Preço anterior</label>
          <input id="precoAnterior" {...register("precoAnterior")} {...fieldState("precoAnterior")} placeholder="Não identificado" />
          {validation(errors.precoAnterior, "precoAnterior-error")}
        </div>
      </div>
    </fieldset>

    <fieldset className={styles.reviewGroup}>
      <legend>Especificações</legend>
      <div className={styles.fieldGrid}>
        <div className={styles.field}>
          <label htmlFor="especificacoesTexto">Especificações críticas (uma por linha)</label>
          <textarea id="especificacoesTexto" rows={5} {...register("especificacoesTexto")} {...fieldState("especificacoesTexto")} placeholder={"Material\nMedidas\nCapacidade"} />
          {validation(errors.especificacoesTexto, "especificacoesTexto-error")}
        </div>
        <div className={styles.field}>
          <label htmlFor="publicoAlvo">Público-alvo</label>
          <textarea id="publicoAlvo" rows={5} {...register("publicoAlvo")} {...fieldState("publicoAlvo")} placeholder="Preencha apenas quando houver indicação explícita" />
          {validation(errors.publicoAlvo, "publicoAlvo-error")}
        </div>
      </div>
    </fieldset>

    <fieldset className={styles.reviewGroup}>
      <legend>Classificação do produto</legend>
      <p>Decide automaticamente enquadramento, posição das mãos e quais blocos do prompt existem — confira se a classificação está certa.</p>
      <div className={styles.fieldGrid}>
        <div className={styles.field}>
          <label htmlFor="formatoUso">Como o produto é usado</label>
          <select id="formatoUso" {...register("formatoUso")}>
            {FORMATO_USO_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor="zonaFoco">Onde o resultado aparece</label>
          <select id="zonaFoco" {...register("zonaFoco")}>
            {ZONA_FOCO_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div className={`${styles.field} ${styles.fullWidth}`}>
          <label htmlFor="detalheCriticoTexto">Detalhe crítico (opcional)</label>
          <input id="detalheCriticoTexto" {...register("detalheCriticoTexto")} placeholder="Ex.: alça sob o pé, cabeçote cilíndrico" />
        </div>
      </div>
    </fieldset>
  </div>;
}

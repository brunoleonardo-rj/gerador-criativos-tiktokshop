"use client";

import type { FieldErrors, UseFormRegister } from "react-hook-form";
import type { WizardFormValues } from "./generation-wizard";

type Props = { register: UseFormRegister<WizardFormValues>; errors: FieldErrors<WizardFormValues> };
const error = (value: { message?: string } | undefined) => value?.message && <p role="alert">{value.message}</p>;

export function ProductStep({ register, errors }: Props) {
  return <fieldset>
    <legend>Produto</legend>
    <label>Nome do produto<input {...register("nomeProduto")} aria-invalid={Boolean(errors.nomeProduto)} /></label>{error(errors.nomeProduto)}
    <label>Categoria<select {...register("categoria")} aria-invalid={Boolean(errors.categoria)}><option value="">Selecione</option><option value="moda">Moda</option><option value="casa">Casa</option><option value="perfumaria">Perfumaria</option><option value="beleza">Beleza</option><option value="outros">Outros</option></select></label>{error(errors.categoria)}
    <label>Descrição do anúncio<textarea {...register("descricaoPdp")} aria-invalid={Boolean(errors.descricaoPdp)} /></label>{error(errors.descricaoPdp)}
    <label>Avaliações<textarea {...register("avaliacoes")} /></label>
    <label>Nota média<input type="number" min="0" max="5" step="0.1" {...register("notaMedia")} /></label>{error(errors.notaMedia)}
    <label>Quantidade de avaliações<input type="number" min="0" step="1" {...register("quantidadeAvaliacoes")} /></label>{error(errors.quantidadeAvaliacoes)}
    <label>Preço atual<input {...register("precoAtual")} /></label>
    <label>Preço anterior<input {...register("precoAnterior")} /></label>
    <label>Especificações críticas (uma por linha)<textarea {...register("especificacoesTexto")} /></label>
    <label>Público-alvo<textarea {...register("publicoAlvo")} /></label>
    <label>Perfil UGC<select {...register("perfilUgc")} aria-invalid={Boolean(errors.perfilUgc)}><option value="">Selecione</option><option value="feminino">Feminino</option><option value="masculino">Masculino</option><option value="sem_pessoa">Sem pessoa</option></select></label>{error(errors.perfilUgc)}
    <label>Link do produto<input type="url" {...register("linkProduto")} /></label>{error(errors.linkProduto)}
  </fieldset>;
}

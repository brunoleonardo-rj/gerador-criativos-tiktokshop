"use client";

import type { FieldErrors, UseFormRegister } from "react-hook-form";
import type { WizardFormValues } from "./generation-wizard";

type Props = { register: UseFormRegister<WizardFormValues>; errors: FieldErrors<WizardFormValues> };
const error = (value: { message?: string } | undefined) => value?.message && <p role="alert">{value.message}</p>;

export function DirectionStep({ register, errors }: Props) {
  return <fieldset>
    <legend>Direção</legend>
    <label>Quantidade de criativos<input type="number" min="1" max="8" defaultValue={5} {...register("quantidadeCriativos")} /></label>{error(errors.quantidadeCriativos)}
    <label>Ambientes permitidos (um por linha, opcional — deixe em branco para a IA escolher automaticamente)<textarea {...register("ambientesTexto")} /></label>{error(errors.ambientesTexto)}
    <label>Política de preço<select {...register("politicaPreco")}><option value="sem_preco">Sem preço</option><option value="teto_folgado">Teto folgado</option><option value="preco_exato_com_aviso">Preço exato com aviso</option></select></label>
    <label>Duração total<select defaultValue="20" {...register("duracaoTotal")}><option value="15">15 segundos</option><option value="20">20 segundos</option><option value="30">30 segundos</option></select></label>
    <label><input type="checkbox" {...register("povComEmoji")} /> POV com emoji</label>
    <label>Máximo de palavras do POV<input type="number" min="1" max="30" defaultValue={11} {...register("maxPalavrasPov")} /></label>{error(errors.maxPalavrasPov)}
    <label>Quantidade de hashtags<input type="number" min="1" max="20" defaultValue={5} {...register("quantidadeHashtags")} /></label>{error(errors.quantidadeHashtags)}
    <label>Tom de voz<input {...register("tomVoz")} /></label>{error(errors.tomVoz)}
  </fieldset>;
}

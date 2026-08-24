"use client";

import type { CreativeEnvelope } from "@/features/generation/validation";
import { CopyButton } from "./copy-button";
import styles from "./results.module.css";

const statusLabel = { valid: "Aprovado", needs_review: "Atenção", blocked: "Bloqueado" } as const;
function isBlocked(creative: CreativeEnvelope, field: string) { return creative.issues.some((issue) => issue.severity === "block" && (issue.field === field || issue.field.startsWith(`${field}.`) || field.startsWith(`${issue.field}.`))); }
function addSection(parts: string[], title: string, value: string | null | undefined, blocked: boolean) { if (!blocked && value) parts.push(`## ${title}\n\n${value}`); }
export function buildCreativePackage(creative: CreativeEnvelope) {
  const parts: string[] = [];
  addSection(parts, "Ambiente", creative.ambiente, isBlocked(creative, "ambiente"));
  addSection(parts, "Figurino", creative.figurino, isBlocked(creative, "figurino"));
  addSection(parts, "Pose", creative.pose, isBlocked(creative, "pose"));
  addSection(parts, "Copy — trecho 1", creative.copy.trecho1.texto, isBlocked(creative, "copy.trecho1"));
  addSection(parts, "Copy — trecho 2", creative.copy.trecho2.texto, isBlocked(creative, "copy.trecho2"));
  if (creative.copy.trecho3) addSection(parts, "Copy — trecho 3", creative.copy.trecho3.texto, isBlocked(creative, "copy.trecho3"));
  addSection(parts, "Descrição", creative.descricao, isBlocked(creative, "descricao"));
  addSection(parts, "Hashtags", creative.hashtags.join(" "), isBlocked(creative, "hashtags"));
  addSection(parts, "POV", creative.pov.texto, isBlocked(creative, "pov"));
  addSection(parts, "Texto na tela", creative.textoNaTela, isBlocked(creative, "textoNaTela"));
  addSection(parts, "Prompt Gemini", creative.promptGemini, isBlocked(creative, "promptGemini"));
  addSection(parts, "Prompt VEO 3", creative.veoPrompt, isBlocked(creative, "veoPrompt"));
  return parts.join("\n\n");
}
function CopyField({ label, text, blocked }: { label: string; text: string | null; blocked: boolean }) { return <CopyButton label={label} text={text} disabled={blocked || !text} />; }
function CopySegment({ creative, index }: { creative: CreativeEnvelope; index: 1 | 2 | 3 }) {
  const segment = creative.copy[`trecho${index}`]; if (!segment) return null; const blocked = isBlocked(creative, `copy.trecho${index}`);
  return <section className={styles.field}><h3>Copy — trecho {index}</h3><p className={styles.text}>{segment.texto}</p><p className={styles.text}>Segundos: {segment.segundos}. Palavras reais: {creative.actualCounts[`trecho${index}`]}.</p><CopyField label={`Copiar trecho ${index}`} text={segment.texto} blocked={blocked} /></section>;
}
export function ResultCard({ creative }: { creative: CreativeEnvelope }) {
  const packageText = buildCreativePackage(creative);
  const status = statusLabel[creative.status];
  const screenText = creative.textoNaTela ?? "Sem texto na tela.";
  const discard = creative.descartavel ? creative.motivoDescartavel ?? "Criativo descartado." : "Criativo mantido.";
  const alerts = creative.issues.length ? creative.issues.map((issue) => `${issue.severity === "block" ? "Bloqueio" : "Atenção"}: ${issue.message}`).join("\n") : "Nenhum alerta.";
  return <article className={styles.card}><details><summary>{creative.id} — {creative.angulo} ({status})</summary><div className={styles.cardBody}>
    <section className={styles.field}><h3>ID</h3><p className={styles.text}>{creative.id}</p><CopyField label="Copiar ID" text={creative.id} blocked={false} /></section>
    <section className={styles.field}><h3>Ângulo</h3><p className={styles.text}>{creative.angulo}</p><CopyField label="Copiar ângulo" text={creative.angulo} blocked={isBlocked(creative, "angulo")} /></section>
    <section className={styles.field}><h3>Status</h3><p className={styles.text}>{status}</p><CopyField label="Copiar status" text={status} blocked={false} /></section>
    <section className={styles.field}><h3>Ambiente</h3><p className={styles.text}>{creative.ambiente}</p><CopyField label="Copiar ambiente" text={creative.ambiente} blocked={isBlocked(creative, "ambiente")} /></section>
    <section className={styles.field}><h3>Figurino</h3><p className={styles.text}>{creative.figurino}</p><CopyField label="Copiar figurino" text={creative.figurino} blocked={isBlocked(creative, "figurino")} /></section>
    <section className={styles.field}><h3>Pose</h3><p className={styles.text}>{creative.pose}</p><CopyField label="Copiar pose" text={creative.pose} blocked={isBlocked(creative, "pose")} /></section>
    <CopySegment creative={creative} index={1} /><CopySegment creative={creative} index={2} /><CopySegment creative={creative} index={3} />
    <section className={styles.field}><h3>Descrição</h3><p className={styles.text}>{creative.descricao}</p><CopyField label="Copiar descrição" text={creative.descricao} blocked={isBlocked(creative, "descricao")} /></section>
    <section className={styles.field}><h3>Hashtags</h3><p className={styles.text}>{creative.hashtags.join(" ")}</p><CopyField label="Copiar hashtags" text={creative.hashtags.join(" ")} blocked={isBlocked(creative, "hashtags")} /></section>
    <section className={styles.field}><h3>POV</h3><p className={styles.text}>{creative.pov.texto}</p><p className={styles.text}>Palavras reais: {creative.actualCounts.pov}.</p><CopyField label="Copiar POV" text={creative.pov.texto} blocked={isBlocked(creative, "pov")} /></section>
    <section className={styles.field}><h3>Texto na tela</h3><p className={styles.text}>{screenText}</p><CopyField label="Copiar texto na tela" text={screenText} blocked={isBlocked(creative, "textoNaTela")} /></section>
    <section className={styles.field}><h3>Prompt Gemini</h3><pre className={styles.prompt}>{creative.promptGemini}</pre><CopyField label="Copiar Prompt Gemini" text={creative.promptGemini} blocked={isBlocked(creative, "promptGemini")} /></section>
    <section className={styles.field}><h3>Prompt VEO 3</h3><pre className={styles.prompt}>{creative.veoPrompt ?? "Prompt VEO 3 indisponível."}</pre><CopyField label="Copiar Prompt VEO 3" text={creative.veoPrompt} blocked={isBlocked(creative, "veoPrompt")} /></section>
    <section className={styles.field}><h3>Descarte</h3><p className={styles.text}>{discard}</p><CopyField label="Copiar descarte" text={discard} blocked={false} /></section>
    <section className={styles.field}><h3>Alertas do criativo</h3>{creative.issues.length ? <ul>{creative.issues.map((issue, index) => <li key={`${issue.code}-${issue.field}-${index}`}><strong>{issue.severity === "block" ? "Bloqueio" : "Atenção"}: </strong>{issue.message}</li>)}</ul> : <p className={styles.text}>Nenhum alerta.</p>}<CopyField label="Copiar alertas do criativo" text={alerts} blocked={false} /></section>
    <div className={styles.packageAction}><CopyButton label="Copiar pacote completo" text={packageText} disabled={!packageText} /></div>
  </div></details></article>;
}

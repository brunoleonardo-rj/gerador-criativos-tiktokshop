"use client";

import { useState } from "react";
import type { CreativeEnvelope } from "@/features/generation/validation";
import { CopyButton } from "./copy-button";
import styles from "./results.module.css";

const statusLabel = { valid: "Aprovado", needs_review: "Atenção", blocked: "Bloqueado" } as const;
type ResultTab = "copy" | "selfie" | "pov" | "publication";
const tabs: { id: ResultTab; label: string }[] = [
  { id: "copy", label: "Copy" },
  { id: "selfie", label: "Selfie" },
  { id: "pov", label: "POV" },
  { id: "publication", label: "Publicação" },
];

function isBlocked(creative: CreativeEnvelope, field: string) {
  return creative.issues.some((issue) => issue.severity === "block" && (issue.field === field || issue.field.startsWith(`${field}.`) || field.startsWith(`${issue.field}.`)));
}

function addSection(parts: string[], title: string, value: string | null | undefined, blocked: boolean) {
  if (!blocked && value) parts.push(`## ${title}\n\n${value}`);
}

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
  addSection(parts, "Prompt VEO 3 — Trecho 1", creative.veoPrompts.trecho1, isBlocked(creative, "veoPrompts.trecho1"));
  addSection(parts, "Prompt VEO 3 — Trecho 2", creative.veoPrompts.trecho2, isBlocked(creative, "veoPrompts.trecho2"));
  addSection(parts, "Prompt VEO 3 — Trecho 3", creative.veoPrompts.trecho3, isBlocked(creative, "veoPrompts.trecho3"));
  addSection(parts, "Prompt Gemini (POV)", creative.promptGeminiPov, isBlocked(creative, "promptGeminiPov"));
  addSection(parts, "Prompt VEO 3 (POV) — Trecho 1", creative.veoPromptsPov.trecho1, isBlocked(creative, "veoPromptsPov.trecho1"));
  addSection(parts, "Prompt VEO 3 (POV) — Trecho 2", creative.veoPromptsPov.trecho2, isBlocked(creative, "veoPromptsPov.trecho2"));
  addSection(parts, "Prompt VEO 3 (POV) — Trecho 3", creative.veoPromptsPov.trecho3, isBlocked(creative, "veoPromptsPov.trecho3"));
  return parts.join("\n\n");
}

function buildSectionPackage(creative: CreativeEnvelope, tab: ResultTab) {
  if (tab === "selfie") return [creative.promptGemini, creative.veoPrompts.trecho1, creative.veoPrompts.trecho2, creative.veoPrompts.trecho3].filter(Boolean).join("\n\n");
  if (tab === "pov") return [creative.promptGeminiPov, creative.veoPromptsPov.trecho1, creative.veoPromptsPov.trecho2, creative.veoPromptsPov.trecho3].filter(Boolean).join("\n\n");
  if (tab === "copy") return [creative.copy.trecho1?.texto, creative.copy.trecho2?.texto, creative.copy.trecho3?.texto, creative.pov.texto].filter(Boolean).join("\n\n");
  return buildCreativePackage(creative);
}

function CopyField({ label, text, blocked }: { label: string; text: string | null; blocked: boolean }) {
  return <CopyButton label={label} text={text} disabled={blocked || !text} />;
}

function OutputField({ title, text, label, blocked = false, meta }: { title: string; text: string | null; label: string; blocked?: boolean; meta?: string }) {
  return <section className={styles.outputField}>
    <div className={styles.outputHeading}>
      <h3>{title}</h3>
      <CopyField label={label} text={text} blocked={blocked} />
    </div>
    <p className={styles.outputText}>{text ?? "Conteúdo indisponível."}</p>
    {meta && <p className={styles.outputMeta}>{meta}</p>}
  </section>;
}

function PromptField({ title, text, label, blocked = false }: { title: string; text: string | null; label: string; blocked?: boolean }) {
  return <section className={styles.outputField}>
    <div className={styles.outputHeading}>
      <h3>{title}</h3>
      <CopyField label={label} text={text} blocked={blocked} />
    </div>
    <pre className={styles.prompt}>{text ?? "Conteúdo indisponível."}</pre>
  </section>;
}

function CopyPanel({ creative }: { creative: CreativeEnvelope }) {
  const screenText = creative.textoNaTela ?? "Sem texto na tela.";
  return <div className={styles.panelStack}>
    {[1, 2, 3].map((index) => {
      const key = `trecho${index}` as "trecho1" | "trecho2" | "trecho3";
      const segment = creative.copy[key];
      if (!segment) return null;
      return <OutputField key={key} title={`Copy — trecho ${index}`} text={segment.texto} label={`Copiar trecho ${index}`} blocked={isBlocked(creative, `copy.${key}`)} meta={`${segment.segundos} segundos · Palavras reais: ${creative.actualCounts[key]}.`} />;
    })}
    <OutputField title="POV" text={creative.pov.texto} label="Copiar POV" blocked={isBlocked(creative, "pov")} meta={`Palavras reais: ${creative.actualCounts.pov}.`} />
    <details className={styles.compactDisclosure}>
      <summary>Texto complementar</summary>
      <OutputField title="Texto na tela" text={screenText} label="Copiar texto na tela" blocked={isBlocked(creative, "textoNaTela")} />
    </details>
  </div>;
}

function SelfiePanel({ creative }: { creative: CreativeEnvelope }) {
  return <div className={styles.panelStack}>
    <PromptField title="Prompt Gemini" text={creative.promptGemini} label="Copiar Prompt Gemini" blocked={isBlocked(creative, "promptGemini")} />
    {[1, 2, 3].map((index) => {
      const key = `trecho${index}` as "trecho1" | "trecho2" | "trecho3";
      if (!creative.copy[key]) return null;
      return <PromptField key={key} title={`Prompt VEO 3 — Trecho ${index}`} text={creative.veoPrompts[key]} label={`Copiar Prompt VEO 3 — Trecho ${index}`} blocked={isBlocked(creative, `veoPrompts.${key}`)} />;
    })}
  </div>;
}

function PovPanel({ creative }: { creative: CreativeEnvelope }) {
  return <div className={styles.panelStack}>
    <PromptField title="Prompt Gemini (POV)" text={creative.promptGeminiPov} label="Copiar Prompt Gemini (POV)" blocked={isBlocked(creative, "promptGeminiPov")} />
    {[1, 2, 3].map((index) => {
      const key = `trecho${index}` as "trecho1" | "trecho2" | "trecho3";
      if (!creative.copy[key]) return null;
      return <PromptField key={key} title={`Prompt VEO 3 (POV) — Trecho ${index}`} text={creative.veoPromptsPov[key]} label={`Copiar Prompt VEO 3 (POV) — Trecho ${index}`} blocked={isBlocked(creative, `veoPromptsPov.${key}`)} />;
    })}
  </div>;
}

function PublicationPanel({ creative }: { creative: CreativeEnvelope }) {
  const status = statusLabel[creative.status];
  const screenText = creative.textoNaTela ?? "Sem texto na tela.";
  const discard = creative.descartavel ? creative.motivoDescartavel ?? "Criativo descartado." : "Criativo mantido.";
  const alerts = creative.issues.length ? creative.issues.map((issue) => `${issue.severity === "block" ? "Bloqueio" : "Atenção"}: ${issue.message}`).join("\n") : "Nenhum alerta.";
  return <div className={styles.panelStack}>
    <details className={styles.compactDisclosure} open>
      <summary>Detalhes da cena</summary>
      <div className={styles.sceneGrid}>
        <OutputField title="Ambiente" text={creative.ambiente} label="Copiar ambiente" blocked={isBlocked(creative, "ambiente")} />
        <OutputField title="Figurino" text={creative.figurino} label="Copiar figurino" blocked={isBlocked(creative, "figurino")} />
        <OutputField title="Pose" text={creative.pose} label="Copiar pose" blocked={isBlocked(creative, "pose")} />
      </div>
    </details>
    <OutputField title="Descrição" text={creative.descricao} label="Copiar descrição" blocked={isBlocked(creative, "descricao")} />
    <OutputField title="Hashtags" text={creative.hashtags.join(" ")} label="Copiar hashtags" blocked={isBlocked(creative, "hashtags")} />
    <details className={styles.compactDisclosure}>
      <summary>Validação e metadados</summary>
      <div className={styles.sceneGrid}>
        <OutputField title="ID" text={creative.id} label="Copiar ID" />
        <OutputField title="Ângulo" text={creative.angulo} label="Copiar ângulo" blocked={isBlocked(creative, "angulo")} />
        <OutputField title="Status" text={status} label="Copiar status" />
        <OutputField title="Texto na tela" text={screenText} label="Copiar texto na tela" blocked={isBlocked(creative, "textoNaTela")} />
        <OutputField title="Descarte" text={discard} label="Copiar descarte" />
      </div>
      <section className={styles.alertField}>
        <h3>Alertas do criativo</h3>
        {creative.issues.length ? <ul>{creative.issues.map((issue, index) => <li key={`${issue.code}-${issue.field}-${index}`}><strong>{issue.severity === "block" ? "Bloqueio" : "Atenção"}:</strong> {issue.message}</li>)}</ul> : <p>Nenhum alerta.</p>}
        <CopyField label="Copiar alertas do criativo" text={alerts} blocked={false} />
      </section>
    </details>
  </div>;
}

export function ResultCard({ creative, label = "Criativo" }: { creative: CreativeEnvelope; label?: string }) {
  const [tab, setTab] = useState<ResultTab>("copy");
  const packageText = buildCreativePackage(creative);
  const status = statusLabel[creative.status];

  return <article className={styles.detailPanel} aria-label={`${label}: ${creative.angulo}`}>
    <header className={styles.detailHeader}>
      <div>
        <div className={styles.detailTitleRow}>
          <h2>{label}</h2>
          <span className={`${styles.statusBadge} ${styles[creative.status]}`}>{status}</span>
        </div>
        <p>{creative.angulo}</p>
      </div>
    </header>

    <div className={styles.tabList} role="tablist" aria-label="Conteúdo do criativo">
      {tabs.map((item) => <button key={item.id} id={`creative-${creative.id}-${item.id}-tab`} type="button" role="tab" aria-selected={tab === item.id} aria-controls={`creative-${creative.id}-${item.id}`} onClick={() => setTab(item.id)}>{item.label}</button>)}
    </div>

    <div className={styles.tabPanel} id={`creative-${creative.id}-${tab}`} role="tabpanel" aria-labelledby={`creative-${creative.id}-${tab}-tab`}>
      {tab === "copy" && <CopyPanel creative={creative} />}
      {tab === "selfie" && <SelfiePanel creative={creative} />}
      {tab === "pov" && <PovPanel creative={creative} />}
      {tab === "publication" && <PublicationPanel creative={creative} />}
    </div>

    <footer className={styles.detailActions}>
      <CopyButton label="Copiar seção" text={buildSectionPackage(creative, tab)} />
      <CopyButton label="Copiar pacote completo" text={packageText} disabled={!packageText} />
    </footer>
  </article>;
}

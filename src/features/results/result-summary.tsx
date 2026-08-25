"use client";

import type { GenerationEnvelope } from "@/features/generation/validation";
import { CopyButton } from "./copy-button";
import styles from "./results.module.css";

const statuses = { valid: "Aprovado", needs_review: "Atenção", blocked: "Bloqueado" } as const;

function List({ title, values, empty, copyLabel }: { title: string; values: string[]; empty: string; copyLabel: string }) {
  const text = values.length ? values.join("\n") : empty;
  return <section className={styles.validationField}>
    <h2>{title}</h2>
    {values.length ? <ul>{values.map((value, index) => <li key={`${value}-${index}`}>{value}</li>)}</ul> : <p>{empty}</p>}
    <CopyButton label={copyLabel} text={text} />
  </section>;
}

export function ResultSummary({ result }: { result: GenerationEnvelope }) {
  const validDate = result.settingsUpdatedAt && !Number.isNaN(Date.parse(result.settingsUpdatedAt)) ? new Date(result.settingsUpdatedAt).toLocaleString("pt-BR") : null;
  const status = statuses[result.status];
  const configuration = validDate ? `Configuração usada em ${validDate}` : "Data da configuração indisponível.";
  const alerts = result.batchIssues.length ? result.batchIssues.map((issue) => `${issue.severity === "block" ? "Bloqueio" : "Atenção"}: ${issue.message}`).join("\n") : "Nenhum alerta da geração.";
  const count = `${result.creatives.length} ${result.creatives.length === 1 ? "criativo pronto" : "criativos prontos"}`;

  return <section aria-label="Resumo da geração" className={styles.summary}>
    <div className={styles.summaryStrip}>
      <div className={styles.summaryProduct}>
        <span className={`${styles.statusDot} ${styles[result.status]}`} aria-hidden="true" />
        <div>
          <p className={styles.summaryLabel}>Resultado {result.status === "valid" ? "aprovado" : "validado"}</p>
          <h1>{result.produtoNormalizado}</h1>
        </div>
      </div>
      <p className={styles.summaryCount}>{count}</p>
      <span className={`${styles.statusBadge} ${styles[result.status]}`}>{status}</span>
    </div>

    <details className={styles.validationDisclosure}>
      <summary>Ver validação geral</summary>
      <div className={styles.summaryGrid}>
        <section className={styles.validationField}><h2>Produto</h2><p>{result.produtoNormalizado}</p><CopyButton label="Copiar produto" text={result.produtoNormalizado} /></section>
        <section className={styles.validationField}><h2>Status geral</h2><p>{status}</p><CopyButton label="Copiar status geral" text={status} /></section>
        <section className={styles.validationField}><h2>Configuração usada</h2><p>{configuration}</p><CopyButton label="Copiar configuração usada" text={configuration} /></section>
        <List title="Fatos verificados" values={result.fatos} empty="Nenhum fato verificado." copyLabel="Copiar fatos verificados" />
        <List title="Riscos detectados" values={result.riscos} empty="Nenhum risco detectado." copyLabel="Copiar riscos detectados" />
        <List title="Checklist de publicação" values={result.checklistPublicacao} empty="Nenhum item no checklist." copyLabel="Copiar checklist de publicação" />
        <section className={styles.validationField}><h2>Alertas da geração</h2>{result.batchIssues.length ? <ul>{result.batchIssues.map((issue, index) => <li key={`${issue.code}-${issue.field}-${index}`}><strong>{issue.severity === "block" ? "Bloqueio" : "Atenção"}: </strong>{issue.message}</li>)}</ul> : <p>Nenhum alerta da geração.</p>}<CopyButton label="Copiar alertas da geração" text={alerts} /></section>
      </div>
    </details>
  </section>;
}

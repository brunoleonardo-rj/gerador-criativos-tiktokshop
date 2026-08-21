"use client";

import type { GenerationEnvelope } from "@/features/generation/validation";

const statuses = { valid: "Aprovado", needs_review: "Atenção", blocked: "Bloqueado" } as const;
function List({ title, values, empty }: { title: string; values: string[]; empty: string }) { return <section><h2>{title}</h2>{values.length ? <ul>{values.map((value, index) => <li key={`${value}-${index}`}>{value}</li>)}</ul> : <p>{empty}</p>}</section>; }

export function ResultSummary({ result }: { result: GenerationEnvelope }) {
  const validDate = result.settingsUpdatedAt && !Number.isNaN(Date.parse(result.settingsUpdatedAt)) ? new Date(result.settingsUpdatedAt).toLocaleString("pt-BR") : null;
  return <section aria-label="Resumo da geração" className="grid gap-4"><p className="eyebrow">Resultado validado</p><h1>{result.produtoNormalizado}</h1><p><strong>Status geral: </strong>{statuses[result.status]}</p>{validDate ? <p>Configuração usada em {validDate}</p> : null}
    <List title="Fatos verificados" values={result.fatos} empty="Nenhum fato verificado." /><List title="Riscos detectados" values={result.riscos} empty="Nenhum risco detectado." /><List title="Checklist de publicação" values={result.checklistPublicacao} empty="Nenhum item no checklist." />
    <section><h2>Alertas da geração</h2>{result.batchIssues.length ? <ul>{result.batchIssues.map((issue, index) => <li key={`${issue.code}-${issue.field}-${index}`}><strong>{issue.severity === "block" ? "Bloqueio" : "Atenção"}: </strong>{issue.message}</li>)}</ul> : <p>Nenhum alerta da geração.</p>}</section>
  </section>;
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { z } from "zod";
import { assetStorage, type StoredResult } from "@/features/draft/storage";
import { refreshPrompts } from "@/features/generation/validation";
import { ResultCard } from "./result-card";
import { ResultSummary } from "./result-summary";
import styles from "./results.module.css";

type ResultStorage = { getResult(id: string): Promise<StoredResult | undefined>; putResult?(result: StoredResult): Promise<void> };
type CurrentTemplates = { veoTemplate: string; geminiTemplate: string; updatedAt: string };
async function defaultFetchCurrentTemplates(): Promise<CurrentTemplates | null> {
  try {
    const response = await fetch("/api/settings");
    if (!response.ok) return null;
    const data: unknown = await response.json();
    if (!data || typeof data !== "object") return null;
    const { veoTemplate, geminiTemplate, updatedAt } = data as Record<string, unknown>;
    if (typeof veoTemplate !== "string" || typeof geminiTemplate !== "string" || typeof updatedAt !== "string") return null;
    return { veoTemplate, geminiTemplate, updatedAt };
  } catch { return null; }
}
export function ResultPage({ id, storage = assetStorage, fetchCurrentTemplates = defaultFetchCurrentTemplates }: { id: string; storage?: ResultStorage; fetchCurrentTemplates?: () => Promise<CurrentTemplates | null> }) {
  const [state, setState] = useState<{ id: string | null; result: StoredResult | null }>({ id: null, result: null });
  useEffect(() => { let active = true; const load = z.string().uuid().safeParse(id).success ? storage.getResult(id) : Promise.resolve(undefined);
    void load.then((result) => {
      if (active) setState({ id, result: result ?? null });
      if (!result || !active) return;
      void (async () => {
        try {
          const current = await fetchCurrentTemplates();
          if (!current || !active || current.updatedAt === result.settingsUpdatedAt) return;
          const refreshed: StoredResult = { ...refreshPrompts(result, current.veoTemplate, current.geminiTemplate, current.updatedAt), id: result.id, createdAt: result.createdAt };
          if (active) setState({ id, result: refreshed });
          await storage.putResult?.(refreshed);
        } catch {
          // The persisted result remains usable even when refreshing its prompts fails.
        }
      })();
    }).catch(() => { if (active) setState({ id, result: null }); }); return () => { active = false; };
  }, [id, storage, fetchCurrentTemplates]);
  if (state.id !== id) return <main className={styles.page}><section className={styles.shell}><p>Carregando resultado…</p></section></main>;
  if (!state.result) return <main className={styles.page}><section className={styles.shell}><h1>Resultado não encontrado neste navegador</h1><Link href="/">Nova geração</Link></section></main>;
  return <ResultWorkspace key={state.result.id} result={state.result} />;
}

export function ResultWorkspace({ result }: { result: StoredResult }) {
  const [selectedCreative, setSelectedCreative] = useState(0);
  const creative = result.creatives[selectedCreative] ?? result.creatives[0];
  return <main className={styles.page}>
    <section className={styles.shell}>
      <ResultSummary result={result} />
      <div className={styles.resultWorkspace}>
        <section className={styles.creativeList} aria-label="Criativos gerados">
          <header className={styles.listHeader}>
            <div>
              <p className={styles.listEyebrow}>Criativos</p>
              <h2>{result.creatives.length} {result.creatives.length === 1 ? "versão gerada" : "versões geradas"}</h2>
            </div>
            <Link className={styles.newGenerationLink} href="/">Nova geração</Link>
          </header>
          <div className={styles.listColumns} aria-hidden="true"><span>Criativo</span><span>Ângulo</span><span>Status</span></div>
          <ol className={styles.creativeRows}>
            {result.creatives.map((item, index) => {
              const label = `Criativo ${String(index + 1).padStart(2, "0")}`;
              const selected = index === selectedCreative;
              const status = item.status === "valid" ? "Aprovado" : item.status === "blocked" ? "Bloqueado" : "Atenção";
              return <li key={item.id}>
                <button type="button" aria-label={`Selecionar ${label}`} aria-pressed={selected} onClick={() => setSelectedCreative(index)}>
                  <span className={styles.creativeIdentity}><span className={styles.creativeNumber}>{String(index + 1).padStart(2, "0")}</span><strong>{label}</strong></span>
                  <span className={styles.creativeAngle}>{item.angulo}</span>
                  <span className={`${styles.statusBadge} ${styles[item.status]}`}>{status}</span>
                </button>
              </li>;
            })}
          </ol>
        </section>
        {creative && <ResultCard key={creative.id} creative={creative} label={`Criativo ${String(selectedCreative + 1).padStart(2, "0")}`} />}
      </div>
    </section>
  </main>;
}

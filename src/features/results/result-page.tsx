"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { z } from "zod";
import { assetStorage, type StoredResult } from "@/features/draft/storage";
import { ResultCard } from "./result-card";
import { ResultSummary } from "./result-summary";
import styles from "./results.module.css";

type ResultStorage = { getResult(id: string): Promise<StoredResult | undefined>; putResult?(result: StoredResult): Promise<void> };
export function ResultPage({ id, storage = assetStorage }: { id: string; storage?: ResultStorage }) {
  const [state, setState] = useState<{ id: string | null; result: StoredResult | null }>({ id: null, result: null });
  useEffect(() => { let active = true; const load = z.string().uuid().safeParse(id).success ? storage.getResult(id) : Promise.resolve(undefined);
    void load.then((result) => {
      if (active) setState({ id, result: result ?? null });
    }).catch(() => { if (active) setState({ id, result: null }); }); return () => { active = false; };
  }, [id, storage]);
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

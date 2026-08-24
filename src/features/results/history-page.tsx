"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { assetStorage, type StoredResult } from "@/features/draft/storage";
import styles from "./results.module.css";

type ResultStorage = { listResults(): Promise<StoredResult[]> };
const statuses = { valid: "Aprovado", needs_review: "Atenção", blocked: "Bloqueado" } as const;

export function HistoryPage({ storage = assetStorage }: { storage?: ResultStorage }) {
  const [state, setState] = useState<{ loaded: boolean; results: StoredResult[] }>({ loaded: false, results: [] });
  useEffect(() => { let active = true; void storage.listResults().then((results) => { if (active) setState({ loaded: true, results }); }); return () => { active = false; }; }, [storage]);

  if (!state.loaded) return <main className={styles.page}><section className={styles.shell}><p>Carregando histórico…</p></section></main>;
  if (!state.results.length) return <main className={styles.page}><section className={styles.shell}><h1>Nenhum resultado gerado ainda neste navegador</h1><Link href="/">Nova geração</Link></section></main>;

  return <main className={styles.page}><section className={styles.shell}>
    <p className="eyebrow">Histórico</p>
    <h1>Resultados gerados</h1>
    <ul className={styles.cards}>
      {state.results.map((result) => {
        const when = result.createdAt && !Number.isNaN(Date.parse(result.createdAt)) ? new Date(result.createdAt).toLocaleString("pt-BR") : "Data desconhecida";
        return <li key={result.id} className={styles.card}>
          <Link href={`/resultado/${result.id}`} className={styles.field} style={{ display: "grid", gap: "0.35rem" }}>
            <h2>{result.produtoNormalizado}</h2>
            <p className={styles.text}>{when} · {statuses[result.status]} · {result.creatives.length} criativo{result.creatives.length === 1 ? "" : "s"}</p>
          </Link>
        </li>;
      })}
    </ul>
  </section></main>;
}

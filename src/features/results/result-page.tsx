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
    void load.then((result) => { if (active) setState({ id, result: result ?? null }); return result; }).then(async (result) => {
      if (!result || !active) return;
      const current = await fetchCurrentTemplates();
      if (!current || !active || current.updatedAt === result.settingsUpdatedAt) return;
      const refreshed: StoredResult = { ...refreshPrompts(result, current.veoTemplate, current.geminiTemplate, current.updatedAt), id: result.id, createdAt: result.createdAt };
      if (active) setState({ id, result: refreshed });
      await storage.putResult?.(refreshed);
    }).catch(() => { if (active) setState({ id, result: null }); }); return () => { active = false; };
  }, [id, storage, fetchCurrentTemplates]);
  if (state.id !== id) return <main className={styles.page}><section className={styles.shell}><p>Carregando resultado…</p></section></main>;
  if (!state.result) return <main className={styles.page}><section className={styles.shell}><h1>Resultado não encontrado neste navegador</h1><Link href="/">Nova geração</Link></section></main>;
  return <main className={styles.page}><section className={styles.shell}><ResultSummary result={state.result} /><div className={styles.cards}>{state.result.creatives.map((creative) => <ResultCard key={creative.id} creative={creative} />)}</div></section></main>;
}

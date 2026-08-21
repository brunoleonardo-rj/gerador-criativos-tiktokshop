"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { z } from "zod";
import { assetStorage, type StoredResult } from "@/features/draft/storage";
import { ResultCard } from "./result-card";
import { ResultSummary } from "./result-summary";

type ResultStorage = { getResult(id: string): Promise<StoredResult | undefined> };
export function ResultPage({ id, storage = assetStorage }: { id: string; storage?: ResultStorage }) {
  const [state, setState] = useState<{ id: string | null; result: StoredResult | null }>({ id: null, result: null });
  useEffect(() => { let active = true; const load = z.string().uuid().safeParse(id).success ? storage.getResult(id) : Promise.resolve(undefined);
    void load.then((result) => { if (active) setState({ id, result: result ?? null }); }).catch(() => { if (active) setState({ id, result: null }); }); return () => { active = false; };
  }, [id, storage]);
  if (state.id !== id) return <main className="landing-page"><p>Carregando resultado…</p></main>;
  if (!state.result) return <main className="landing-page"><section className="landing-hero"><h1>Resultado não encontrado neste navegador</h1><Link href="/">Nova geração</Link></section></main>;
  return <main className="landing-page"><section className="landing-hero"><ResultSummary result={state.result} /><div className="mt-8 grid gap-4">{state.result.creatives.map((creative) => <ResultCard key={creative.id} creative={creative} />)}</div></section></main>;
}

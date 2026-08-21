"use client";

import { useState } from "react";

type CopyButtonProps = { text: string | null | undefined; label: string; disabled?: boolean };

export function CopyButton({ text, label, disabled = false }: CopyButtonProps) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const enabled = !disabled && Boolean(text) && !pending;
  async function copy() {
    if (!enabled || !text) return;
    if (!navigator.clipboard?.writeText) { setMessage("Não foi possível copiar. Tente novamente."); return; }
    setPending(true); setMessage("");
    try { await navigator.clipboard.writeText(text); setMessage("Copiado com sucesso."); }
    catch { setMessage("Não foi possível copiar. Tente novamente."); }
    finally { setPending(false); }
  }
  return <span className="inline-flex items-center gap-2"><button type="button" onClick={() => void copy()} disabled={!enabled}>{label}</button><span role="status" aria-live="polite" className="sr-only">{message}</span></span>;
}

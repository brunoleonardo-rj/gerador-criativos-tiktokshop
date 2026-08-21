"use client";

import { useEffect, useRef, useState } from "react";

type CopyButtonProps = { text: string | null | undefined; label: string; disabled?: boolean };

export function CopyButton({ text, label, disabled = false }: CopyButtonProps) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const locked = useRef(false);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const enabled = !disabled && Boolean(text) && !pending;
  async function copy() {
    if (disabled || !text || locked.current) return;
    if (!navigator.clipboard?.writeText) { if (mounted.current) setMessage("Não foi possível copiar. Tente novamente."); return; }
    locked.current = true;
    if (mounted.current) { setPending(true); setMessage(""); }
    try { await navigator.clipboard.writeText(text); if (mounted.current) setMessage("Copiado com sucesso."); }
    catch { if (mounted.current) setMessage("Não foi possível copiar. Tente novamente."); }
    finally { locked.current = false; if (mounted.current) setPending(false); }
  }
  return <span className="inline-flex items-center gap-2"><button type="button" onClick={() => void copy()} disabled={!enabled}>{label}</button><span role="status" aria-live="polite" className="sr-only">{message}</span></span>;
}

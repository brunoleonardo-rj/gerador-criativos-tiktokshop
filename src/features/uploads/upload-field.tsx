"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ACCEPTED_IMAGE_TYPES, resizeImage } from "./resize";
import type { ImageRole, StoredImage } from "@/features/draft/storage";

type UploadFieldProps = {
  role: ImageRole;
  min: number;
  max: number;
  items: StoredImage[];
  label?: string;
  help?: string;
  disabled?: boolean;
  onChange(items: StoredImage[]): void;
};
const labels: Record<ImageRole, string> = { ugc: "Fotos da pessoa UGC", product: "Fotos do produto", ad: "Prints do anúncio" };
const allowed = new Set<string>(ACCEPTED_IMAGE_TYPES);
const extensionForType: Record<string, RegExp> = { "image/jpeg": /\.jpe?g$/iu, "image/png": /\.png$/iu, "image/webp": /\.webp$/iu };
const acceptedFile = (file: File): boolean => allowed.has(file.type) && extensionForType[file.type]?.test(file.name) === true;

export function UploadField({ role, min, max, items, label = labels[role], help, disabled = false, onChange }: UploadFieldProps) {
  const id = useId();
  const helpText = help ?? `Selecione entre ${min} e ${max} imagens. JPEG, PNG ou WEBP.`;
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(0);
  const currentItems = useRef(items);
  const currentDisabled = useRef(disabled);
  const queue = useRef(Promise.resolve());
  // A layout effect only observes committed props and runs before promise continuations queued after commit.
  useLayoutEffect(() => {
    currentItems.current = items;
    currentDisabled.current = disabled;
  }, [disabled, items]);
  const previews = useMemo(() => {
    const next: Record<string, string> = {};
    for (const item of items) next[item.id] = URL.createObjectURL(item.blob);
    return next;
  }, [items]);
  useEffect(() => () => Object.values(previews).forEach((url) => URL.revokeObjectURL(url)), [previews]);

  function commit(next: StoredImage[]) {
    if (currentDisabled.current) return;
    currentItems.current = next;
    onChange(next);
  }
  function enqueue(operation: () => Promise<void>) {
    const pending = queue.current.then(operation, operation);
    queue.current = pending.catch(() => undefined);
    return pending;
  }
  async function choose(files: FileList | null) {
    if (!files?.length) return;
    const selected = Array.from(files);
    setProcessing((value) => value + selected.length);
    await enqueue(async () => {
      const available = Math.max(0, max - currentItems.current.length);
      const candidates = selected.slice(0, available);
      if (selected.length > available) setError(`Máximo de ${max} imagens permitido.`);
      const valid = candidates.filter(acceptedFile);
      if (valid.length !== candidates.length) setError("Use arquivos JPEG, PNG ou WEBP.");
      const added: StoredImage[] = [];
      for (const file of valid) {
        try { added.push({ ...(await resizeImage(file)), id: crypto.randomUUID(), role }); }
        catch { setError(`Não foi possível processar ${file.name}.`); }
        finally { setProcessing((value) => Math.max(0, value - 1)); }
      }
      for (let skipped = valid.length; skipped < selected.length; skipped += 1) setProcessing((value) => Math.max(0, value - 1));
      if (added.length) commit([...currentItems.current, ...added].slice(0, max));
    });
  }

  return <fieldset aria-describedby={`${id}-help`} aria-disabled={disabled}>
    <legend>{label}</legend>
    <p id={`${id}-help`}>{helpText}</p>
    <label htmlFor={id}>{label}</label>
    <input id={id} aria-label={label} aria-describedby={`${id}-help`} type="file" accept={ACCEPTED_IMAGE_TYPES.join(",")} multiple disabled={disabled || items.length >= max} onChange={(event) => { void choose(event.target.files); event.currentTarget.value = ""; }} />
    {processing > 0 && <p role="status" aria-live="polite">Processando {processing} imagem(ns)…</p>}
    {error && <p role="alert">{error}</p>}
    <ul aria-label="Imagens selecionadas">
      {items.map((item) => <li key={item.id}>
        {/* Local object URLs are already resized and revoked by this component. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {previews[item.id] && <img src={previews[item.id]} alt={`Prévia de ${item.name}`} />}
        <span>{item.name} — {item.width}×{item.height}</span>
        <button type="button" disabled={disabled} onClick={() => commit(currentItems.current.filter((candidate) => candidate.id !== item.id))} aria-label={`Remover ${item.name}`}>Remover</button>
      </li>)}
    </ul>
  </fieldset>;
}

"use client";

import { UploadField } from "@/features/uploads/upload-field";
import type { ImageRole, StoredImage } from "@/features/draft/storage";

export type ReferenceError = { load?: boolean; save?: boolean; productRequired?: boolean; ugcRequired?: boolean } | null;
type Props = { profile: string; images: StoredImage[]; loading: boolean; error: ReferenceError; onImagesChange(role: ImageRole, images: StoredImage[]): void };
export function ReferencesStep({ profile, images, loading, error, onImagesChange }: Props) {
  const byRole = (role: ImageRole) => images.filter((image) => image.role === role);
  if (loading) return <p role="status">Carregando referências…</p>;
  return <section aria-labelledby="references-title"><h2 id="references-title">Referências</h2>
    {error?.load && <p role="alert">Não foi possível carregar as referências. Recarregue a página e tente novamente.</p>}
    {error?.save && <p role="alert">Não foi possível salvar a alteração das referências. Tente novamente.</p>}
    {error?.productRequired && <p role="alert" tabIndex={-1}>Adicione ao menos uma foto do produto.</p>}
    {error?.ugcRequired && <p role="alert" tabIndex={-1}>Adicione ao menos uma foto da pessoa UGC.</p>}
    <UploadField role="ugc" min={profile === "sem_pessoa" ? 0 : 1} max={5} items={byRole("ugc")} onChange={(items) => onImagesChange("ugc", items)} />
    <UploadField role="product" min={1} max={8} items={byRole("product")} onChange={(items) => onImagesChange("product", items)} />
    <UploadField role="ad" min={0} max={5} items={byRole("ad")} onChange={(items) => onImagesChange("ad", items)} />
  </section>;
}

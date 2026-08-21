"use client";

import { UploadField } from "@/features/uploads/upload-field";
import type { ImageRole, StoredImage } from "@/features/draft/storage";

type Props = { profile: string; images: StoredImage[]; loading: boolean; error: string | null; onImagesChange(role: ImageRole, images: StoredImage[]): void };
export function ReferencesStep({ profile, images, loading, error, onImagesChange }: Props) {
  const byRole = (role: ImageRole) => images.filter((image) => image.role === role);
  if (loading) return <p role="status">Carregando referências…</p>;
  return <section aria-labelledby="references-title"><h2 id="references-title">Referências</h2>
    {error && <p role="alert">Não foi possível carregar as referências. Tente novamente.</p>}
    <UploadField role="ugc" min={profile === "sem_pessoa" ? 0 : 1} max={5} items={byRole("ugc")} onChange={(items) => onImagesChange("ugc", items)} />
    <UploadField role="product" min={1} max={8} items={byRole("product")} onChange={(items) => onImagesChange("product", items)} />
    <UploadField role="ad" min={0} max={5} items={byRole("ad")} onChange={(items) => onImagesChange("ad", items)} />
  </section>;
}
